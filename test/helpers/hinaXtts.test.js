const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { createHinaXtts } = require("../../src/helpers/hinaXtts");

function fixture(t, installed = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hina-xtts-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  if (installed) {
    fs.mkdirSync(path.join(root, "runtime/bin"), { recursive: true });
    fs.writeFileSync(path.join(root, "runtime/bin/python"), "");
    fs.writeFileSync(path.join(root, "installed.json"), '{"version":1}');
    const model = path.join(root, "models/tts/tts_models--multilingual--multi-dataset--xtts_v2");
    fs.mkdirSync(model, { recursive: true });
    for (const name of ["config.json", "model.pth", "vocab.json", "speakers_xtts.pth"])
      fs.writeFileSync(path.join(model, name), "fixture");
  }
  const children = [];
  const manager = createHinaXtts({
    root,
    scripts: "/scripts with spaces/xtts",
    platform: "linux",
    spawn(file, args, options) {
      const child = new EventEmitter();
      child.stdin = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.requests = [];
      child.stdin.write = (data) => child.requests.push(JSON.parse(data));
      child.kills = 0;
      child.kill = () => child.kills++;
      Object.assign(child, { file, args, options });
      children.push(child);
      return child;
    },
  });
  t.after(() => manager.stop());
  return { manager, root, children };
}

test("XTTS requires installation and validates requests before launching Python", async (t) => {
  const { manager, children } = fixture(t, false);
  assert.equal((await manager.speak({ text: "hello", language: "en" })).ok, false);
  for (const change of [
    { language: "unknown" },
    { speed: NaN },
    { speed: 9 },
    { temperature: 0 },
    { device: "remote" },
    { reference: "voice.py" },
    { text: "" },
    { voice: 1 },
  ]) {
    assert.equal((await manager.speak({ text: "hello", language: "en", ...change })).ok, false);
  }
  assert.equal(children.length, 0);
});

test("speech uses JSON stdin, offline environment and a warm worker for subsequent replies", async (t) => {
  const { manager, children } = fixture(t);
  const first = manager.speak({
    text: "Привет $(untrusted)",
    language: "ru-RU",
    speed: 1.2,
    temperature: 0.5,
  });
  const child = children[0];
  assert.equal(child.options.env.HF_HUB_OFFLINE, "1");
  assert.equal(child.options.env.TRANSFORMERS_OFFLINE, "1");
  assert.equal(child.requests[0].text, "Привет $(untrusted)");
  assert.equal(child.requests[0].speed, 1.2);
  assert.ok(!child.args.join(" ").includes("untrusted"));
  child.stdout.emit("data", '{"ok":true,"audio":"UklGRg=="}\n');
  assert.equal((await first).audio, "UklGRg==");
  const second = manager.speak({ text: "Hello", language: "en" });
  assert.equal(children.length, 1, "model must stay loaded between replies");
  child.stdout.emit("data", '{"ok":true,"audio":"second"}\n');
  assert.equal((await second).audio, "second");
});

test("stop cancels generation; a late exit cannot interfere with the replacement worker", async (t) => {
  const { manager, children } = fixture(t);
  const first = manager.speak({ text: "first", language: "en" });
  manager.stop();
  assert.deepEqual(await first, { ok: true, stopped: true });
  assert.equal(children[0].kills, 1);
  const second = manager.speak({ text: "second", language: "ru" });
  children[0].emit("exit", 1);
  children[1].stdout.emit("data", '{"ok":true}\n');
  assert.equal((await second).ok, true);
});

test("worker failure is actionable and permits restarting", async (t) => {
  const { manager, children } = fixture(t);
  const first = manager.list();
  children[0].stderr.emit("data", "CUDA is unavailable. Select CPU.");
  children[0].emit("exit", 1);
  assert.match((await first).error, /Select CPU/);
  const second = manager.list();
  children[1].stdout.emit("data", '{"ok":true,"voices":[{"id":"voice","name":"Voice"}]}\n');
  assert.equal((await second).voices[0].id, "voice");
});

test("installation needs explicit license acceptance and exposes failure without claiming readiness", (t) => {
  const { manager, children } = fixture(t, false);
  assert.equal(manager.install({ acceptLicense: false }).ok, false);
  assert.equal(children.length, 0);
  assert.equal(manager.install({ acceptLicense: true, device: "cpu" }).ok, true);
  assert.equal(manager.status().installing, true);
  assert.equal(manager.install({ acceptLicense: true }).ok, false);
  assert.ok(children[0].args.includes("--accept-license"));
  children[0].stderr.emit("data", "Model download failed");
  children[0].emit("exit", 1);
  assert.equal(manager.status().installed, false);
  assert.equal(manager.status().installing, false);
  assert.match(manager.status().error, /download failed/);
});

test("quitting disposes an in-progress installer and invalid installation options never launch", (t) => {
  const { manager, children } = fixture(t, false);
  assert.equal(manager.install(null).ok, false);
  assert.equal(manager.install({ acceptLicense: true, pythonPath: "relative/python" }).ok, false);
  assert.equal(children.length, 0);
  manager.install({ acceptLicense: true });
  manager.dispose();
  assert.equal(children[0].kills, 1);
  assert.equal(manager.status().installing, false);
});
