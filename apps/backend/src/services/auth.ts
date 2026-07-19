import type { PrismaClient } from "@evalio/db";
import type { RedisClientType } from "redis";
import {
  AppError,
  ValidationError,
  AuthError,
  ConflictError,
  RateLimitError,
  NotFoundError,
} from "../lib/errors";
import { logger } from "../lib/logger";

export interface TokenService {
  signAccessToken(user: {
    id: string;
    email: string;
    name?: string | null;
    role: "FREE" | "PRO" | "ADMIN";
    roleVersion: number;
  }): Promise<string>;
  signRefreshToken(
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: "FREE" | "PRO" | "ADMIN";
      roleVersion: number;
    },
    familyId?: string,
  ): Promise<{ token: string; familyId: string }>;
  verifyRefreshToken(
    token: string,
  ): Promise<{ id: string; email: string; tokenId: string } | null>;
}

export interface EmailService {
  sendOtpEmail(email: string, name: string, otp: string): Promise<boolean>;
  sendWelcomeEmail(email: string, name: string): Promise<boolean>;
  sendResetOtpEmail(email: string, name: string, otp: string): Promise<boolean>;
}

export interface LoginAttemptService {
  recordFailedAttempt(email: string): Promise<void>;
  isAccountLocked(email: string): Promise<boolean>;
  getLockoutRemaining(email: string): Promise<number>;
  clearFailedAttempts(email: string): Promise<void>;
}

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const OTP_RATE_PREFIX = "otp_rate:";
const OTP_RATE_WINDOW = 30;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export class AuthService {
  constructor(
    private prisma: PrismaClient,
    private tokens: TokenService,
    private email: EmailService,
    private loginAttempt: LoginAttemptService,
    private redis: RedisClientType,
  ) {}

  async signup(email: string, password: string, name?: string) {
    if (!PASSWORD_REGEX.test(password)) {
      throw new ValidationError(
        "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      if (!existing.emailVerified) {
        throw new ConflictError(
          "An account with this email already exists. Please sign in with your credentials.",
        );
      }
      throw new ConflictError("Email already registered");
    }

    const hashed = await Bun.password.hash(password);
    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          name: name ?? null,
          password: hashed,
          verificationOtp: otp,
          verificationOtpExpiry: otpExpiry,
          candidate: { create: {} },
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
        },
      });
      return u;
    });

    const sent = await this.email.sendOtpEmail(
      user.email,
      user.name ?? "there",
      otp,
    );

    logger.info("auth.signup", { userId: user.id, email: user.email });

    return {
      user,
      message: sent
        ? "Account created. Please verify your email using the OTP sent."
        : "Account created. Could not send verification email — please request a new OTP later.",
    };
  }

  async verifyOtp(email: string, otp: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        roleVersion: true,
        emailVerified: true,
        verificationOtp: true,
        verificationOtpExpiry: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User");
    }

    if (user.emailVerified) {
      return { message: "Email already verified", verified: true };
    }

    if (!user.verificationOtp || !user.verificationOtpExpiry) {
      throw new ValidationError("No OTP requested. Please sign up again.");
    }

    if (new Date() > user.verificationOtpExpiry) {
      throw new ValidationError("OTP has expired. Request a new one.");
    }

    if (user.verificationOtp !== otp) {
      throw new ValidationError("Invalid OTP");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationOtp: null,
        verificationOtpExpiry: null,
      },
    });

    const accessToken = await this.tokens.signAccessToken(user);
    const refresh = await this.tokens.signRefreshToken(user);

    this.email
      .sendWelcomeEmail(user.email, user.name ?? "there")
      .catch(() => {});

    logger.info("auth.verifyOtp", { userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken: refresh.token,
      verified: true,
    };
  }

  async resendOtp(email: string) {
    const { allowed, retryAfter } = await this.checkOtpRateLimit(email);
    if (!allowed) {
      throw new RateLimitError(
        `Please wait ${retryAfter}s before requesting a new code.`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, emailVerified: true },
    });

    if (!user) {
      throw new NotFoundError("User");
    }

    if (user.emailVerified) {
      return { message: "Email already verified" };
    }

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationOtp: otp,
        verificationOtpExpiry: otpExpiry,
      },
    });

    const sent = await this.email.sendOtpEmail(
      user.email,
      user.name ?? "there",
      otp,
    );

    if (!sent) {
      throw new AppError(
        "Failed to send OTP email. Please try again.",
        500,
        "EMAIL_SEND_FAILED",
      );
    }

    return { message: "OTP resent to your email" };
  }

  async login(email: string, password: string) {
    const locked = await this.loginAttempt.isAccountLocked(email);
    if (locked) {
      const remaining = await this.loginAttempt.getLockoutRemaining(email);
      throw new AppError(
        `Account temporarily locked. Try again in ${Math.ceil(remaining / 60)} minutes.`,
        429,
        "ACCOUNT_LOCKED",
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        roleVersion: true,
        password: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw new AuthError("User does not exist. Create an account first.");
    }

    const valid = await Bun.password.verify(password, user.password);
    if (!valid) {
      await this.loginAttempt.recordFailedAttempt(email);
      throw new AuthError("Invalid email or password");
    }

    if (!user.emailVerified) {
      throw new AppError(
        "Please verify your email before signing in",
        403,
        "EMAIL_NOT_VERIFIED",
        { email: user.email },
      );
    }

    await this.loginAttempt.clearFailedAttempts(email);

    const accessToken = await this.tokens.signAccessToken(user);
    const refresh = await this.tokens.signRefreshToken(user);

    logger.info("auth.login", { userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken: refresh.token,
    };
  }

  async forgotPassword(email: string) {
    const { allowed, retryAfter } = await this.checkOtpRateLimit(email);
    if (!allowed) {
      throw new RateLimitError(
        `Please wait ${retryAfter}s before requesting a new code.`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return {
        message: "If that email exists, a reset code has been sent.",
      };
    }

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationOtp: otp,
        verificationOtpExpiry: otpExpiry,
      },
    });

    const sent = await this.email.sendResetOtpEmail(
      user.email,
      user.name ?? "there",
      otp,
    );

    if (!sent) {
      throw new AppError(
        "Failed to send reset email. Please try again.",
        500,
        "EMAIL_SEND_FAILED",
      );
    }

    logger.info("auth.forgotPassword", { userId: user.id, email: user.email });

    return {
      message: "If that email exists, a reset code has been sent.",
    };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    if (!PASSWORD_REGEX.test(newPassword)) {
      throw new ValidationError(
        "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        verificationOtp: true,
        verificationOtpExpiry: true,
      },
    });

    if (!user) {
      throw new NotFoundError("User");
    }

    if (!user.verificationOtp || !user.verificationOtpExpiry) {
      throw new ValidationError("No reset code requested.");
    }

    if (new Date() > user.verificationOtpExpiry) {
      throw new ValidationError("Reset code has expired. Request a new one.");
    }

    if (user.verificationOtp !== otp) {
      throw new ValidationError("Invalid reset code");
    }

    const hashed = await Bun.password.hash(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        verificationOtp: null,
        verificationOtpExpiry: null,
      },
    });

    logger.info("auth.resetPassword", { userId: user.id, email });

    return { message: "Password has been reset successfully." };
  }

  async issueWsToken(
    jwt: { sign: (opts: any) => Promise<string> },
    user: { id: string; email: string; role: string },
  ) {
    const interviewMins = user.role === "FREE" ? 15 : 30;
    const expirySecs = interviewMins + 3;
    const token = await jwt.sign({
      id: user.id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + expirySecs * 60,
    });
    return { token };
  }

  private async checkOtpRateLimit(
    email: string,
  ): Promise<{ allowed: boolean; retryAfter: number }> {
    const key = `${OTP_RATE_PREFIX}${email.toLowerCase().trim()}`;
    const ttl = await this.redis.ttl(key);
    if (ttl > 0) {
      return { allowed: false, retryAfter: ttl };
    }
    await this.redis.setEx(key, OTP_RATE_WINDOW, "1");
    return { allowed: true, retryAfter: 0 };
  }
}
