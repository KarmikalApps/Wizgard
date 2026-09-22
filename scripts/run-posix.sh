#!/bin/bash
set -euo pipefail
WIZ_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
case "$(uname -s)" in Darwin) WIZ_OS=darwin;; Linux) WIZ_OS=linux;; *) echo 'Unsupported operating system.'; exit 1;; esac
case "$(uname -m)" in arm64|aarch64) WIZ_ARCH=arm64;; x86_64|amd64) WIZ_ARCH=x64;; *) echo 'A 64-bit Intel/AMD or ARM processor is required.'; exit 1;; esac
if [ "$WIZ_OS" = darwin ] && [ "$(sysctl -in sysctl.proc_translated 2>/dev/null || true)" = 1 ]; then WIZ_ARCH=arm64; fi
WIZ_NODE_DIR="$WIZ_ROOT/runtime/$WIZ_OS-$WIZ_ARCH/node"
WIZ_NODE="$WIZ_NODE_DIR/bin/node"
if [ ! -f "$WIZ_NODE" ] || [ ! -f "$WIZ_NODE_DIR/lib/node_modules/npm/bin/npm-cli.js" ]; then
  WIZ_ARCHIVE="node-v24.19.0-$WIZ_OS-$WIZ_ARCH.tar.gz"
  echo "Preparing bundled Node.js for $WIZ_OS $WIZ_ARCH…"
  mkdir -p "$WIZ_ROOT/runtime/archives"
  cd "$WIZ_ROOT/runtime/archives"
  if [ ! -f "$WIZ_ARCHIVE" ]; then
    curl --fail --location --retry 3 --output "$WIZ_ARCHIVE.part" "https://nodejs.org/dist/v24.19.0/$WIZ_ARCHIVE"
    mv "$WIZ_ARCHIVE.part" "$WIZ_ARCHIVE"
  fi
  WIZ_CHECK="$(grep "  $WIZ_ARCHIVE\$" ../node-checksums.txt)"
  if [ "$WIZ_OS" = darwin ]; then printf '%s\n' "$WIZ_CHECK" | shasum -a 256 -c -; else printf '%s\n' "$WIZ_CHECK" | sha256sum -c -; fi
  mkdir -p "$WIZ_NODE_DIR"
  tar -xzf "$WIZ_ARCHIVE" -C "$WIZ_NODE_DIR" --strip-components=1
fi
chmod u+x "$WIZ_NODE"
cd "$WIZ_ROOT"
exec "$WIZ_NODE" "$WIZ_ROOT/scripts/run.mjs" "$@"
