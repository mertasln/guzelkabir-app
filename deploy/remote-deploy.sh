#!/usr/bin/env bash
# GüzelKabir API — forced-command deploy script.
#
# This is the ONLY thing the `guzelkabir-deploy` SSH key is allowed to run.
# ~opsadmin/.ssh/authorized_keys pins that key to
# `command="/bin/bash /opt/guzelkabir/deploy/remote-deploy.sh"` (see
# deploy/README.md §2) — a session opened with this key cannot get a general
# shell, no matter what command the client (GitHub Actions) actually sends.
# On this shared droplet (nginx/node@3000/uvicorn@8000 all live here too),
# that means a leaked DEPLOY_SSH_KEY only ever grants "run this script",
# not "root the box." Deploy logic changes go in this file, not in
# .github/workflows/deploy-api.yml's `script:` block — that block's content
# is discarded server-side by the forced command.
#
# DOPPLER_TOKEN is read from a local, locked-down file rather than an SSH
# session env var: with a forced command in play, whether the client's
# env-export gets through to this process isn't something to depend on, so
# the token lives here instead (see deploy/README.md §3 for how it's put in
# place — a one-time manual step, never committed, never sent over SSH).

set -euo pipefail

DOPPLER_TOKEN_FILE="/etc/guzelkabir/doppler-token"
if [[ ! -r "$DOPPLER_TOKEN_FILE" ]]; then
  echo "Doppler token file not found/readable at $DOPPLER_TOKEN_FILE — see deploy/README.md §3." >&2
  exit 1
fi
DOPPLER_TOKEN="$(cat "$DOPPLER_TOKEN_FILE")"

cd /opt/guzelkabir

git fetch origin main
git reset --hard origin/main

doppler run --token="$DOPPLER_TOKEN" --project guzelkabir-api --config prd -- \
  docker compose -f deploy/docker-compose.yml build api

# Migration runs before restart, as its own visible step — never run new
# code against an unmigrated schema (spec §21.2's state machine depends on
# the current schema shape).
doppler run --token="$DOPPLER_TOKEN" --project guzelkabir-api --config prd -- \
  docker compose -f deploy/docker-compose.yml run --rm api npx prisma migrate deploy

doppler run --token="$DOPPLER_TOKEN" --project guzelkabir-api --config prd -- \
  docker compose -f deploy/docker-compose.yml up -d

# Lightweight smoke check — spec §13.2 step 34's full Playwright+staging
# version is out of scope here (no staging environment exists yet, see
# deploy/README.md's "Bilinçli basitleştirmeler"); this just confirms the
# container actually came up.
for i in $(seq 1 10); do
  if curl -sf http://127.0.0.1:3001/api/v1/health > /dev/null; then
    echo "Health check OK"
    exit 0
  fi
  sleep 3
done
echo "Health check FAILED after deploy — check 'docker compose logs api'" >&2
exit 1
