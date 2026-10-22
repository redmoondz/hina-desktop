const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");

const handlersModulePath = require.resolve("../../src/helpers/ipcHandlers");
const originalLoad = Module._load;

// Register the real IPC gateway against inert managers. Legacy credentials
// must remain inaccessible and may never move local history into an account.
const handlers = new Map();
const broadcasts = [];
const userDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "account-scope-ipc-"));
let tokenState = { token: null, generation: 0 };

const electronStub = {
  app: {
    getPath: () => userDataDirectory,
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
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "{}",
    }),
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
  if (parent?.filename === handlersModulePath) {
    if (request === "./tokenStore") {
      return {
        get: () => tokenState.token,
        getState: () => ({ ...tokenState }),
        clear: () => {
          tokenState = { token: null, generation: tokenState.generation + 1 };
          return { success: true, ...tokenState };
        },
        subscribe: () => () => {},
      };
    }
    if (request === "./windowBroadcast") {
      return { broadcastToWindows: (channel, data) => broadcasts.push([channel, data]) };
    }
  }
  return originalLoad.call(this, request, parent, isMain);
};

function anything() {
  return new Proxy(function () {}, {
    get: (target, property) => {
      if (property === Symbol.toPrimitive || property === "toString") return () => "";
      if (property === "then") return undefined;
      return anything();
    },
    apply: () => anything(),
  });
}

// Each call with the binding file as it stood then: a connect must be stopped
// only once the scope it ran under is gone.
const connectorCalls = [];
const connectorManager = {
  accountChanged: () => connectorCalls.push(["accountChanged", readBinding()?.accountId ?? null]),
  notifyStatusChanged: async () => connectorCalls.push(["notifyStatusChanged"]),
};

function readBinding() {
  return require("../../src/helpers/accountScopeBinding").read();
}

const databaseScopes = [];
const databaseManager = new Proxy(
  { setActiveAccountId: (accountId) => databaseScopes.push(accountId) },
  { get: (value, property) => (property in value ? value[property] : anything()) }
);

function buildFakeThis() {
  const target = { sessionId: "test-session", connectorManager, databaseManager };
  return new Proxy(target, {
    get: (value, property) => (property in value ? value[property] : anything()),
  });
}

let fakeThis;

test.before(() => {
  delete require.cache[handlersModulePath];
  const IPCHandlers = require(handlersModulePath);
  const Ctor = IPCHandlers.default || IPCHandlers;
  fakeThis = buildFakeThis();
  Ctor.prototype.setupHandlers.call(fakeThis);
});

test.after(() => {
  fakeThis.metaActivation?.dispose?.();
  Module._load = originalLoad;
  fs.rmSync(userDataDirectory, { recursive: true, force: true });
});

const getScope = () => handlers.get("get-active-account-scope")();
const setScope = (accountId, generation) =>
  handlers.get("set-active-account-scope")({}, accountId, generation);

test("no scope is readable before a session has been validated", async () => {
  tokenState = { token: "token-a", generation: 1 };
  assert.equal(await getScope(), null);
});

test("local account scope changes cannot move history or broadcast an identity", async () => {
  tokenState = { token: "legacy-token", generation: 3 };
  broadcasts.length = 0;
  databaseScopes.length = 0;
  connectorCalls.length = 0;
  for (const account of ["remote-account", null]) {
    const result = await setScope(account, 3);
    assert.equal(result.success, false);
    assert.equal(result.code, "LOCAL_ONLY");
  }
  assert.equal(await getScope(), null);
  assert.equal(readBinding(), null);
  assert.deepEqual(databaseScopes, []);
  assert.deepEqual(connectorCalls, []);
  assert.deepEqual(broadcasts, []);
});

test("legacy bearer IPC cannot read, rotate, or clear stored credentials", async () => {
  tokenState = { token: "legacy-token", generation: 4 };
  for (const channel of [
    "auth-get-token",
    "auth-get-token-state",
    "auth-set-token",
    "auth-clear-session",
  ]) {
    const result = await handlers.get(channel)({ sender: {} }, "replacement", 4);
    assert.equal(result.success, false, channel);
    assert.equal(result.code, "LOCAL_ONLY", channel);
    assert.equal(JSON.stringify(result).includes("legacy-token"), false);
  }
  assert.deepEqual(tokenState, { token: "legacy-token", generation: 4 });
});

test("the real IPC registry denies checkout, cloud inference and account deletion", async () => {
  for (const channel of [
    "cloud-checkout",
    "cloud-billing-portal",
    "cloud-transcribe",
    "cloud-reason",
    "delete-account-data",
  ]) {
    const result = await handlers.get(channel)({ sender: {} }, {});
    assert.equal(result.code, "LOCAL_ONLY", channel);
    assert.equal(result.success, false, channel);
  }
});
