#!/bin/sh
set -eu
stage=$1
tests=$2
out=$3
test ! -e "$out"
mkdir -p "$out/fixtures"
for id in endpoint socket uinput; do
  ln -s "$stage/libspec/wasmc-system-linux-$id" "$out/fixtures/linux-$id"
  cc -O2 -pthread -I "$out/fixtures" "$tests/test-$id.c" -o "$out/test-$id"
  "$out/test-$id" > "$out/$id.log"
done
