set shell := ["zsh", "-cu"]
set dotenv-load := true

# Build the Chrome Web Store upload artifact.
default: webstore

# Install exactly the locked development dependencies.
install:
    bun install --frozen-lockfile

# Build the unpacked extension in dist/.
build:
    bun run build

# Run fast local contracts.
test:
    bun run test

# Run the complete unit, live-site Chromium, asset, and package gate.
validate:
    bun run validate

# Build and verify the ZIP accepted by the Chrome Web Store dashboard.
webstore:
    #!/usr/bin/env zsh
    set -euo pipefail
    bun run package
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
    bun run build
    "$chrome_bin" --pack-extension="$root/dist" --pack-extension-key="$key_path"
    version="$(node -e 'const fs=require("fs"); console.log(JSON.parse(fs.readFileSync("src/manifest.json", "utf8")).version)')"
    mkdir -p releases
    mv -f "$root/dist.crx" "releases/artificial-analysis-dark-${version}.crx"
    echo "Local signed CRX: releases/artificial-analysis-dark-${version}.crx"
    echo "Do not upload this CRX to the Chrome Web Store; upload the ZIP from `just webstore`."

# One-time setup: prerequisites, Google OAuth client, Web Store refresh token, .env.
ready:
    node scripts/ready.mjs

# Release X.Y.Z: bump, gate, commit, tag, Chrome Web Store upload + publish, push, GitHub Release.
# Options after the version: `fast` skips the live-site browser suite; `--force` skips the clean-tree check.
publish version *options:
    #!/usr/bin/env zsh
    set -euo pipefail
    cd "{{ justfile_directory() }}"
    version="{{ version }}"
    mode=full
    force=0
    for option in {{ options }}; do
      case "$option" in
        full|fast) mode="$option" ;;
        --force|force) force=1 ;;
        *) echo "publish: unknown option '$option' (use fast, full, --force)" >&2; exit 1 ;;
      esac
    done
    die() { echo "publish: $*" >&2; exit 1; }

    # Preflight: nothing is modified until every check passes.
    [[ "$version" =~ '^[0-9]+\.[0-9]+\.[0-9]+$' ]] || die "version must look like 1.2.3"
    if (( ! force )); then
      [[ -z "$(git status --porcelain)" ]] || die "working tree is not clean (add --force to release anyway)"
    fi
    [[ "$(git branch --show-current)" == main ]] || die "not on main"
    git fetch --quiet origin
    git merge-base --is-ancestor origin/main HEAD || die "main is behind or has diverged from origin/main; pull first"
    git rev-parse --quiet --verify "refs/tags/v$version" >/dev/null && die "tag v$version already exists"
    [[ -z "$(git ls-remote --tags origin "refs/tags/v$version")" ]] || die "tag v$version already exists on origin"
    [[ -n "${CWS_CLIENT_ID:-}" && -n "${CWS_CLIENT_SECRET:-}" && -n "${CWS_REFRESH_TOKEN:-}" ]] || die "no Web Store credentials in .env; run: just ready"
    gh auth status >/dev/null 2>&1 || die "gh is not authenticated; run: gh auth login"
    node scripts/cws.mjs check "$version"

    # From here on, a failure prints how to recover. Before the release commit that means
    # reverting the bump (unless --force, when the tree was already yours to sort out).
    archive="releases/artificial-analysis-dark-${version}.zip"
    steps=(
      "node scripts/cws.mjs upload $archive"
      "node scripts/cws.mjs publish"
      "git push origin main v$version"
      "gh release create v$version $archive --title v$version --generate-notes"
    )
    bumped=0
    step=0
    recover() {
      if (( step > 0 )); then
        echo "publish: step $step failed. Remaining steps:" >&2
        for remaining in "${(@)steps[step,-1]}"; do echo "  $remaining" >&2; done
        (( step == 1 )) && echo "  or undo the release commit: git tag -d v$version && git reset --soft HEAD~1" >&2
      elif (( bumped && ! force )); then
        git checkout --quiet -- package.json src/manifest.json store-assets/screenshots
        echo "publish: gate failed; reverted the version bump. Fix the failure and re-run." >&2
      fi
      return 0
    }
    trap recover ERR

    # Bump package.json and the manifest together.
    node -e 'const fs = require("fs"); for (const p of ["package.json", "src/manifest.json"]) { const m = JSON.parse(fs.readFileSync(p, "utf8")); m.version = process.argv[1]; fs.writeFileSync(p, JSON.stringify(m, null, 2) + "\n"); }' "$version"
    bumped=1

    # Gate. The full gate refreshes store-assets/screenshots, which join the release commit.
    if [[ "$mode" == full ]]; then bun run validate; else bun run test; bun run package; fi
    test -f "$archive" || die "expected $archive"

    git add package.json src/manifest.json store-assets/screenshots
    git commit --quiet -m "Release $version"
    git tag -a "v$version" -m "v$version"
    for command in "${steps[@]}"; do step=$((step + 1)); eval "$command"; done

    echo
    echo "Released $version. Store review is pending; it publishes automatically on approval."
    shasum -a 256 "$archive"
    echo "Dashboard: https://chrome.google.com/webstore/devconsole/55307e7a-0630-4d79-a100-a029141ee6db/fncnoagfclehaljfppnjpngaingeoimm"
    gh release view "v$version" --json url --jq .url
