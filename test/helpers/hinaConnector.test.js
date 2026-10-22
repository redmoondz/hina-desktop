const test = require("node:test");
const assert = require("node:assert/strict");
const { hinaRequest, connectorBase } = require("../../src/helpers/hinaConnector");

test("WSL requests stop their curl process when the connection deadline expires", async (t) => {
  const processApi = require("node:child_process");
  const execFile = processApi.execFile;
  let child;
  t.mock.method(processApi, "execFile", (_command, _args, options, callback) => {
    child = execFile(process.execPath, ["-e", "setTimeout(() => {}, 1000)"], options, callback);
    return child;
  });
  const controller = new AbortController();
  const { wslFetch } = require("../../src/helpers/hinaConnector");
  const pending = wslFetch("http://127.0.0.1:3210/health", {
    headers: {},
    signal: controller.signal,
  });
  controller.abort();
  const outcome = await Promise.race([
    pending.then(
      () => "resolved",
      () => "aborted"
    ),
    new Promise((resolve) => setTimeout(() => resolve("still waiting"), 100)),
  ]);
  assert.equal(outcome, "aborted");
  assert.equal(child.killed, true);
});

test("WSL transport keeps credentials off process arguments and preserves HTTP status", async (t) => {
  const childProcess = require("node:child_process");
  let config = "";
  t.mock.method(childProcess, "execFile", (executable, args, options, callback) => {
    assert.equal(executable, "wsl.exe");
    assert.ok(!JSON.stringify(args).includes("private-token"));
    assert.equal(options.windowsHide, true);
    queueMicrotask(() => callback(null, '{"ok":true}\n200'));
    return {
      stdin: {
        on() {},
        end(value) {
          config = value;
        },
      },
    };
  });
  const { wslFetch } = require("../../src/helpers/hinaConnector");
  const response = await wslFetch("http://127.0.0.1:3210/metrics", {
    headers: { Authorization: "Bearer private-token" },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.ok(config.includes("Bearer private-token"));
});

test("Connector URL accepts loopback with optional v1 and rejects credential leakage", () => {
  assert.equal(connectorBase("http://127.0.0.1:3210/v1/"), "http://127.0.0.1:3210");
  for (const url of [
    "https://example.com",
    "http://user:secret@localhost:3210",
    "file:///tmp",
    "http://localhost:3210/other",
  ]) {
    assert.throws(() => connectorBase(url));
  }
});

test("voice command uses authenticated Connector chat endpoint and returns Hina reply", async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ choices: [{ message: { content: "Connection works" } }] });
  };
  const result = await hinaRequest(
    { url: "http://localhost:3210/v1", token: "test-token", text: "Hello Hina" },
    fetcher
  );
  assert.deepEqual(result, { ok: true, reply: "Connection works" });
  assert.equal(calls[0].url, "http://localhost:3210/v1/chat/completions");
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-token");
  assert.deepEqual(JSON.parse(calls[0].options.body).messages, [
    { role: "user", content: "Hello Hina" },
  ]);
});

test("connection test checks agent identity and authenticated access without an agent turn", async () => {
  const urls = [];
  const result = await hinaRequest(
    { url: "http://localhost:3210", token: "test-token", check: true },
    async (url) => {
      urls.push(url);
      return Response.json(url.endsWith("health") ? { ok: true, agent: "hina" } : { ok: true });
    }
  );
  assert.deepEqual(result, { ok: true, reply: "Connected to Hina" });
  assert.deepEqual(urls, ["http://localhost:3210/health", "http://localhost:3210/metrics"]);
});

test("connection diagnostics identify unreachable endpoints, wrong service and rejected tokens", async () => {
  const args = { url: "http://localhost:3210", token: "test-token", check: true };
  const missing = await hinaRequest(args, async () => {
    throw new Error("test-token");
  });
  assert.match(missing.error, /Cannot reach.*Windows.*WSL/);
  const wrong = await hinaRequest(args, async () => new Response("not-json", { status: 200 }));
  assert.match(wrong.error, /Hina Connector/);
  const auth = await hinaRequest(args, async (url) =>
    url.endsWith("/health")
      ? Response.json({ ok: true, agent: "hina" })
      : new Response("test-token", { status: 401 })
  );
  assert.match(auth.error, /bearer token.*401/);
  assert.equal(auth.error.includes("test-token"), false);
});

test("authentication, network, empty replies and invalid inputs fail without exposing secrets", async () => {
  for (const fetcher of [
    async () => new Response("secret", { status: 401 }),
    async () => {
      throw new Error("test-token");
    },
    async () => Response.json({ choices: [] }),
  ]) {
    const result = await hinaRequest(
      { url: "http://localhost:3210", token: "test-token", text: "Hello" },
      fetcher
    );
    assert.equal(result.ok, false);
    assert.ok(!result.error.includes("test-token"));
    assert.ok(!result.error.includes("secret"));
  }
  for (const args of [
    null,
    {},
    { url: "http://localhost:3210", token: "", text: "hello" },
    { url: "http://localhost:3210", token: "test", text: " " },
  ]) {
    assert.equal((await hinaRequest(args)).ok, false);
  }
});
