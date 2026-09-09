#!/usr/bin/env bash
# GüzelKabir web (apps/web static export) — forced-command deploy script.
#
# This is the ONLY thing the `guzelkabir-deploy-web` SSH key is allowed to
# run — a SEPARATE key from `guzelkabir-deploy` (the apps/api one), pinned
# in ~opsadmin/.ssh/authorized_keys to
# `command="/bin/bash /opt/guzelkabir/deploy/remote-deploy-web.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty`
# (see deploy/README.md). Per-purpose key scoping, same reasoning as the
# api key: a leaked web-deploy key can only ever overwrite the web
# directory, nothing else — it cannot touch apps/api's containers, the
# database, or run arbitrary shell commands.
#
# Unlike remote-deploy.sh (apps/api), this does NOT build anything itself
# — the static export is built in GitHub Actions (deploy-web.yml), tarred,
# and piped over stdin: `tar -czf - -C out . | ssh -i key opsadmin@host`.
# A forced-command SSH session still passes stdin/stdout through normally
# (only the *command* is overridden), so this script just reads that
# tarball and extracts it into place. Building in CI rather than on this
# shared droplet keeps Node off the host entirely and keeps the Next.js
# compiler's CPU/memory work off a box other people's node@3000/uvicorn@8000
# also run on.

set -euo pipefail

WEBROOT="/var/www/guzelkabir-web"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Extract the incoming tarball (stdin) into a fresh temp directory first —
# never extract directly into $WEBROOT, so a truncated/corrupt upload can
# never leave the live site half-overwritten.
tar -xzf - -C "$TMP_DIR"

if [[ ! -f "$TMP_DIR/index.html" ]]; then
  echo "Extracted archive has no index.html at its root — refusing to deploy a bad build." >&2
  exit 1
fi

mkdir -p "$WEBROOT"
# --delete removes files from a previous build that no longer exist in
# this one (e.g. renamed hashed chunk files) — rsync's copy+delete isn't
# perfectly atomic (a request mid-sync could briefly see a partial
# directory), but at this pilot's traffic level that's a negligible,
# accepted trade-off against the added complexity of a symlink-swap
# releases/ pattern (see CLAUDE.md's Deployment section for the same
# reasoning).
rsync -a --delete "$TMP_DIR"/ "$WEBROOT"/

echo "Deployed to $WEBROOT ($(find "$WEBROOT" -type f | wc -l) files)."
