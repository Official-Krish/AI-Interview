import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { authGuard } from "../middleware/auth";
import { strictRateLimit, authRateLimit } from "../middleware/rateLimit";
import { uploadResumeToS3, generateResumeUrl } from "../lib/s3";
import { parseResume, validateResumeContent } from "../utils/ResumeParser";
import { randomUUID } from "node:crypto";
import { withIdempotency } from "../middleware/idempotency";

const ALLOWED_EXTENSIONS = ["pdf", "docx", "txt"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  pdf: [new Uint8Array([0x25, 0x50, 0x44, 0x46])], // %PDF
  docx: [new Uint8Array([0x50, 0x4b, 0x03, 0x04])], // PK\x03\x04 (ZIP)
};

function getExtension(filename: string): string | null {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? null : filename.slice(dot + 1).toLowerCase();
}

function validateMagicBytes(ext: string, buffer: Buffer): boolean {
  const magicList = MAGIC_BYTES[ext];
  if (!magicList) return true; // no magic check for txt
  return magicList.some((magic) =>
    magic.every((byte, i) => buffer[i] === byte),
  );
}

export const resumeRoutes = new Elysia({ prefix: "/resumes" }).guard(
  {},
  (app) =>
    app
      .use(authGuard)
      .guard({}, (g) =>
        g.use(strictRateLimit).post(
          "/upload",
          withIdempotency(async ({ user, body, set }: any) => {
            const file = body.file;
            if (!file || !file.name) {
              set.status = 400;
              return { error: "No file provided" };
            }

            const ext = getExtension(file.name);
            if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
              set.status = 400;
              return { error: "Only PDF, DOCX, and TXT files are allowed" };
            }

            if (file.size > MAX_FILE_SIZE) {
              set.status = 400;
              return { error: "File size must be under 10 MB" };
            }

            const buffer = Buffer.from(await file.arrayBuffer());

            if (!validateMagicBytes(ext, buffer)) {
              set.status = 400;
              return { error: "File content does not match its extension" };
            }

            const extractedText = await parseResume(buffer, file.name);

            const validation = validateResumeContent(
              extractedText,
              user.name ?? undefined,
            );
            if (!validation.valid) {
              set.status = 400;
              return { error: validation.error! };
            }

            const contentType = MIME_MAP[ext] ?? "application/octet-stream";

            const existing = await prisma.resume.findFirst({
              where: { userId: user.id },
              orderBy: { version: "desc" },
              select: { version: true },
            });
            const nextVersion = (existing?.version ?? 0) + 1;

            const resumeUuid = randomUUID();

            const result = await uploadResumeToS3({
              userId: user.id,
              resumeUuid,
              version: nextVersion,
              fileName: file.name,
              fileBuffer: buffer,
              mimeType: contentType,
            });

            if ("error" in result) {
              set.status = 500;
              return { error: result.error };
            }

            const resume = await prisma.resume.create({
              data: {
                userId: user.id,
                version: nextVersion,
                objectKey: result.key,
                extractedText,
              },
            });

            return {
              resume: {
                ...resume,
                url: generateResumeUrl(result.key),
              },
            };
          }),
          {
            body: t.Object({
              file: t.File(),
            }),
          },
        ),
      )
      .get("/", async ({ user }) => {
        const resumes = await prisma.resume.findMany({
          where: { userId: user.id },
          orderBy: { version: "desc" },
        });
        return {
          resumes: resumes.map((r) => ({
            ...r,
            url: r.objectKey ? generateResumeUrl(r.objectKey) : null,
          })),
        };
      })
      .guard({}, (g) =>
        g
          .use(authRateLimit)
          .get("/:id/url", async ({ params: { id }, user, set }) => {
            const resume = await prisma.resume.findUnique({
              where: { id },
              select: { userId: true, objectKey: true },
            });
            if (!resume || resume.userId !== user.id) {
              set.status = 404;
              return { error: "Resume not found" };
            }
            if (!resume.objectKey) {
              set.status = 404;
              return { error: "Resume not found" };
            }
            return { url: generateResumeUrl(resume.objectKey) };
          }),
      ),
);
