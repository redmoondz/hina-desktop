const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

test("Windows voices are enumerated and speech data travels on stdin, never in executable code", async () => {
  const { createHinaSpeech } = require("../../src/helpers/hinaSpeech");
  const requests = [];
  const execFile = (file, args, options, callback) => {
    const child = new EventEmitter();
    child.kill = () => {};
    child.stdin = new EventEmitter();
    child.stdin.end = (input) => {
      requests.push({ file, args, input });
      queueMicrotask(() =>
        callback(
          null,
          JSON.stringify({ ok: true, voices: [{ id: "Test voice", language: "ru-RU" }] })
        )
      );
    };
    return child;
  };
  const speech = createHinaSpeech({ platform: "win32", execFile });
  assert.equal((await speech.list()).voices[0].language, "ru-RU");
  const text = "Quotation ' and $(untrusted)";
  assert.equal((await speech.speak({ text, language: "ru-RU", voice: "Test voice" })).ok, true);
  assert.equal(JSON.parse(requests[1].input).text, text);
  assert.ok(!requests[1].args.join(" ").includes(text));
  assert.equal((await speech.speak({ text: "" })).ok, false);
});

test("speech reports unsupported platforms and process failures", async () => {
  const { createHinaSpeech } = require("../../src/helpers/hinaSpeech");
  const speech = createHinaSpeech({ platform: "linux" });
  assert.equal((await speech.list()).ok, false);
  assert.equal((await speech.speak({ text: "Hello" })).ok, false);
  const failed = createHinaSpeech({
    platform: "win32",
    execFile: (_file, _args, _options, callback) => {
      const child = {
        stdin: {
          on() {},
          end() {
            queueMicrotask(() => callback(new Error("Process failed"), ""));
          },
        },
      };
      return child;
    },
  });
  assert.equal((await failed.list()).ok, false);
});
