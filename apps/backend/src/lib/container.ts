import { prisma } from "./prisma";
import { redisSubscriber } from "./redis";
import * as tokens from "../lib/tokens";
import * as email from "../lib/email";
import * as loginAttempt from "../lib/loginAttempt";
import * as s3 from "../lib/s3";
import * as resumeParser from "../utils/ResumeParser";
import {
  AuthService,
  type TokenService,
  type EmailService,
  type LoginAttemptService,
} from "../services/auth";
import { InterviewService } from "../services/interview";
import { ResumeService } from "../services/resume";
import { QuestionService } from "../services/question";
import { SystemDesignService } from "../services/sd";
import { DsaService } from "../services/dsa";
import { QuantService } from "../services/quant";
import { SqlService } from "../services/sql";
import { EvaluateService } from "../services/evaluate";
import { FeedbackService } from "../services/feedback";
import { ContactService } from "../services/contact";
import { TurnService } from "../services/turn";
import { CompanyService } from "../services/company";
import { UserService } from "../services/user";
import { GithubService } from "../services/github";
import { AnalysisService } from "../services/analysis";
import { ProfileService } from "../services/profile";

const tokenService: TokenService = {
  signAccessToken: tokens.signAccessToken,
  signRefreshToken: tokens.signRefreshToken,
  verifyRefreshToken: tokens.verifyRefreshToken,
};

const emailService: EmailService = {
  sendOtpEmail: email.sendOtpEmail,
  sendWelcomeEmail: email.sendWelcomeEmail,
  sendResetOtpEmail: email.sendResetOtpEmail,
};

const loginAttemptService: LoginAttemptService = {
  recordFailedAttempt: loginAttempt.recordFailedAttempt,
  isAccountLocked: loginAttempt.isAccountLocked,
  getLockoutRemaining: loginAttempt.getLockoutRemaining,
  clearFailedAttempts: loginAttempt.clearFailedAttempts,
};

export const container = {
  auth: new AuthService(
    prisma,
    tokenService,
    emailService,
    loginAttemptService,
    redisSubscriber,
  ),
  interview: new InterviewService(prisma),
  resume: new ResumeService(
    prisma,
    s3.uploadResumeToS3,
    s3.generateResumeUrl,
    resumeParser.parseResume,
    resumeParser.validateResumeContent,
  ),
  question: new QuestionService(prisma),
  sd: new SystemDesignService(prisma),
  dsa: new DsaService(prisma),
  quant: new QuantService(prisma),
  sql: new SqlService(prisma),
  evaluate: new EvaluateService(prisma),
  feedback: new FeedbackService(prisma),
  contact: new ContactService(),
  turn: new TurnService(prisma),
  company: new CompanyService(),
  user: new UserService(prisma),
  github: new GithubService(prisma),
  analysis: new AnalysisService(prisma),
  profile: new ProfileService(),
};
