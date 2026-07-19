import { SignJWT, jwtVerify } from "jose";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "./prisma";

const ACCESS_SECRET = Bun.env.JWT_SECRET;
const REFRESH_SECRET = Bun.env.REFRESH_TOKEN_SECRET ?? Bun.env.JWT_SECRET;
if (!ACCESS_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const encoder = new TextEncoder();
const accessKey = encoder.encode(ACCESS_SECRET);
const refreshKey = encoder.encode(REFRESH_SECRET);

const ACCESS_EXPIRY = "15m";
const REFRESH_EXPIRY = "7d";
const REFRESH_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
const ISSUER = "evalio";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type AccessPayload = {
  id: string;
  email: string;
  name?: string | null;
  role: "FREE" | "PRO" | "ADMIN";
  roleVersion: number;
};

export type RefreshPayload = {
  id: string;
  email: string;
  familyId: string;
  tokenId: string;
};

export async function signAccessToken(user: AccessPayload): Promise<string> {
  return new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roleVersion: user.roleVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(ACCESS_EXPIRY)
    .sign(accessKey);
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessPayload | null> {
  try {
    const { payload } = await jwtVerify(token, accessKey, {
      issuer: ISSUER,
    });
    if (
      typeof payload.id === "string" &&
      typeof payload.email === "string" &&
      typeof payload.role === "string"
    ) {
      return {
        id: payload.id,
        email: payload.email,
        name: payload.name as string | undefined,
        role: payload.role as AccessPayload["role"],
        roleVersion: (payload.roleVersion as number) ?? 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function signRefreshToken(
  user: AccessPayload,
  familyId?: string,
): Promise<{
  token: string;
  familyId: string;
  tokenId: string;
  expiresAt: Date;
}> {
  const fid = familyId ?? randomUUID();
  const tid = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_SECONDS * 1000);

  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    familyId: fid,
    tokenId: tid,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(REFRESH_EXPIRY)
    .sign(refreshKey);

  const tokenHash = hashToken(token);

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId: user.id,
      familyId: fid,
      expiresAt,
    },
  });

  return { token, familyId: fid, tokenId: tid, expiresAt };
}

export async function verifyRefreshToken(
  token: string,
): Promise<RefreshPayload | null> {
  try {
    const { payload } = await jwtVerify(token, refreshKey, {
      issuer: ISSUER,
    });
    if (
      typeof payload.id === "string" &&
      typeof payload.email === "string" &&
      typeof payload.familyId === "string" &&
      typeof payload.tokenId === "string"
    ) {
      return {
        id: payload.id,
        email: payload.email,
        familyId: payload.familyId,
        tokenId: payload.tokenId,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function rotateRefreshToken(oldToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  familyId: string;
} | null> {
  const payload = await verifyRefreshToken(oldToken);
  if (!payload) return null;

  const tokenHash = hashToken(oldToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!stored) return null;

  // REPLAY DETECTED: token was already used (revoked) → theft in progress
  if (stored.revokedAt) {
    await revokeTokenFamily(stored.familyId);
    return null;
  }

  if (stored.userId !== payload.id) return null;

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  // Fetch user for new access token payload
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      roleVersion: true,
    },
  });
  if (!user) return null;

  const accessToken = await signAccessToken(user);

  const newTokens = await signRefreshToken(user, stored.familyId);

  return {
    accessToken,
    refreshToken: newTokens.token,
    familyId: stored.familyId,
  };
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeTokenFamily(familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export { hashToken };
