const test = require("node:test");
const assert = require("node:assert/strict");

test("dictionary budgets identify Groq by parsed hostname", async () => {
  const { dictionaryPromptLimit, GROQ_PROMPT_CHARS, WHISPER_PROMPT_CHARS } =
    await import("../../src/utils/dictionaryPromptCap.js");
  for (const endpoint of ["https://api.groq.com/openai/v1", "https://API.GROQ.COM:443/v1"]) {
    assert.equal(dictionaryPromptLimit({ endpoint }), GROQ_PROMPT_CHARS, endpoint);
  }
  for (const endpoint of [
    "https://api.groq.com.attacker.example/v1",
    "https://attacker.example/api.groq.com",
    "https://api.groq.com@attacker.example/v1",
    "invalid api.groq.com",
    "",
  ]) {
    assert.equal(dictionaryPromptLimit({ endpoint }), WHISPER_PROMPT_CHARS, endpoint);
  }
});
