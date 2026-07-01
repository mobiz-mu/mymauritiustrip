#!/usr/bin/env bash
#
# diagnose-build.sh — isolate which route group makes `next build` hang at
# "Collecting page data". Run from the repo root: bash scripts/diagnose-build.sh
#
# It disables all non-essential routes, then re-enables them in batches,
# running `next build` (with a timeout) after each batch. The first batch whose
# build times out contains the offending route. Everything is restored on exit.

set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
DIS="$ROOT/.disabled_routes"
TIMEOUT="${BUILD_TIMEOUT:-360}"   # seconds per build; override: BUILD_TIMEOUT=600 bash ...

mkdir -p "$DIS"

# keep these always (minimal app shell)
KEEP=( "app/layout.tsx" "app/globals.css" "app/not-found.tsx" "app/page.tsx" )

# batches, re-enabled in order
BATCHES=(
  "app/(auth)"
  "app/search app/listings"
  "app/villas-mauritius app/car-rental-mauritius app/taxi-service-mauritius app/boat-trips-mauritius app/restaurants-mauritius app/things-to-do-mauritius app/activities-mauritius app/catamaran-cruise-mauritius app/diving-mauritius app/spa-wellness-mauritius app/private-chef-mauritius app/airport-transfer-mauritius app/wedding-honeymoon-mauritius"
  "app/request-transfer app/client"
  "app/provider"
  "app/admin"
  "app/auth app/api"
)

restore() {
  echo; echo "== restoring all routes =="
  if [ -d "$DIS" ]; then
    ( cd "$DIS" && find . -mindepth 1 -maxdepth 1 -print | while read -r e; do
        name="${e#./}"; orig="$(echo "$name" | sed 's#__#/#g')"
        mkdir -p "$ROOT/$(dirname "$orig")"; mv "$DIS/$name" "$ROOT/$orig"
      done )
    rmdir "$DIS" 2>/dev/null || true
  fi
}
trap restore EXIT

disable_path() { # move app/<x> -> .disabled_routes/<flattened>
  local p="$1"; [ -e "$p" ] || return 0
  local flat; flat="$(echo "$p" | sed 's#/#__#g')"
  mv "$p" "$DIS/$flat"
}
enable_path() {
  local p="$1"; local flat; flat="$(echo "$p" | sed 's#/#__#g')"
  [ -e "$DIS/$flat" ] || return 0
  mkdir -p "$(dirname "$p")"; mv "$DIS/$flat" "$p"
}

echo "== disabling all non-essential routes =="
for entry in app/*; do
  case " ${KEEP[*]} " in *" $entry "*) continue;; esac
  disable_path "$entry"
done

run_build() {
  echo "--- building (timeout ${TIMEOUT}s) ---"
  rm -rf .next
  if timeout "$TIMEOUT" npm run build >/tmp/diag_build.log 2>&1; then
    echo "    PASS"
  else
    local rc=$?
    if [ "$rc" -eq 124 ]; then
      echo "    >>> HUNG (timed out). Offending route is in the batch just enabled. <<<"
      echo "    last lines:"; tail -n 5 /tmp/diag_build.log | sed 's/^/      /'
      exit 0
    else
      echo "    build failed (rc=$rc) — not a hang; see /tmp/diag_build.log"; tail -n 8 /tmp/diag_build.log | sed 's/^/      /'
    fi
  fi
}

echo "== batch 0: minimal shell only =="
run_build

i=1
for batch in "${BATCHES[@]}"; do
  echo "== batch $i: enabling -> $batch =="
  for p in $batch; do enable_path "$p"; done
  run_build
  i=$((i+1))
done

echo "== all batches passed; build completes with every route enabled =="
