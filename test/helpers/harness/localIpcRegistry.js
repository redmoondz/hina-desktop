const assert = require("node:assert/strict");
const Module = require("node:module");

function inert() {
  return new Proxy(function () {}, {
    get: (_target, property) => {
      if (property === Symbol.toPrimitive || property === "toString") return () => "";
      if (property === "then") return undefined;
      return inert();
    },
    apply: () => inert(),
  });
}

// Register production handlers through the actual local-only gateway. Tests
// must fail if a removed feature reaches credentials, network, or a manager.
function registerLocalIpc({ environmentManager = inert(), managers = {} } = {}) {
  const handlers = new Map();
  const listeners = new Map();
  const notifications = [];
  const modulePath = require.resolve("../../../src/helpers/ipcHandlers");
  const electron = {
    app: { getPath: () => "/tmp", getName: () => "test", getVersion: () => "0.0.0", on() {} },
    ipcMain: {
      handle: (channel, fn) => handlers.set(channel, fn),
      on: (channel, fn) => listeners.set(channel, fn),
      removeHandler() {},
    },
    net: { fetch: () => assert.fail("a removed feature reached the network") },
    BrowserWindow: {
      fromWebContents: () => null,
      getAllWindows: () => [
        {
          isDestroyed: () => false,
          webContents: { id: 2, send: (...args) => notifications.push(args) },
        },
      ],
    },
    screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 0, height: 0 } }) },
    systemPreferences: { getMediaAccessStatus: () => "granted" },
    session: { fromPartition: () => ({}) },
  };
  const originalLoad = Module._load;
  Module._load = function localRegistryStubs(request, parent, isMain) {
    if (request === "electron") return electron;
    if (request === "./debugLogger") return new Proxy({}, { get: () => () => {} });
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[modulePath];
    const IPCHandlers = require(modulePath);
    IPCHandlers.prototype.setupHandlers.call(
      new Proxy(
        { environmentManager, ...managers },
        {
          get: (target, property) => (property in target ? target[property] : inert()),
        }
      )
    );
  } finally {
    Module._load = originalLoad;
  }
  return {
    handlers,
    listeners,
    notifications,
    invoke: (channel, ...args) => {
      assert.ok(handlers.has(channel), `handler registered: ${channel}`);
      return handlers.get(channel)({ sender: { id: 1 } }, ...args);
    },
  };
}

module.exports = { registerLocalIpc };
