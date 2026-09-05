/*
 * One-time setup for `just publish`.
 *
 * Checks prerequisites, walks through creating a Google Cloud OAuth client,
 * obtains a Chrome Web Store API refresh token through a loopback redirect,
 * writes .env (mode 600), and verifies the credentials against the live item.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import path from "node:path";
import readline from "node:readline";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(projectRoot, ".env");
const SCOPE = "https://www.googleapis.com/auth/chromewebstore";

if (!process.stdin.isTTY) fail("just ready is interactive: run it in a terminal window, not through a non-interactive runner.");

let muted = false;
let finished = false;
const rl = readline.createInterface({
  input: process.stdin,
  output: new Writable({ write(chunk, _encoding, callback) { if (!muted) process.stdout.write(chunk); callback(); } }),
  terminal: true,
});
rl.on("SIGINT", () => fail("Aborted. Nothing was written; re-run: just ready"));
rl.on("close", () => { if (!finished) fail("Input closed before setup finished."); });
const ask = (question) => new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));

console.log("\nStep 1/4 · Prerequisites\n");
let failures = 0;
check(Number(process.versions.node.split(".")[0]) >= 20, `Node ${process.versions.node}`, "Node 20 or newer is required.");
check(run(["bun", "--version"]), "bun", "Install bun: https://bun.sh");
check(run(["git", "config", "user.name"]) && run(["git", "config", "user.email"]), "git identity", "Set git config user.name and user.email.");
check(run(["git", "push", "--dry-run", "origin", "main"]), "push access to origin/main", "Fix git credentials for origin (or sync main) first.");
check(run(["gh", "auth", "status"]), "gh authenticated (GitHub Releases)", "Run: gh auth login");
const playwrightCache = path.join(homedir(), "Library", "Caches", "ms-playwright");
let chromium = existsSync(playwrightCache) && readdirSync(playwrightCache).some((name) => name.startsWith("chromium-"));
if (!chromium && (await ask("Playwright Chromium is missing (the full release gate needs it). Install now? [Y/n] ")).toLowerCase() !== "n") {
  chromium = run(["bunx", "playwright", "install", "chromium"], "inherit");
}
check(chromium, "Playwright Chromium", "Run: bunx playwright install chromium");
check(readFileSync(path.join(projectRoot, ".gitignore"), "utf8").split(/\r?\n/).includes(".env"), ".env is gitignored", "Add .env to .gitignore before continuing.");
if (failures > 0) fail("Fix the items above, then re-run: just ready");

console.log(`
Step 2/4 · Google Cloud OAuth client (one time, in the browser)

  1. https://console.cloud.google.com → create a project (any name).
  2. APIs & Services → Library → search "Chrome Web Store API" → Enable.
  3. APIs & Services → OAuth consent screen: User type "External", app name,
     your email → save. Then "Publish app" → In production.
     (In "Testing" status every refresh token expires after 7 days.)
  4. Credentials → Create credentials → OAuth client ID →
     Application type "Desktop app" → Create. Copy the Client ID and secret.
     Not "Web application", "Chrome Extension", iOS, or Android: those reject
     the loopback redirect with "Access blocked … Error 400: invalid_request".
  5. Sign in during consent with the Google account that owns the extension
     in the Web Store Developer Dashboard. It must have 2-Step Verification on.

  Google's own API guide uses a "Web application" client with the OAuth
  Playground in Testing mode; that is the 7-day trap. Use "Desktop app".
`);

console.log("Step 3/4 · Credentials\n");
const existing = readEnv();
let credentials;
if (existing.CWS_CLIENT_ID && existing.CWS_CLIENT_SECRET && existing.CWS_REFRESH_TOKEN
  && (await ask(".env already has credentials. Keep them and only verify? [Y/n] ")).toLowerCase() !== "n") {
  credentials = existing;
} else {
  const clientId = await ask("OAuth Client ID: ");
  if (!clientId.endsWith(".apps.googleusercontent.com")) fail("Client IDs end with .apps.googleusercontent.com; check the paste.");
  const clientSecret = await askHidden("OAuth Client secret (input hidden): ");
  if (!clientSecret.startsWith("GOCSPX-")) {
    fail(`Client secrets start with GOCSPX-; received ${clientSecret.length} characters starting with "${clientSecret.slice(0, 3)}". Copy it from Credentials → the client → Client secret (or "Add secret" if it is no longer shown).`);
  }
  console.log(`  received ${clientSecret.length} characters`);
  const refreshToken = await authorize(clientId, clientSecret).catch((error) => fail(error.message));
  credentials = { CWS_CLIENT_ID: clientId, CWS_CLIENT_SECRET: clientSecret, CWS_REFRESH_TOKEN: refreshToken };
  writeFileSync(envPath, `${Object.entries(credentials).map(([key, value]) => `${key}=${value}`).join("\n")}\n`, { mode: 0o600 });
  chmodSync(envPath, 0o600);
  console.log("✓ wrote .env (mode 600)");
}

console.log("\nStep 4/4 · Verify\n");
finished = true;
rl.close();
const verify = spawnSync(process.execPath, [path.join(projectRoot, "scripts", "cws.mjs"), "check"], {
  cwd: projectRoot,
  stdio: "inherit",
  env: { ...process.env, ...credentials },
});
if (verify.status !== 0) fail("Credential check failed. Fix the message above, then re-run: just ready");
console.log("\nReady. Release with: just publish X.Y.Z   (add `fast` to skip the live-site checks)");

function authorize(clientId, clientSecret) {
  const state = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    let redirectUri;
    const server = createServer(async (request, response) => {
      const url = new URL(request.url, redirectUri);
      if (url.pathname !== "/") {
        response.writeHead(404).end();
        return;
      }
      const finish = (ok, text) => {
        response.writeHead(ok ? 200 : 400, { "content-type": "text/plain" }).end(text);
        server.close();
      };
      if (url.searchParams.get("state") !== state) {
        finish(false, "State mismatch. Re-run: just ready");
        reject(new Error("OAuth state mismatch."));
        return;
      }
      const error = url.searchParams.get("error");
      if (error) {
        finish(false, `Authorization failed: ${error}`);
        reject(new Error(`Authorization failed: ${error}`));
        return;
      }
      try {
        const refreshToken = await exchange(clientId, clientSecret, url.searchParams.get("code"), redirectUri);
        finish(true, "Authorized. You can close this tab and return to the terminal.");
        resolve(refreshToken);
      } catch (exchangeError) {
        finish(false, exchangeError.message);
        reject(exchangeError);
      }
    });

    server.listen(0, "127.0.0.1", () => {
      redirectUri = `http://127.0.0.1:${server.address().port}`;
      const consent = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      consent.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPE,
        access_type: "offline",
        prompt: "consent",
        state,
      });
      console.log(`\nOpening Google's consent screen. If nothing opens, visit:\n${consent.href}\n`);
      console.log('If Google shows "Access blocked … Error 400: invalid_request", the client is not a\n"Desktop app": press Ctrl-C, create one (Credentials → Create credentials → OAuth client ID\n→ Desktop app), and re-run: just ready\n');
      spawnSync("open", [consent.href], { stdio: "ignore" });
    });
  });
}

async function exchange(clientId, clientSecret, code, redirectUri) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Token exchange failed: ${body.error_description ?? body.error ?? response.status}`);
  if (!body.refresh_token) {
    throw new Error("Google returned no refresh token. Remove this app at https://myaccount.google.com/permissions and re-run: just ready");
  }
  return body.refresh_token;
}

async function askHidden(question) {
  process.stdout.write(question);
  muted = true;
  const answer = await ask("");
  muted = false;
  process.stdout.write("\n");
  return answer;
}

function readEnv() {
  if (!existsSync(envPath)) return {};
  return Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, "$2")];
      }),
  );
}

function run(argv, stdio = "ignore") {
  return spawnSync(argv[0], argv.slice(1), { cwd: projectRoot, stdio }).status === 0;
}

function check(ok, label, hint) {
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : ` — ${hint}`}`);
  if (!ok) failures += 1;
  return ok;
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}
