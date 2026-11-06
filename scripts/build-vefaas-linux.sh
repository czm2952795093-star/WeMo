#!/usr/bin/env bash
set -euo pipefail

# Build away from the Windows dependency tree; never copy secrets or user data.
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
build_dir="$(mktemp -d /var/tmp/wemo-linux-build.XXXXXX)"
artifact_dir="$repo_dir/.vefaas/linux-standalone"
node_version="20.20.0"

if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
  echo 'veFaaS native-node20 requires a Linux x86_64 build environment.' >&2
  exit 1
fi

echo "Linux build workspace: $build_dir"
mkdir -p "$build_dir/runtime" "$build_dir/project"
curl --fail --location --retry 3 --silent --show-error \
  "https://nodejs.org/dist/v$node_version/node-v$node_version-linux-x64.tar.xz" \
  --output "$build_dir/runtime/node.tar.xz"
curl --fail --location --retry 3 --silent --show-error \
  "https://nodejs.org/dist/v$node_version/SHASUMS256.txt" \
  --output "$build_dir/runtime/SHASUMS256.txt"
expected_sha="$(awk -v name="node-v$node_version-linux-x64.tar.xz" '$2 == name {print $1}' "$build_dir/runtime/SHASUMS256.txt")"
[[ -n "$expected_sha" ]]
printf '%s  %s\n' "$expected_sha" "$build_dir/runtime/node.tar.xz" | sha256sum --check
tar -xJf "$build_dir/runtime/node.tar.xz" -C "$build_dir/runtime"
export PATH="$build_dir/runtime/node-v$node_version-linux-x64/bin:$PATH"
export NEXT_TELEMETRY_DISABLED=1

tar -C "$repo_dir" \
  --exclude='./.git' --exclude='./.next' --exclude='./.vefaas' \
  --exclude='./node_modules' --exclude='./.data' --exclude='./data' \
  --exclude='./.env*' --exclude='./docs' --exclude='*.tsbuildinfo' \
  -cf - . | tar -xf - -C "$build_dir/project"
cd "$build_dir/project"
npm ci --no-audit --no-fund
node --input-type=module -e '
import Database from "better-sqlite3";
import sharp from "sharp";
const db = new Database(":memory:");
if (db.prepare("select 1 as ok").get().ok !== 1) throw new Error("SQLite smoke test failed");
db.close();
await sharp({create: {width: 8, height: 8, channels: 3, background: "white"}}).png().toBuffer();
console.log("Linux Node 20 SQLite and sharp verified.");
'
npm run build:vefaas

# Replacing only this generated artifact is safe; keep failed build workspaces.
[[ "$artifact_dir" == "$repo_dir/.vefaas/linux-standalone" ]]
mkdir -p "$repo_dir/.vefaas"
if [[ -e "$artifact_dir" ]]; then
  mv "$artifact_dir" "$repo_dir/.vefaas/linux-standalone.previous.$(date +%s)"
fi
cp -a .next/standalone "$artifact_dir"
echo "Linux deployment artifact: $artifact_dir"
