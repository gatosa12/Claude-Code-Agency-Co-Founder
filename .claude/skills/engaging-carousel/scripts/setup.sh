#!/usr/bin/env bash
# First time on a machine: bash scripts/setup.sh   (safe to re-run; later runs take seconds)
# Makes the private Python env, downloads the Kokoro voice + Whisper, fills in the open fonts, builds the
# sound kit, readies the HyperFrames renderer and its Chrome, then runs a short self test. Ends on "All set".
# Everything lands in ~/.engaging-carousel (override with EC_HOME) and in this skill folder. Nothing costs money.
set -u
SK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EC_HOME="${EC_HOME:-$HOME/.engaging-carousel}"
VENV="$EC_HOME/venv"
HF="${EC_HYPERFRAMES:-hyperframes@0.8.185}"
OS="$(uname -s)"
mkdir -p "$EC_HOME"
ok()   { echo "✓ $*"; }
fail() { echo "✗ $*"; exit 1; }
how()  { if [ "$OS" = Darwin ]; then echo "brew install $1"; else echo "sudo apt-get install -y $2"; fi; }

echo "Engaging carousel setup → $EC_HOME"

# 1 · tools this skill needs (never installed silently: the command is printed for the user to approve)
command -v python3 >/dev/null || fail "Python 3 is missing. Install it: $(how python python3-venv)"
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' || fail "Python 3.9+ needed (found $(python3 -V))."
ok "$(python3 -V)"
command -v node >/dev/null || fail "Node 22+ is missing. Install it: $(how node@22 nodejs) (or https://nodejs.org)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || fail "Node 22+ needed (found $(node -v)). Install it: $(how node@22 nodejs)"
ok "Node $(node -v)"
command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null || fail "ffmpeg is missing. Install it: $(how ffmpeg ffmpeg)"
ok "ffmpeg $(ffmpeg -version | head -1 | awk '{print $3}')"

# 2 · private Python env
if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV" || fail "Could not make a Python env. On Linux: $(how python python3-venv)"
fi
"$VENV/bin/python" -m pip install -q --upgrade pip >/dev/null 2>&1
# av < 17: faster-whisper 1.2 passes an argument that PyAV 17+ removed
"$VENV/bin/python" -m pip install -q kokoro-onnx faster-whisper "av>=14,<17" numpy opencv-python-headless pillow soundfile \
  || fail "pip could not install the Python packages (check the internet connection and re-run)."
ok "Python env ($VENV)"
chmod +x "$SK/scripts/py"
PY="$SK/scripts/py"

# 3 · open fonts the look needs (SIL OFL, from the fontsource packages on jsdelivr)
FONTS="$SK/assets/fonts"; mkdir -p "$FONTS"
fetch_font() {  # <file> <url>
  [ -s "$FONTS/$1" ] && return 0
  curl -fsSL "$2" -o "$FONTS/$1.part" && mv "$FONTS/$1.part" "$FONTS/$1" || { rm -f "$FONTS/$1.part"; fail "could not download font $1"; }
}
JD="https://cdn.jsdelivr.net/npm"
fetch_font Inter-600.woff2 "$JD/@fontsource/inter@5.2.5/files/inter-latin-600-normal.woff2"
fetch_font Inter-700.woff2 "$JD/@fontsource/inter@5.2.5/files/inter-latin-700-normal.woff2"
fetch_font Inter-900.woff2 "$JD/@fontsource/inter@5.2.5/files/inter-latin-900-normal.woff2"
fetch_font Arimo-700.woff2 "$JD/@fontsource/arimo@5.2.5/files/arimo-latin-700-normal.woff2"
fetch_font BodoniModa-700.woff2 "$JD/@fontsource/bodoni-moda@5.2.5/files/bodoni-moda-latin-700-normal.woff2"
fetch_font JetBrainsMono-400.woff2 "$JD/@fontsource/jetbrains-mono@5.2.5/files/jetbrains-mono-latin-400-normal.woff2"
fetch_font PlayfairDisplay-Italic-Var-latin.woff2 "$JD/@fontsource-variable/playfair-display@5.2.5/files/playfair-display-latin-wght-italic.woff2"
fetch_font PlayfairDisplay-Italic-Var-latinext.woff2 "$JD/@fontsource-variable/playfair-display@5.2.5/files/playfair-display-latin-ext-wght-italic.woff2"
ok "fonts ($(ls "$FONTS" | wc -l | tr -d ' ') files)"

# 4 · the narrator (Kokoro) + word timings (Whisper small.en), downloaded once
"$PY" -c "import sys; sys.path.insert(0, '$SK/scripts'); import voice; voice.ensure_models()" || fail "could not download the Kokoro voice"
ok "Kokoro voice ($EC_HOME/kokoro)"
"$PY" -c "from faster_whisper import WhisperModel; WhisperModel('small.en', device='cpu', compute_type='int8')" >/dev/null 2>&1 \
  || fail "could not download Whisper small.en"
ok "Whisper small.en"

# 5 · sound kit
"$PY" "$SK/scripts/sfx_kit.py" >/dev/null || fail "could not build the sound kit"
ok "sound kit ($EC_HOME/sfx)"

# 6 · renderer (HyperFrames + its Chrome) and the page-capture helper (puppeteer-core, same Chrome)
npx --yes "$HF" --version >/dev/null 2>&1 || fail "could not fetch the HyperFrames renderer ($HF)"
npx --yes "$HF" browser ensure >/dev/null 2>&1 || fail "could not download Chrome for HyperFrames: run  npx $HF browser ensure  to see why"
ok "HyperFrames renderer + Chrome"
if [ ! -d "$EC_HOME/node/node_modules/puppeteer-core" ]; then
  npm install --silent --no-audit --no-fund --prefix "$EC_HOME/node" puppeteer-core@24 >/dev/null 2>&1 || fail "could not install puppeteer-core (page captures)"
fi
ok "page capture (puppeteer-core)"

# 7 · self test: voice one line, render one second, mix it
T="$EC_HOME/selftest"; rm -rf "$T"
"$PY" "$SK/scripts/selftest.py" "$T" || fail "self test failed (see above)"
ok "self test (voice → render → mix → mp4)"

echo "All set"
