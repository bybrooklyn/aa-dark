import assert from "node:assert/strict";
import test from "node:test";
import { classifyPath, stripLocale } from "../../src/route-classifier.mjs";

test("strips supported locale prefixes without changing ordinary paths", () => {
  assert.equal(stripLocale("/de/leaderboards/models"), "/leaderboards/models");
  assert.equal(stripLocale("/ja"), "/");
  assert.equal(stripLocale("/models/de-model"), "/models/de-model");
  assert.equal(stripLocale("models/recommend?x=1"), "/models/recommend");
});

test("classifies every supported public template family", () => {
  const cases = new Map([
    ["/", "home"],
    ["/leaderboards/models", "models"],
    ["/models/claude-opus-5", "models"],
    ["/providers/deepseek", "providers"],
    ["/hardware-inference-stack/nvidia", "providers"],
    ["/agents/coding", "agents"],
    ["/tools", "agents"],
    ["/evaluations/gpqa-diamond", "evaluations"],
    ["/microevals", "evaluations"],
    ["/articles/search-api", "articles"],
    ["/trends", "articles"],
    ["/changelog", "articles"],
    ["/image/arena", "image"],
    ["/video/arena", "video"],
    ["/music/models/example", "video"],
    ["/text-to-speech/voice-playground", "speech"],
    ["/speech-to-text/non-streaming", "speech"],
    ["/speech-to-speech/arena", "speech"],
    ["/data-api/docs", "docs"],
    ["/api-reference", "docs"],
    ["/methodology", "marketing"],
    ["/contact", "marketing"],
    ["/de/leaderboards/providers", "models"],
    ["/zh/image/leaderboard/text-to-image", "image"],
  ]);

  for (const [path, expected] of cases) assert.equal(classifyPath(path), expected, path);
});

test("unknown top-level routes fail closed for the live sitemap audit", () => {
  assert.equal(classifyPath("/future-product"), "unknown");
});
