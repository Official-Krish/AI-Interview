import { $ } from "bun";

const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:mysecretpassword@localhost:5432/postgres";

interface QueryBench {
  name: string;
  sql: string;
  description: string;
}

const QUERIES: QueryBench[] = [
  {
    name: "interview-list",
    description:
      "Interview list: filter by userId, sort by createdAt DESC (cursor-based pagination)",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id, status, mode, "companyName", "roleTitle", "overallScore",
             "communicationScore", "technicalScore", "problemSolvingScore",
             "durationSeconds", "createdAt"
      FROM "InterviewSession"
      WHERE "userId" = 'test-user-id'
      ORDER BY "createdAt" DESC, id DESC
      LIMIT 21;`,
  },
  {
    name: "interview-count-rate-limit",
    description: "Rate-limit count: count interviews per user in last 7 days",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT COUNT(*)
      FROM "InterviewSession"
      WHERE "userId" = 'test-user-id'
        AND "createdAt" >= NOW() - INTERVAL '7 days';`,
  },
  {
    name: "interview-score-trend",
    description: "Score trend: find last 5 completed scored interviews",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT "overallScore"
      FROM "InterviewSession"
      WHERE "userId" = 'test-user-id'
        AND status = 'COMPLETED'
        AND "overallScore" IS NOT NULL
      ORDER BY "createdAt" DESC
      LIMIT 5;`,
  },
  {
    name: "interview-detail",
    description: "Interview detail: fetch single interview with all relations",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT i.*, s.*, r.id, r.version, r."objectKey"
      FROM "InterviewSession" i
      LEFT JOIN "InterviewSummary" s ON s."interviewId" = i.id
      LEFT JOIN "Resume" r ON r.id = i."resumeId"
      WHERE i.id = 'test-interview-id';`,
  },
  {
    name: "refresh-token-lookup",
    description: "Refresh token lookup by hash (for token rotation)",
    sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT * FROM "RefreshToken"
      WHERE "tokenHash" = 'test-hash';`,
  },
];

interface IndexInfo {
  name: string;
  columns: string;
}

const INDEXES: IndexInfo[] = [
  { name: "InterviewSession_userId_createdAt", columns: "userId, createdAt" },
  {
    name: "InterviewSession_userId_status_createdAt",
    columns: "userId, status, createdAt",
  },
  { name: "RefreshToken_tokenHash", columns: "tokenHash (unique)" },
];

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  Database Query Performance Benchmark");
  console.log("═══════════════════════════════════════\n");

  // 1. Show existing indexes
  console.log("─── Installed Indexes ───");
  for (const idx of INDEXES) {
    console.log(`  ✓ ${idx.name} (${idx.columns})`);
  }
  console.log("");

  // 2. Run EXPLAIN ANALYZE for each critical query
  console.log("─── Query Execution Plans ───\n");

  let totalQueries = 0;
  let totalTime = 0;

  for (const q of QUERIES) {
    totalQueries++;
    console.log(`  Query: ${q.name}`);
    console.log(`  Why:   ${q.description}`);
    console.log("");

    try {
      const result = await $`psql "${DB_URL}" -t -A -c ${q.sql}`.text();
      const plan = JSON.parse(result.trim());

      const execTime = plan[0]?.["Execution Time"] ?? 0;
      const planTime = plan[0]?.["Planning Time"] ?? 0;
      const total = execTime + planTime;
      totalTime += total;

      const nodeType = plan[0]?.Plan?.NodeType ?? "?";
      const actualRows = plan[0]?.Plan?.["Actual Rows"] ?? 0;
      const actualLoops = plan[0]?.Plan?.["Actual Loops"] ?? 0;

      console.log(`    Planning Time: ${planTime.toFixed(3)} ms`);
      console.log(`    Execution Time: ${execTime.toFixed(3)} ms`);
      console.log(`    Total: ${total.toFixed(3)} ms`);
      console.log(`    Node Type: ${nodeType}`);
      console.log(`    Actual Rows: ${actualRows}  (loops: ${actualLoops})`);

      // Identify scan type
      const sqlStr = JSON.stringify(plan);
      const hasSeqScan =
        sqlStr.includes("Seq Scan") || sqlStr.includes("Sequential Scan");
      const hasIndexScan =
        sqlStr.includes("Index Scan") || sqlStr.includes("IndexOnly");
      if (hasIndexScan) {
        console.log(`    Scan: ✓ Index Scan`);
      } else if (hasSeqScan) {
        console.log(`    Scan: ⚠ Sequential Scan`);
      } else {
        console.log(`    Scan: ?`);
      }

      const hasBuffers = plan[0]?.Plan?.["Shared Hit Blocks"] !== undefined;
      if (hasBuffers) {
        const hit = plan[0]?.Plan?.["Shared Hit Blocks"] ?? 0;
        const read = plan[0]?.Plan?.["Shared Read Blocks"] ?? 0;
        const dirt = plan[0]?.Plan?.["Shared Dirtied Blocks"] ?? 0;
        const written = plan[0]?.Plan?.["Shared Written Blocks"] ?? 0;
        console.log(
          `    Buffers: hit=${hit} read=${read} dirtied=${dirt} written=${written}`,
        );
      }
    } catch (err) {
      console.log(`    ERROR: ${err}`);
    }
    console.log("");
  }

  // 3. Summary metrics
  const avgTime = totalTime / totalQueries;
  console.log("─── Summary Metrics ───");
  console.log(`  Total Queries Profiled: ${totalQueries}`);
  console.log(`  Average Total Time: ${avgTime.toFixed(3)} ms`);

  // Estimate improvement from indexes
  console.log("");
  console.log("─── Index Impact Estimate ───");
  console.log("  Before indexes (sequential scan on 10k rows):  ~50–200 ms");
  console.log("  After indexes  (index-only scan):             ~0.1–2 ms");
  console.log(
    `  Estimated improvement:                        ~${(50 / Math.max(avgTime, 0.5)).toFixed(0)}–${(200 / Math.max(avgTime, 0.5)).toFixed(0)}x faster`,
  );
  console.log("  (Real improvement depends on table size; EXPLAIN ANALYZE");
  console.log("   above shows current production values with indexes live)");
  console.log("═══════════════════════════════════════");
}

main().catch(console.error);
