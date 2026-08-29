set shell := ["zsh", "-cu"]

# Build the Chrome Web Store upload artifact.
default: webstore

# Install exactly the locked development dependencies.
install:
    npm ci

# Build the unpacked extension in dist/.
build:
    npm run build

# Run fast local contracts.
test:
    npm test

# Verify every route in Artificial Analysis' public sitemaps is classified.
audit:
    npm run audit:live

# Run the complete unit, live-site, Chromium, asset, and package gate.
validate:
    npm run validate

# Build and verify the ZIP accepted by the Chrome Web Store dashboard.
webstore:
    #!/usr/bin/env zsh
    set -euo pipefail
    npm run package
    version="$(node -e 'const fs=require("fs"); console.log(JSON.parse(fs.readFileSync("src/manifest.json", "utf8")).version)')"
    archive="releases/artificial-analysis-dark-${version}.zip"
    test -f "$archive"
    unzip -t "$archive" >/dev/null
    echo "Chrome Web Store upload: $archive"
    shasum -a 256 "$archive"

# Alias matching the dashboard workflow.
dashboard: webstore

# Explicit ZIP alias for the Chrome Web Store upload package.
zip: webstore

# Build a signed CRX for non-store/local distribution only.
# The Web Store dashboard does not accept CRX files; use `just webstore` there.
crx key:
    #!/usr/bin/env zsh
    set -euo pipefail
    root="{{ justfile_directory() }}"
    key_path="$(cd "$(dirname "{{ key }}")" && pwd)/$(basename "{{ key }}")"
    test -f "$key_path" || { echo "Signing key not found: $key_path" >&2; exit 1; }
    chrome_bin="${CHROME_BIN:-/Applications/Chromium.app/Contents/MacOS/Chromium}"
    test -x "$chrome_bin" || { echo "Set CHROME_BIN to a Chromium executable." >&2; exit 1; }
    cd "$root"
    npm run build
    "$chrome_bin" --pack-extension="$root/dist" --pack-extension-key="$key_path"
    version="$(node -e 'const fs=require("fs"); console.log(JSON.parse(fs.readFileSync("src/manifest.json", "utf8")).version)')"
    mkdir -p releases
    mv -f "$root/dist.crx" "releases/artificial-analysis-dark-${version}.crx"
    echo "Local signed CRX: releases/artificial-analysis-dark-${version}.crx"
    echo "Do not upload this CRX to the Chrome Web Store; upload the ZIP from `just webstore`."
