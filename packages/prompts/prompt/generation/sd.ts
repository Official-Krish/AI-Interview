export function buildSdGenerationPrompt(params: {
  company: string;
  role: string;
  categoryContext: string;
  depth: string;
  depthDirective: string;
  style: string;
  styleDirective: string;
}): string {
  return `Generate TWO distinct system design interview questions for ${params.company} for the role of ${params.role}. The second is a backup if the candidate has seen the first one.${params.categoryContext}

Depth: ${params.depth} — ${params.depthDirective}

Style: ${params.style} — ${params.styleDirective}

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
      "operation": "INCREMENT"
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
    {
      "rank": 50,
      "player_id": "player789",
      "username": "YourName",
      "score": 12345
    },
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
}
