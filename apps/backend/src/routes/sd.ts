import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";
import { authGuard } from "../middleware/auth";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

interface SdCacheEntry {
  title: string;
  description: string;
  fullBreakdown: string;
  backupTitle: string;
  backupDescription: string;
  backupFullBreakdown: string;
  difficulty: string;
  dbQuestionId: string | null;
}

interface SdCacheMeta {
  entry: SdCacheEntry;
  createdAt: number;
  sessionIds: Set<string>;
}

const questionCache = new Map<string, SdCacheMeta>();
const CACHE_TTL_MS = 30 * 60_000;
const CACHE_MAX_ENTRIES = 100;
// LRU tracking for eviction
const cacheAccessOrder: string[] = [];

function evictIfNeeded() {
  if (questionCache.size < CACHE_MAX_ENTRIES) return;
  const oldest = cacheAccessOrder.shift();
  if (oldest) questionCache.delete(oldest);
}

function touchCacheKey(key: string) {
  const idx = cacheAccessOrder.indexOf(key);
  if (idx !== -1) cacheAccessOrder.splice(idx, 1);
  cacheAccessOrder.push(key);
}

function buildCacheKey(
  roleCategory: string | null,
  companyName: string | null,
  position: string | null,
): string {
  return `${roleCategory ?? "__none__"}::${companyName ?? "__none__"}::${position ?? "__none__"}`;
}

export function getSdQuestion(
  interviewId: string,
  roleCategory: string | null,
  companyName: string | null,
  position: string | null,
) {
  // First check by interviewId (direct match)
  for (const [, meta] of questionCache) {
    if (meta.sessionIds.has(interviewId)) {
      touchCacheKey(buildCacheKey(roleCategory, companyName, position));
      return meta.entry;
    }
  }
  return null;
}

export function cacheSdQuestion(
  interviewId: string,
  roleCategory: string | null,
  companyName: string | null,
  position: string | null,
  entry: SdCacheEntry,
) {
  const key = buildCacheKey(roleCategory, companyName, position);
  evictIfNeeded();

  const existing = questionCache.get(key);
  if (existing) {
    existing.sessionIds.add(interviewId);
    existing.entry = entry;
    existing.createdAt = Date.now();
    touchCacheKey(key);
    return;
  }

  questionCache.set(key, {
    entry,
    createdAt: Date.now(),
    sessionIds: new Set([interviewId]),
  });
  touchCacheKey(key);
}

export function clearSdQuestion(interviewId: string) {
  for (const [, meta] of questionCache) {
    meta.sessionIds.delete(interviewId);
    if (meta.sessionIds.size === 0) {
      // Cleanup happens via TTL check on next access
    }
  }
}

// Periodic cache cleanup — removes expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, meta] of questionCache) {
    if (now - meta.createdAt > CACHE_TTL_MS) {
      questionCache.delete(key);
      const idx = cacheAccessOrder.indexOf(key);
      if (idx !== -1) cacheAccessOrder.splice(idx, 1);
    }
  }
}, 60_000);

async function recordSeen(
  userId: string,
  questionId: string,
  interviewId: string,
) {
  await prisma.sdQuestionSeenByUser.upsert({
    where: { userId_questionId: { userId, questionId } },
    update: { seenAt: new Date(), interviewId },
    create: { userId, questionId, interviewId },
  });
}

async function pickFromDb(
  userId: string,
  companyName: string | null,
  position: string | null,
  roleCategory: string | null,
): Promise<(SdCacheEntry & { dbQuestionId: string }) | null> {
  const seenIds = (
    await prisma.sdQuestionSeenByUser.findMany({
      where: { userId },
      select: { questionId: true },
    })
  ).map((r) => r.questionId);

  const where: Record<string, unknown> = {};

  if (companyName) {
    where.companyName = companyName;
    if (position) where.position = position;
  }
  if (roleCategory) {
    where.roleCategory = roleCategory;
  }

  if (seenIds.length > 0) {
    where.id = { notIn: seenIds };
  }

  const pool = await prisma.systemDesignQuestion.findMany({ where });

  if (pool.length === 0) return null;

  const pick = pool[Math.floor(Math.random() * pool.length)]!;

  await prisma.systemDesignQuestion.update({
    where: { id: pick.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    title: pick.title,
    description: pick.description,
    fullBreakdown: pick.fullBreakdown,
    backupTitle: pick.backupTitle ?? "",
    backupDescription: pick.backupDescription ?? "",
    backupFullBreakdown: pick.backupFullBreakdown ?? "",
    difficulty: pick.interviewDepth,
    dbQuestionId: pick.id,
  };
}

function cacheEntry(
  title: string,
  description: string,
  fullBreakdown: string,
  backupTitle: string,
  backupDescription: string,
  backupFullBreakdown: string,
  difficulty: string,
  dbQuestionId: string | null,
): SdCacheEntry {
  return {
    title,
    description,
    fullBreakdown,
    backupTitle,
    backupDescription,
    backupFullBreakdown,
    difficulty,
    dbQuestionId,
  };
}

export const sdRoutes = new Elysia({ prefix: "/sd" })
  .use(authGuard)
  .guard({}, (app) =>
    app.post(
      "/start",
      async ({ user, body, set }) => {
        const { interviewId } = body;

        const interview = await prisma.interviewSession.findUnique({
          where: { id: interviewId },
        });
        if (!interview || interview.userId !== user.id) {
          set.status = 404;
          return { error: "Interview not found" };
        }
        if (interview.mode !== "LIVE_CANVAS") {
          set.status = 400;
          return { error: "Interview is not in SYSTEM_DESIGN mode" };
        }

        const companyName = interview.companyName ?? null;
        const position = interview.position ?? null;
        const roleCategory =
          (interview as { roleCategory?: string | null }).roleCategory ?? null;

        // 1. In-memory cache hit
        const existing = getSdQuestion(
          interviewId,
          roleCategory,
          companyName,
          position,
        );
        if (existing) {
          return {
            title: existing.title,
            description: existing.description,
            fullBreakdown: existing.fullBreakdown,
            difficulty: existing.difficulty,
          };
        }

        // 2. Try DB — pick a question the user hasn't seen
        const fromDb = await pickFromDb(
          user.id,
          companyName,
          position,
          roleCategory,
        );
        if (fromDb) {
          cacheSdQuestion(
            interviewId,
            roleCategory,
            companyName,
            position,
            fromDb,
          );
          await recordSeen(user.id, fromDb.dbQuestionId, interviewId);
          return {
            title: fromDb.title,
            description: fromDb.description,
            fullBreakdown: fromDb.fullBreakdown,
            difficulty: fromDb.difficulty,
          };
        }

        // 3. Generate via Gemini
        const company = companyName || "a top tech company";
        const role = position || "a senior engineering role";
        const depth =
          (interview as { interviewDepth?: string }).interviewDepth ||
          "PROBING";
        const style =
          (interview as { interviewStyle?: string }).interviewStyle ||
          "PROFESSIONAL";

        const categoryContext = roleCategory
          ? `\nCategory: ${roleCategory} — tailor the question to this domain.`
          : "";
        const generationPrompt = `Generate TWO distinct system design interview questions for ${company} for the role of ${role}. The second is a backup if the candidate has seen the first one.${categoryContext}

Depth: ${depth} — ${
          depth === "STANDARD"
            ? "pick a moderately complex system. Focus on core architecture."
            : depth === "PROBING"
              ? "pick a system with multiple interacting services or real-time constraints."
              : depth === "CHALLENGE"
                ? "pick a complex system with geo-distribution or data pipelines."
                : "pick an elite-level system. Multi-region, distributed consensus, or ML at scale."
        }

Style: ${style} — ${
          style === "SUPPORTIVE"
            ? "conversational and encouraging."
            : style === "CHALLENGING"
              ? "high-pressure, push for depth."
              : style === "BAR_RAISER"
                ? "surgical and precise."
                : "structured and neutral."
        }

The two questions MUST be on different domains (e.g., not both social media). The backup should be a completely different type of system.

Return ONLY valid JSON with this exact schema:
{
  "primary": {
    "title": "A specific, clear title for the design problem",
    "description": "2-3 sentence description of the system to design, with rough scale",
    "fullBreakdown": "Detailed markdown with sections: Functional Requirements (bullet list), Non-Functional Requirements (specific targets), High-Level Sketch (ASCII architecture diagram), Database (key tables/entities), APIs (key endpoints with request/response shapes). Adapt sections to the question — some may not need a DB section, others might need additional sections. Do NOT repeat or summarize the description — start directly with the detailed sections.",
  },
  "backup": {
    "title": "A different system design problem",
    "description": "2-3 sentence description",
    "fullBreakdown": "Same structure as primary, no intro or summary."
  }
}

For example: 

Display Leaderboards: Allow users to view global rankings based on multiple metrics (e.g., points, wins, time played).
Real-time Updates: When a player's score changes, their ranking should update quickly, ideally within seconds.
Player-specific View: Users should be able to query their own rank and their immediate neighbors (e.g., +/- 10 ranks around them).
Query Top N: Support querying the top N players for any given metric.
Support for Multiple Games/Contexts: While we can start with a single global leaderboard, the design should ideally be extensible for different game contexts or regions.
Sorting Flexibility: Leaderboards should support various sorting orders (e.g., highest score first, lowest time first, based on game rules).
Non-Functional Requirements
Availability: High availability (e.g., 99.99%) for leaderboard queries – it must almost always be accessible.
Latency:
Query latency for top N players: extremely low (e.g., <100ms for P99).
Query latency for a player's own rank/neighbors: equally fast.
Update propagation latency: ideally under 5 seconds from score change to leaderboard reflection.
Scalability:
Handle millions of concurrent users querying the leaderboard.
Process millions of score updates per second during peak times.
Consistency: Eventual consistency is acceptable for rankings, but updates should propagate quickly and gracefully.
Durability: Player scores and rankings must be durable and resistant to data loss.
Fault Tolerance: The system should gracefully handle failures of individual components without significant impact on service.
High-Level Sketch
Let's envision the core components and their interactions:

+------------+
|  Game      |
|  Clients/  |
|  Servers   |
+------------+
      |
      | (Score Updates)
      V
+---------------------+
|  Score Ingestion    |
|  Service (REST/gRPC)|
+---------------------+
      | (Batch/Stream)
      V
+----------------+
| Message Queue  |
| (e.g., Kafka,  |
|  Pub/Sub)      |
+----------------+
      |
      | (Stream of Scores)
      V
+--------------------+
| Ranking Processor  |
| (Aggregates, Ranks)|
+--------------------+
      |        |
      |        | (Updates/Persist)
      |        V
      |   +---------------------+
      |   | Persistent Data     |
      |   | Store (e.g.,       |
      |   | Cassandra, Bigtable)|
      |   +---------------------+
      V
+--------------------------+
|  Leaderboard Data Store  |
| (e.g., Redis Sorted Sets)|
+--------------------------+
      ^ (Queries)
      |
+--------------+
|  API Gateway |
| (Leaderboard |
|   Queries)   |
+--------------+
      ^ (Queries)
      |
+-----------------+
|  Load Balancer  |
+-----------------+
      ^ (Queries)
      |
+-------------+
|  Web/Mobile |
|   Clients   |
+-------------+
Database
Let's consider two main data stores:

Leaderboard Data Store (for real-time queries):

Purpose: Optimized for fast retrieval of sorted lists (top N, player's rank, neighbors).
Technology: Key-value store with sorted set capabilities (e.g., Redis Sorted Sets).
Structure:
Key: leaderboard:{metric_name} (e.g., leaderboard:points, leaderboard:wins)
Value: A sorted set where members are player_id and their scores are the actual game score.
This structure allows for efficient ZRANGE (get top N), ZREVRANK (get a player's rank), and ZRANGEBYSCORE (get players around a score/rank).
Persistent Data Store (for raw player data and historical scores):

Purpose: Durable storage for all player information, current scores, and possibly historical score changes.
Technology: NoSQL database like Cassandra, Google Cloud Bigtable, or DynamoDB (for high write throughput and scale) or a sharded SQL database.
Key Entities/Tables:
players table/collection:
player_id (Primary Key)
username
avatar_url
current_points (updated by the ranking processor)
current_wins
last_updated_at
Other player metadata.
score_history table/collection (optional, for auditing or analytics):
entry_id (Primary Key)
player_id (Foreign Key)
game_id
metric_type (e.g., 'points', 'wins')
score_change
new_score_value
timestamp
APIs
Here are some key API endpoints players/clients or game servers would interact with:

Player Score Update (from Game Servers/Clients):

POST /v1/scores
Purpose: To submit score changes for a player.
Request Body:
{
  "player_id": "string",
  "game_id": "string",
  "metric_updates": [
    {
      "metric_name": "points",
      "value": 150,
      "operation": "INCREMENT" // or "SET"
    },
    {
      "metric_name": "wins",
      "value": 1,
      "operation": "INCREMENT"
    }
  ],
  "timestamp": "ISO-8601 string"
}
Response Body:
{
  "status": "success",
  "message": "Score update received and queued for processing."
}
Get Top N Players on a Leaderboard:

GET /v1/leaderboards/{metric_name}/top?count={N}
Purpose: Retrieve the top N players for a specific metric.
Path Parameters:
metric_name: (e.g., 'points', 'wins')
Query Parameters:
count: (integer, default 100, max 1000)
Response Body:
{
  "metric_name": "points",
  "timestamp": "ISO-8601 string",
  "players": [
    {
      "rank": 1,
      "player_id": "player123",
      "username": "EliteGamer",
      "score": 99999
    },
    {
      "rank": 2,
      "player_id": "player456",
      "username": "ProKiller",
      "score": 98765
    }
    // ... more players ...
  ]
}
Get Player's Rank and Neighbors:

GET /v1/leaderboards/{metric_name}/player/{player_id}/neighbors?range={R}
Purpose: Get a specific player's rank and the players immediately around them.
Path Parameters:
metric_name: (e.g., 'points', 'wins')
player_id: (string)
Query Parameters:
range: (integer, default 5, meaning +/- 5 ranks)
Response Body:
{
  "metric_name": "points",
  "player_id": "player789",
  "current_rank": 50,
  "current_score": 12345,
  "neighbors": [
    {
      "rank": 45,
      "player_id": "neighborA",
      "username": "GoodPlayer",
      "score": 12500
    },
    // ... up to 2*R players above ...
    {
      "rank": 50,
      "player_id": "player789",
      "username": "YourName",
      "score": 12345
    },
    // ... up to 2*R players below ...
    {
      "rank": 51,
      "player_id": "neighborB",
      "username": "OkayPlayer",
      "score": 12300
    }
  ]
}
This is a foundational overview. Feel free to dive deeper into any of these areas, or bring up aspects you think are crucial for a robust design!

`;

        let parsed: {
          primary: {
            title: string;
            description: string;
            fullBreakdown: string;
          };
          backup: { title: string; description: string; fullBreakdown: string };
        };
        try {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: generationPrompt }] }],
            config: {
              responseMimeType: "application/json",
            },
          });

          const text = response.text;
          if (!text) throw new Error("Empty response from Gemini");
          parsed = JSON.parse(text);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[sd/start] generation failed:", message);
          set.status = 500;
          return { error: "Failed to generate question" };
        }

        if (
          !parsed.primary?.title ||
          !parsed.primary?.description ||
          !parsed.primary?.fullBreakdown ||
          !parsed.backup?.title ||
          !parsed.backup?.description ||
          !parsed.backup?.fullBreakdown
        ) {
          set.status = 500;
          return { error: "Generated question missing required fields" };
        }

        // Persist to DB for future reuse
        const saved = await prisma.systemDesignQuestion.create({
          data: {
            companyName,
            position,
            roleCategory,
            interviewDepth: depth as never,
            interviewStyle: style as never,
            title: parsed.primary.title,
            description: parsed.primary.description,
            fullBreakdown: parsed.primary.fullBreakdown,
            backupTitle: parsed.backup.title,
            backupDescription: parsed.backup.description,
            backupFullBreakdown: parsed.backup.fullBreakdown,
          },
        });

        const entry = cacheEntry(
          parsed.primary.title,
          parsed.primary.description,
          parsed.primary.fullBreakdown,
          parsed.backup.title,
          parsed.backup.description,
          parsed.backup.fullBreakdown,
          depth,
          saved.id,
        );

        cacheSdQuestion(
          interviewId,
          roleCategory,
          companyName,
          position,
          entry,
        );
        await recordSeen(user.id, saved.id, interviewId);

        return {
          title: entry.title,
          description: entry.description,
          fullBreakdown: entry.fullBreakdown,
          difficulty: entry.difficulty,
        };
      },
      {
        body: t.Object({
          interviewId: t.String(),
        }),
      },
    ),
  );
