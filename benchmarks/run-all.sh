#!/usr/bin/env bash
# Evalio — All Benchmarks Runner
# Usage: bash benchmarks/run-all.sh
#   DATABASE_URL  — Postgres connection string (default: localhost)
#   PORT          — Backend port for API benchmarks (default: 3000)
#
# Output: benchmarks/RESULTS.md — full run report.

set -euo pipefail

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:mysecretpassword@localhost:5432/postgres}"
export PORT="${PORT:-3000}"

RESULTS="benchmarks/RESULTS.md"
NOW="$(date -u '+%Y-%m-%d %H:%M:%S UTC')"
UNAME="$(uname -a | head -c 120)"

# Check if backend is reachable
BACKEND_UP=false
if curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
  BACKEND_UP=true
fi

mkdir -p "$(dirname "$RESULTS")"

cat > "$RESULTS" <<EOF
# Benchmark Results

**Generated:** ${NOW}
**System:** ${UNAME}
**Database:** \`${DATABASE_URL}\`
**Backend:** $([ "$BACKEND_UP" = true ] && echo "reachable at :${PORT}" || echo "not running (API tests skipped)")

\`\`\`
EOF

run() {
  local label="$1"
  local script="$2"

  echo "" >> "$RESULTS"
  echo "──────────────────────────────────────────" >> "$RESULTS"
  echo "  $label" >> "$RESULTS"
  echo "──────────────────────────────────────────" >> "$RESULTS"

  echo ""
  echo "──────────────────────────────────────────"
  echo "  $label"
  echo "──────────────────────────────────────────"

  bun run "$script" 2>&1 | tee -a "$RESULTS"

  echo "" >> "$RESULTS"
}

run "1. Database Query Performance"  benchmarks/01-db-queries.ts

if [ "$BACKEND_UP" = true ]; then
  run "2. API Latency & Peak Load"   benchmarks/02-api-peak-load.ts
else
  echo "──────────────────────────────────────────" >> "$RESULTS"
  echo "  2. API Latency & Peak Load — SKIPPED" >> "$RESULTS"
  echo "  Start the backend and re-run to include." >> "$RESULTS"
  echo "──────────────────────────────────────────" >> "$RESULTS"
  echo ""
  echo "──────────────────────────────────────────"
  echo "  2. API Latency & Peak Load — SKIPPED"
  echo "  Start the backend: cd apps/backend && bun run index.ts"
  echo "──────────────────────────────────────────"
fi

run "3. Cache Circuit Breaker"        benchmarks/03-circuit-breaker.ts
run "4. Graceful Degradation"         benchmarks/04-graceful-degradation.ts

# Close code block + summary
{
  echo "\`\`\`"
  echo ""
  echo "---"
  echo ""
  echo "_All benchmarks reproducible via \`bash benchmarks/run-all.sh\`. See [README.md](../README.md#benchmarks) for interpretation._"
} >> "$RESULTS"

SIZE="$(wc -c < "$RESULTS")"
echo ""
echo "──────────────────────────────────────────"
echo "  ✓ Results written to $RESULTS (${SIZE}B)"
echo "──────────────────────────────────────────"
