#!/bin/bash
set -e
WIZ_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
case "$(uname -s)" in
  Linux|Darwin) ;;
  *) echo 'Use Run_WIN.cmd on Windows. This launcher supports Linux and macOS.'; exit 1 ;;
esac
exec bash "$WIZ_ROOT/scripts/run-posix.sh" "$@"
