#!/bin/bash
# Cotton Print GUI Launcher (Mac, Auto-Update)
# Always downloads latest from Cloudflare, falls back to local if offline

cd "$(dirname "$0")"

GUI_NAME="gui.py"
SCRIPT_NAME="compose_fabric.py"
BASE_URL="https://www.cafe2626.com/tools/cotton_print_compose"
TS=$(date +%s)

# 1) Check Python
if ! command -v python3 &> /dev/null; then
    osascript -e 'display dialog "Python3 is not installed.\n\nInstall via Homebrew:\nbrew install python3\n\nOr download:\nhttps://www.python.org/downloads/" buttons {"OK"} default button "OK" with icon stop'
    open "https://www.python.org/downloads/"
    exit 1
fi

# 2) Auto-update GUI (silent, fall back to local if fails)
for f in "$GUI_NAME" "$SCRIPT_NAME"; do
    if curl -fsSL --max-time 15 "$BASE_URL/$f?t=$TS" -o "$f.new" 2>/dev/null; then
        # Verify download is not empty (>1KB)
        if [ -s "$f.new" ] && [ $(wc -c < "$f.new") -gt 1000 ]; then
            mv -f "$f.new" "$f"
        else
            rm -f "$f.new"
        fi
    fi
done

# 3) Check Pillow + install if missing
if ! python3 -c "import PIL" &> /dev/null; then
    python3 -m pip install --quiet Pillow
fi

# 4) Verify required files exist
if [ ! -f "$GUI_NAME" ] || [ ! -f "$SCRIPT_NAME" ]; then
    osascript -e 'display dialog "Required files not found. Check internet connection." buttons {"OK"} default button "OK" with icon stop'
    exit 1
fi

# 5) Launch GUI in background
python3 "$GUI_NAME" &

# Close terminal
osascript -e 'tell application "Terminal" to close (every window whose name contains "Cotton_Print")' &> /dev/null &

exit 0
