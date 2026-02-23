#!/bin/sh
# Fleet Setup — retrieves enrollment token from Kibana Fleet API
# and writes it to a shared volume for agents to read.
set -eu

KIBANA_URL="http://fleet-kibana:5601"
ELASTIC_USER="elastic"
ELASTIC_PASS="changeme"
POLICY_ID="default-agent-policy"

echo "Fleet Setup: Waiting for Kibana Fleet API..."

# Wait for Kibana Fleet API to be available
attempts=0
until curl -sf -u "${ELASTIC_USER}:${ELASTIC_PASS}" \
  "${KIBANA_URL}/api/fleet/agent_policies" \
  -H "kbn-xsrf: true" > /dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 60 ]; then
    echo "Fleet Setup: ERROR — Kibana Fleet API not available after 60 attempts"
    exit 1
  fi
  echo "  Waiting for Kibana Fleet API (${attempts}/60)..."
  sleep 5
done
echo "Fleet Setup: Kibana Fleet API is ready."

# Retrieve enrollment token for the default agent policy
echo "Fleet Setup: Retrieving enrollment token for policy '${POLICY_ID}'..."
attempts=0
TOKEN=""
while [ -z "$TOKEN" ]; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 30 ]; then
    echo "Fleet Setup: ERROR — Could not retrieve enrollment token after 30 attempts"
    exit 1
  fi

  RESP=$(curl -sf -u "${ELASTIC_USER}:${ELASTIC_PASS}" \
    "${KIBANA_URL}/api/fleet/enrollment_api_keys" \
    -H "kbn-xsrf: true" 2>/dev/null || true)

  if [ -n "$RESP" ]; then
    # Extract api_key for our policy_id using grep/sed (no jq available)
    TOKEN=$(printf '%s' "$RESP" | \
      grep -Eo '"policy_id":"[^"]*"[^}]*"api_key":"[^"]*"|"api_key":"[^"]*"[^}]*"policy_id":"[^"]*"' | \
      grep "\"policy_id\":\"${POLICY_ID}\"" | \
      grep -o '"api_key":"[^"]*"' | \
      head -1 | \
      sed 's/"api_key":"\([^"]*\)"/\1/')
  fi

  if [ -z "$TOKEN" ]; then
    echo "  Token not ready yet (${attempts}/30)..."
    sleep 5
  fi
done

echo "Fleet Setup: Enrollment token retrieved."
printf '%s' "$TOKEN" > /shared/enrollment-token
echo "Fleet Setup: Token written to /shared/enrollment-token"
echo "Fleet Setup: Done."
