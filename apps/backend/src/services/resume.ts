import type { PrismaClient } from "@evalio/db";
import { ValidationError, AppError } from "../lib/errors";
import { randomUUID } from "node:crypto";

const ALLOWED_EXTENSIONS = ["pdf", "docx", "txt"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  pdf: [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
  docx: [new Uint8Array([0x50, 0x4b, 0x03, 0x04])],
};

export interface UploadToS3Fn {
  (opts: {
    userId: string;
    resumeUuid: string;
    version: number;
    fileName: string;
    fileBuffer: Buffer;
    mimeType: string;
  }): Promise<{ key: string } | { error: string }>;
}

export interface GenerateUrlFn {
  (objectKey: string): string | null;
}

export interface ParseResumeFn {
  (buffer: Buffer, fileName: string): Promise<string>;
}

export interface ValidateContentFn {
  (
    text: string,
    userName: string | undefined,
  ): { valid: boolean; error?: string };
}

function getExtension(filename: string): string | null {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? null : filename.slice(dot + 1).toLowerCase();
}

function validateMagicBytes(ext: string, buffer: Buffer): boolean {
  const magicList = MAGIC_BYTES[ext];
  if (!magicList) return true;
  return magicList.some((magic) =>
    magic.every((byte, i) => buffer[i] === byte),
  );
}

export class ResumeService {
  constructor(
    private prisma: PrismaClient,
    private uploadToS3: UploadToS3Fn,
    private generateUrl: GenerateUrlFn,
    private parseResume: ParseResumeFn,
    private validateContent: ValidateContentFn,
  ) {}

  async upload(
    userId: string,
    userName: string | null | undefined,
    file: File,
  ) {
    if (!file || !file.name) {
      throw new ValidationError("No file provided");
    }

    const ext = getExtension(file.name);
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      throw new ValidationError("Only PDF, DOCX, and TXT files are allowed");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError("File size must be under 10 MB");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!validateMagicBytes(ext, buffer)) {
      throw new ValidationError("File content does not match its extension");
    }

    const extractedText = await this.parseResume(buffer, file.name);

    const validation = this.validateContent(
      extractedText,
      userName ?? undefined,
    );
    if (!validation.valid) {
      throw new ValidationError(validation.error!);
    }

    const contentType = MIME_MAP[ext] ?? "application/octet-stream";

    const existing = await this.prisma.resume.findFirst({
      where: { userId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (existing?.version ?? 0) + 1;

    const resumeUuid = randomUUID();

    const result = await this.uploadToS3({
      userId,
      resumeUuid,
      version: nextVersion,
      fileName: file.name,
      fileBuffer: buffer,
      mimeType: contentType,
    });

    if ("error" in result) {
      throw new AppError(result.error, 500, "S3_UPLOAD_FAILED");
    }

    const resume = await this.prisma.resume.create({
      data: {
        userId,
        version: nextVersion,
        objectKey: result.key,
        extractedText,
      },
    });

    return {
      resume: {
        ...resume,
        url: this.generateUrl(result.key),
      },
    };
  }

  async list(userId: string) {
    const resumes = await this.prisma.resume.findMany({
      where: { userId },
      orderBy: { version: "desc" },
    });

    return {
      resumes: resumes.map((r) => ({
        ...r,
        url: r.objectKey ? this.generateUrl(r.objectKey) : null,
      })),
    };
  }

  async getUrl(id: string, userId: string) {
    const resume = await this.prisma.resume.findUnique({
      where: { id },
      select: { userId: true, objectKey: true },
    });

    if (!resume || resume.userId !== userId || !resume.objectKey) {
      throw new AppError("Resume not found", 404, "NOT_FOUND");
    }

    return { url: this.generateUrl(resume.objectKey) };
  }
}
