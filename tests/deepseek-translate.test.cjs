const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("esbuild");

const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "deepseek-translate-test-")), "translator.cjs");
esbuild.buildSync({
  entryPoints: [path.join(__dirname, "../src/deepseek-translate.ts")],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["@raycast/api", "undici"],
});

let calls = 0;
let translation = "";
let source = "en";
const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "@raycast/api") return { getPreferenceValues: () => ({ apiKey: "test-key" }) };
  if (request === "undici")
    return {
      fetch: async () => {
        calls++;
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: JSON.stringify({ translation, detected_language: source }) } }] }),
        };
      },
    };
  return load.apply(this, arguments);
};
const { translate } = require(output);
Module._load = load;

test("English to English displays the original without an API request", async () => {
  calls = 0;
  const result = await translate("translate", { from: "en", to: "en" });
  assert.equal(result.text, "translate");
  assert.equal(calls, 0);
});

test("Auto-Detect English to English displays the original even when DeepSeek returns empty", async () => {
  calls = 0;
  translation = "";
  source = "en";
  const result = await translate("translate", { from: "auto", to: "en" });
  assert.equal(result.text, "translate");
  assert.equal(result.from.language.iso, "en");
  assert.equal(calls, 1);
});

test("Auto-Detect Chinese to Chinese also keeps the original", async () => {
  calls = 0;
  translation = "";
  source = "zh-CN";
  const result = await translate("翻译", { from: "auto", to: "zh-CN" });
  assert.equal(result.text, "翻译");
  assert.equal(calls, 1);
});

test("Auto-Detect English to Chinese uses the DeepSeek translation", async () => {
  calls = 0;
  translation = "翻译";
  source = "en";
  const result = await translate("translate", { from: "auto", to: "zh-CN" });
  assert.equal(result.text, "翻译");
  assert.equal(calls, 1);
});
