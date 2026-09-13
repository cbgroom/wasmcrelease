#!/bin/sh
# Default public reference graph only; optional Wasmtime is separate.
set -eu
if [ "$#" -ne 1 ] || [ ! -f "$1" ] || [ ! -r "$1" ]; then
  echo 'FAIL native dependency inventory must be a readable regular file' >&2
  exit 1
fi
command -v grep >/dev/null
if ! grep -Eq '^wasmc-lib-host-e2e v0[.]0[.]1([[:space:]]|$)' "$1" || ! grep -Eq '^wasmi v2[.]0[.]0([[:space:]]|$)' "$1"; then
  echo 'FAIL native inventory is empty or missing exact reference/Wasmi root' >&2
  exit 1
fi
dependency_match_status=0
grep -E '(^|[[:space:]])(wasmtime[^[:space:]]*|wasi[^[:space:]]*|wasip[23]|wat|wast|rustls[^[:space:]]*|openssl[^[:space:]]*|native-tls)([[:space:]]|$)' "$1" || dependency_match_status=$?
if [ "$dependency_match_status" -ne 1 ]; then
  echo 'FAIL default native dependency denied or inventory inspection failed' >&2
  exit 1
fi
echo 'PASS default native graph: no Wasmtime/WASI/TLS/WAT'
