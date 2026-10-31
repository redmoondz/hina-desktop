const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function fixture() {
  const players = [],
    revoked = [],
    pending = [],
    values = new Map();
  let stops = 0;
  let remoteStop;
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/helpers/hinaSpeechPlayback.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      Uint8Array,
      Blob,
      atob: (s) => Buffer.from(s, "base64").toString("binary"),
      URL: { createObjectURL: () => "blob:local", revokeObjectURL: (url) => revoked.push(url) },
      localStorage: { getItem: (key) => values.get(key) ?? null },
      window: {
        electronAPI: {
          onHinaSpeechPlaybackStop: (callback) => {
            remoteStop = callback;
            return () => {};
          },
          hinaSpeechSpeak: (args) => new Promise((resolve) => pending.push({ args, resolve })),
          hinaSpeechStop: async () => {
            stops++;
            return { ok: true };
          },
        },
      },
      Audio: class {
        constructor(url) {
          this.url = url;
          players.push(this);
        }
        play() {
          return Promise.resolve();
        }
        pause() {
          this.paused = true;
        }
      },
    }
  );
  return {
    ...exports,
    players,
    pending,
    revoked,
    values,
    remoteStop: () => remoteStop(),
    stops: () => stops,
  };
}

test("local WAV stays speaking until playback ends and honors volume", async () => {
  const f = fixture();
  f.values.set("hinaSpeechEngine", "xtts");
  f.values.set("hinaSpeechVolume", "0.4");
  let done = false;
  const speech = f.speakHinaReply("Привет").then((result) => {
    done = true;
    return result;
  });
  assert.equal(f.pending[0].args.engine, "xtts");
  f.pending[0].resolve({ ok: true, audio: "UklGRg==" });
  await new Promise(setImmediate);
  assert.equal(done, false);
  assert.equal(f.players[0].volume, 0.4);
  f.players[0].onended();
  assert.equal((await speech).ok, true);
  assert.equal(f.revoked.length, 1);
});

test("stop during generation prevents late audio playback", async () => {
  const f = fixture();
  const speech = f.speakHinaReply("hello");
  await f.stopHinaReply();
  f.pending[0].resolve({ ok: true, audio: "UklGRg==" });
  assert.equal((await speech).stopped, true);
  assert.equal(f.players.length, 0);
  assert.equal(f.stops(), 1);
});

test("stop during playback releases audio and resolves the speech request", async () => {
  const f = fixture();
  const speech = f.speakHinaReply("hello");
  f.pending[0].resolve({ ok: true, audio: "UklGRg==" });
  await new Promise(setImmediate);
  await f.stopHinaReply();
  assert.equal((await speech).stopped, true);
  assert.equal(f.players[0].paused, true);
  assert.equal(f.revoked.length, 1);
});

test("preferences keep system voices as default and reject corrupt numeric values", () => {
  const f = fixture();
  f.values.set("hinaSpeechSpeed", "NaN");
  f.values.set("hinaSpeechTemperature", "99");
  assert.equal(f.storedSpeechOptions().engine, "windows");
  assert.equal(f.storedSpeechOptions().speed, 1);
  assert.equal(f.storedSpeechOptions().temperature, 0.65);
});

test("a stop notification from another Hina window prevents stale playback", async () => {
  const f = fixture();
  const speech = f.speakHinaReply("hello");
  f.remoteStop();
  f.pending[0].resolve({ ok: true, audio: "UklGRg==" });
  assert.equal((await speech).stopped, true);
  assert.equal(f.players.length, 0);
});
