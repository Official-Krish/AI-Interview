-- Resize Memory.embedding from vector(768) to vector(3072) to match the
-- gemini-embedding-001 model (text-embedding-004 is no longer available).
ALTER TABLE "Memory"
  ALTER COLUMN embedding TYPE vector(3072)
  USING embedding::vector(3072);
