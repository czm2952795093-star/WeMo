#!/usr/bin/env bash
set -euo pipefail

# Debian 11 matches native-node20/v1 (glibc 2.31). Newer Ubuntu builds can
# compile addons against glibc/libstdc++ versions absent from that runtime.
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
rootfs_dir="$(mktemp -d /var/tmp/wemo-bullseye.XXXXXX)"
artifact_dir="$repo_dir/.vefaas/linux-standalone"
command -v debootstrap >/dev/null || { echo 'Install debootstrap first.' >&2; exit 1; }

echo "Debian 11 build environment: $rootfs_dir"
sudo debootstrap --variant=minbase --include=ca-certificates,curl,xz-utils,build-essential,python3 \
  bullseye "$rootfs_dir" https://deb.debian.org/debian
sudo mkdir -p "$rootfs_dir/work/app"
sudo mount --bind /proc "$rootfs_dir/proc"
trap 'sudo umount "$rootfs_dir/proc"' EXIT
tar -C "$repo_dir" \
  --exclude='./.git' --exclude='./.next' --exclude='./.vefaas' \
  --exclude='./node_modules' --exclude='./.data' --exclude='./data' \
  --exclude='./.env*' --exclude='./docs' --exclude='*.tsbuildinfo' \
  -cf - . | sudo tar -xf - -C "$rootfs_dir/work/app"
sudo chroot "$rootfs_dir" /bin/bash -c 'cd /work/app && bash scripts/build-vefaas-linux.sh'
mkdir -p "$repo_dir/.vefaas"
if [[ -e "$artifact_dir" ]]; then
  mv "$artifact_dir" "$repo_dir/.vefaas/linux-standalone.previous.$(date +%s)"
fi
cp -a "$rootfs_dir/work/app/.vefaas/linux-standalone" "$artifact_dir"
echo "Debian 11 / Node 20 artifact: $artifact_dir"
