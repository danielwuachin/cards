#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://api.danviviendo.com}"
OUT_FILE="load-balancing-evidence.md"

if ! command -v hey >/dev/null 2>&1; then
  echo "hey no está instalado. Instálalo con: brew install hey" >&2
  exit 1
fi

echo "Generando evidencia contra $BASE_URL ..."

HEY_OUTPUT=$(hey -n 500 -c 50 "$BASE_URL/health")

INSTANCE_TALLY=""
for i in $(seq 1 100); do
  id=$(curl -s "$BASE_URL/health" | grep -o '"instanceId":"[^"]*"')
  INSTANCE_TALLY="$INSTANCE_TALLY$id"$'\n'
done
INSTANCE_SUMMARY=$(echo "$INSTANCE_TALLY" | sort | uniq -c | sort -rn)

{
  echo "# Load Balancing Evidence"
  echo
  echo "Captured: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
  echo "Target: \`$BASE_URL\`"
  echo
  echo "## Load test (\`hey -n 500 -c 50\`)"
  echo
  echo '```'
  echo "$HEY_OUTPUT"
  echo '```'
  echo
  echo "## Instance distribution (100 sequential requests to /health)"
  echo
  echo '```'
  echo "$INSTANCE_SUMMARY"
  echo '```'
} > "$OUT_FILE"

echo "Listo. Evidencia guardada en $OUT_FILE"