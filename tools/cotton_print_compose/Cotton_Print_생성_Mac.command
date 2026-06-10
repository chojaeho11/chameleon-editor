#!/bin/bash
# Cotton Print GUI Launcher (Mac)
# Double-click to launch GUI

cd "$(dirname "$0")"

GUI_NAME="gui.py"
SCRIPT_NAME="compose_fabric.py"
GUI_URL="https://raw.githubusercontent.com/chojaeho11/chameleon-editor/main/tools/cotton_print_compose/gui.py"
SCRIPT_URL="https://raw.githubusercontent.com/chojaeho11/chameleon-editor/main/tools/cotton_print_compose/compose_fabric.py"

# 1) Check Python
if ! command -v python3 &> /dev/null; then
    osascript -e 'display dialog "Python3 is not installed.\n\nInstall via Homebrew:\nbrew install python3\n\nOr download: https://www.python.org/downloads/" buttons {"OK"} default button "OK" with icon stop'
    open "https://www.python.org/downloads/"
    exit 1
fi

# 2) Download GUI if missing
if [ ! -f "$GUI_NAME" ]; then
    curl -fsSL "$GUI_URL" -o "$GUI_NAME" || {
        osascript -e 'display dialog "gui.py download failed. Place it in this folder manually." buttons {"OK"} default button "OK" with icon stop'
        exit 1
    }
fi

# 3) Download compose script if missing
if [ ! -f "$SCRIPT_NAME" ]; then
    curl -fsSL "$SCRIPT_URL" -o "$SCRIPT_NAME" 2>/dev/null
fi

# 4) Launch GUI in background, close terminal
python3 "$GUI_NAME" &

# Close terminal window (Mac)
osascript -e 'tell application "Terminal" to close (every window whose name contains "Cotton_Print")' &> /dev/null &

exit 0
