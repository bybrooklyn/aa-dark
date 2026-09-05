/*
 * Chrome Web Store Publish API v2 client.
 *
 *   node scripts/cws.mjs check [version]   status; refuse if a submission is pending or version is not newer
 *   node scripts/cws.mjs upload <zip>      upload a package, wait for async processing
 *   node scripts/cws.mjs publish           submit the uploaded package for review (auto-publishes on approval)
 *
 * Credentials come from the environment (see `just ready`): CWS_CLIENT_ID,
 * CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN. Each subcommand is safe to re-run on its own.
 */
import { readFile } from "node:fs/promises";

const PUBLISHER_ID = process.env.CWS_PUBLISHER_ID || "55307e7a-0630-4d79-a100-a029141ee6db";
const ITEM_ID = process.env.CWS_ITEM_ID || "fncnoagfclehaljfppnjpngaingeoimm";
const ITEM = `publishers/${PUBLISHER_ID}/items/${ITEM_ID}`;
const commands = { check, upload, publish };
let accessToken;

const [command, argument] = process.argv.slice(2);
if (!commands[command]) fail("Usage: node scripts/cws.mjs check [version] | upload <zip> | publish");
await commands[command](argument);

async function check(version) {
  const status = await fetchStatus();
  const published = status.publishedItemRevisionStatus;
  const submitted = status.submittedItemRevisionStatus;
  const publishedVersion = published?.distributionChannels?.[0]?.crxVersion;

  console.log(`Published: ${published?.state ?? "none"} ${publishedVersion ?? ""}`.trim());
  if (submitted) console.log(`Submitted: ${submitted.state} ${submitted.distributionChannels?.[0]?.crxVersion ?? ""}`.trim());
  if (status.lastAsyncUploadState) console.log(`Last upload: ${status.lastAsyncUploadState}`);
  if (status.takenDown) console.log("Item is taken down.");
  if (status.warned) console.log("Item has policy warnings.");

  if (submitted?.state === "PENDING_REVIEW") fail("A submission is pending review. Wait for it, or cancel it in the dashboard, before publishing again.");
  if (inProgress(status.lastAsyncUploadState)) fail("A previous upload is still processing; retry shortly.");
  if (version && publishedVersion && compareVersions(version, publishedVersion) <= 0) fail(`${version} is not newer than the published ${publishedVersion}.`);
}

async function upload(zipPath) {
  if (!zipPath) fail("upload needs a ZIP path.");
  const result = await api(`upload/v2/${ITEM}:upload`, {
    method: "POST",
    headers: { "content-type": "application/zip" },
    body: await readFile(zipPath),
  });

  let state = result.uploadState;
  const deadline = Date.now() + 120_000;
  while (inProgress(state) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    state = (await fetchStatus()).lastAsyncUploadState;
  }
  if (state !== "SUCCEEDED") fail(`Upload ended in state ${state}.`);
  console.log(`Uploaded ${result.crxVersion ?? zipPath}.`);
}

async function publish() {
  const result = await api(`v2/${ITEM}:publish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ publishType: "DEFAULT_PUBLISH" }),
  });
  for (const warning of result.warningInfo?.warnings ?? []) console.log(`Warning: ${warning.reason ?? ""} ${warning.description ?? ""}`.trim());
  if (!["PENDING_REVIEW", "PUBLISHED", "STAGED", "PUBLISHED_TO_TESTERS"].includes(result.state)) fail(`Publish ended in state ${result.state ?? JSON.stringify(result)}.`);
  console.log(`Submitted: ${result.state}${result.state === "PENDING_REVIEW" ? " (publishes automatically after review)" : ""}`);
}

function fetchStatus() {
  return api(`v2/${ITEM}:fetchStatus`);
}

async function api(path, init = {}) {
  const response = await fetch(`https://chromewebstore.googleapis.com/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${await token()}`, ...init.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) fail(`${init.method ?? "GET"} ${path} failed (HTTP ${response.status}): ${body.error?.message ?? JSON.stringify(body)}`);
  return body;
}

async function token() {
  if (accessToken) return accessToken;
  const { CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN } = process.env;
  if (!CWS_CLIENT_ID || !CWS_CLIENT_SECRET || !CWS_REFRESH_TOKEN) fail("Missing CWS_CLIENT_ID, CWS_CLIENT_SECRET, or CWS_REFRESH_TOKEN. Run: just ready");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CWS_CLIENT_ID, client_secret: CWS_CLIENT_SECRET, refresh_token: CWS_REFRESH_TOKEN, grant_type: "refresh_token" }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    fail(body.error === "invalid_grant"
      ? "Refresh token expired or revoked (consent screen left in Testing?). Run: just ready"
      : `Token request failed: ${body.error_description ?? body.error ?? response.status}`);
  }
  accessToken = body.access_token;
  return accessToken;
}

function inProgress(state) {
  return typeof state === "string" && state.endsWith("IN_PROGRESS");
}

function compareVersions(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
