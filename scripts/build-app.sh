#!/usr/bin/env bash
# Build + install the resident macOS menubar app.
# Skips the flaky phantomjs-based icon step by generating icon.icns with native
# macOS tools (sips + iconutil) and calling electron-builder directly (no npm
# prepack hook). Produces an unpacked, ad-hoc-signed .app and installs it to
# /Applications. Re-run this after code changes to update the installed app.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Generating icon.icns (native, no phantomjs)"
mkdir -p build/icons
ICONSET="$(mktemp -d)/icon.iconset"
mkdir -p "$ICONSET"
for s in 16 32 128 256 512; do
  sips -z "$s" "$s" assets/icon.png --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2))
  sips -z "$d" "$d" assets/icon.png --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o build/icons/icon.icns
cp assets/icon.png build/icons/icon.png

echo "==> Building .app (electron-builder --dir)"
./node_modules/.bin/electron-builder --dir

echo "==> Installing to /Applications"
pkill -f "Token Monitor.app/Contents/MacOS" 2>/dev/null || true
sleep 1
rm -rf "/Applications/Token Monitor.app"
mv "dist/mac-arm64/Token Monitor.app" "/Applications/"

echo "==> Launching"
open "/Applications/Token Monitor.app"
echo "Done. /Applications/Token Monitor.app installed + launched."
echo "To auto-start at login (one-time):"
echo "  osascript -e 'tell application \"System Events\" to make login item at end with properties {path:\"/Applications/Token Monitor.app\", hidden:false}'"
