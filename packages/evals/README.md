# evals

Regression harness for the Evalio memory system. Each eval imports the **real**
production services (`@evalio/ai`, `@evalio/memory`, `@evalio/prompts`, `@evalio/db`)
and runs them against a dedicated Postgres + pgvector database.

## Setup

```bash
# One-time: create the eval database and apply migrations
docker exec evalio-postgres psql -U postgres -c "CREATE DATABASE evalio_evals;"
DATABASE_URL="postgresql://postgres:mysecretpassword@localhost:5432/evalio_evals" \
  bun --bun run prisma migrate deploy   # from packages/db
```

`packages/evals/.env` (gitignored) must contain:

```
DATABASE_URL="postgresql://postgres:mysecretpassword@localhost:5432/evalio_evals"
NVIDIA_API_KEY=...
GEMINI_API_KEY=...
```

## Run

```bash
bun test          # from packages/evals
```

## Evals

| Eval                   | File                                 | What it tests                                                                                        | AI required          |
| ---------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------- |
| 1 Memory extraction    | `evals/memory-extraction.test.ts`    | `extractMemoriesFromInterview` produces grounded SEMANTIC memories, no hallucination                 | Nemotron + Gemini    |
| 2 Memory retrieval     | `evals/memory-retrieval.test.ts`     | `retrieveMemories` precision@k, recall@k, MRR                                                        | Gemini embed         |
| 3 Question dedup       | `evals/question-dedup.test.ts`       | exact/normalized + semantic duplicate detection                                                      | Gemini embed         |
| 4 Adaptive questioning | `evals/adaptive-questioning.test.ts` | Nemotron judges prompt-builder output (memory usage, weakness targeting, non-repetition, difficulty) | Nemotron             |
| 5 Memory evolution     | `evals/memory-updates.test.ts`       | `applyEvidence` confidence trajectory 0.8 -> 0.34, status -> IMPROVING                               | none (deterministic) |

## Rate limits

NVIDIA free tier is ~40 RPM. Evals run sequentially per file and only make a
handful of Nemotron calls (1 extraction + 2 judge calls). Evals 1 and 4
**skip automatically** when `NVIDIA_API_KEY` is absent; Evals 2 and 3 skip when
`GEMINI_API_KEY` is absent — so `bun test` stays green in CI without keys.
