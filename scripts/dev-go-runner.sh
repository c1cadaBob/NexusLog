#!/usr/bin/env bash

set -euo pipefail

build_cmd="${1:?missing build command}"
build_bin="${2:?missing build binary path}"
shift 2

export PATH="/usr/local/go/bin:/go/bin:${PATH}"

run_air() {
  exec air --build.cmd "$build_cmd" --build.bin "$build_bin" "$@"
}

if command -v air >/dev/null 2>&1; then
  run_air "$@"
fi

echo "[dev-go-runner] air not found; attempting install" >&2
air_install_cmd=(go install github.com/air-verse/air@v1.52.3)
if command -v timeout >/dev/null 2>&1; then
  air_install_cmd=(timeout 15s "${air_install_cmd[@]}")
fi
if "${air_install_cmd[@]}"; then
  run_air "$@"
fi

echo "[dev-go-runner] warning: unable to install air within timeout, falling back to one-shot run" >&2
eval "$build_cmd"
exec "$build_bin"
