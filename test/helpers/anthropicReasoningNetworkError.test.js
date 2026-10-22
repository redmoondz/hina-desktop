const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

// Exercise the actual registered IPC boundary. Remote provider work must never
// read credentials or reach the network, regardless of provider availability.
const handlersModulePath = require.resolve("../../src/helpers/ipcHandlers");
const originalLoad = Module._load;

const handlers = new Map();
let fetchBehavior = async () => {
  throw new Error("net::ERR_INTERNET_DISCONNECTED");
};

const electronStub = {
  app: {
    getPath: () => "/tmp",
    getName: () => "test",
    getVersion: () => "0.0.0",
    isPackaged: false,
    on: () => {},
    requestSingleInstanceLock: () => true,
  },
  ipcMain: {
    handle: (channel, fn) => handlers.set(channel, fn),
    on: () => {},
    removeHandler: () => {},
  },
  net: {
    fetch: async (...args) => fetchBehavior(...args),
  },
  BrowserWindow: class BrowserWindow {
    static getAllWindows() {
      return [];
    }
    static fromWebContents() {
      return null;
    }
  },
  shell: {},
  dialog: {},
  screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 0, height: 0 } }) },
  systemPreferences: { getMediaAccessStatus: () => "granted" },
  session: { fromPartition: () => ({}) },
  clipboard: {},
  nativeImage: {},
  globalShortcut: {},
  utilityProcess: {},
  MessageChannelMain: class {},
};

Module._load = function loadWithMocks(request, parent, isMain) {
  if (request === "electron") return electronStub;
  return originalLoad.call(this, request, parent, isMain);
};

// A permissive `this` for setupHandlers: registration only stores closures, so
// any manager not exercised by this handler can be an inert stub.
function anything() {
  return new Proxy(function () {}, {
    get: (t, prop) => {
      if (prop === Symbol.toPrimitive || prop === "toString") return () => "";
      if (prop === "then") return undefined;
      return anything();
    },
    apply: () => anything(),
  });
}

function buildFakeThis() {
  const target = {
    sessionId: "test-session",
    environmentManager: {
      getAnthropicKey: () => assert.fail("cloud inference read a provider key"),
    },
  };
  return new Proxy(target, {
    get: (t, prop) => (prop in t ? t[prop] : anything()),
  });
}

let anthropicHandler;
test.before(() => {
  delete require.cache[handlersModulePath];
  const IPCHandlers = require(handlersModulePath);
  const Ctor = IPCHandlers.default || IPCHandlers;
  Ctor.prototype.setupHandlers.call(buildFakeThis());
  anthropicHandler = handlers.get("process-anthropic-reasoning");
  assert.ok(anthropicHandler, "process-anthropic-reasoning must be registered");
});

test.after(() => {
  Module._load = originalLoad;
});

test("Anthropic reasoning is denied before offline network work", async () => {
  fetchBehavior = () => assert.fail("cloud inference reached the network");
  const result = await anthropicHandler({ sender: {} }, "hello", "claude-sonnet-5", null, {});
  assert.equal(result.success, false);
  assert.equal(result.code, "LOCAL_ONLY");
});

test("provider health cannot bypass the local-only reasoning boundary", async () => {
  fetchBehavior = () => assert.fail("cloud inference reached a healthy provider");
  const result = await anthropicHandler({ sender: {} }, "hello", "claude-sonnet-5", null, {});
  assert.equal(result.code, "LOCAL_ONLY");
  assert.equal(handlers.get("get-anthropic-key")().code, "LOCAL_ONLY");
});
