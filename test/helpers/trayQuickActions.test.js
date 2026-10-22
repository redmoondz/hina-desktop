const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { i18nMain } = require("../../src/helpers/i18nMain");

const dialogs = [];
let response = 0;
let updateLanguage = "en";
const dialog = {
  showMessageBox: async (options) => {
    dialogs.push(options);
    return { response };
  },
};

const originalLoad = Module._load;
Module._load = function loadTrayWithStubs(request, parent, isMain) {
  if (request === "electron") return { Tray: class {}, Menu: {}, nativeImage: {}, app: {}, dialog };
  if (request === "./debugLogger") return { info: () => undefined, debug: () => undefined };
  if (request === "./dockManager") return {};
  if (request === "./i18nMain")
    return {
      i18nMain: {
        t: (key, options) =>
          key.startsWith("settings") ? i18nMain.t(key, { lng: updateLanguage, ...options }) : key,
      },
    };
  return originalLoad.call(this, request, parent, isMain);
};
const TrayManager = require("../../src/helpers/tray");
Module._load = originalLoad;

function createTrayManager(calls, { dictating = false } = {}) {
  const trayManager = new TrayManager();
  trayManager.windowManager = {
    isDictationPanelVisible: () => false,
    isDictating: () => dictating,
    sendStartDictation: () => calls.push("start-dictation"),
    sendStopDictation: () => calls.push("stop-dictation"),
    sendOpenAssistantPanel: () => calls.push("assistant"),
    startManualMeeting: () => calls.push("meeting"),
  };
  return trayManager;
}

test("the tray menu offers local dictation and the agent without meeting actions", () => {
  const calls = [];
  const [listen, assistant, separator] = createTrayManager(calls).buildContextMenuTemplate();

  assert.deepEqual(
    [listen.label, assistant.label, separator.type],
    ["app.commandMenu.startListening", "app.commandMenu.askAssistant", "separator"]
  );

  listen.click();
  assistant.click();
  assert.deepEqual(calls, ["start-dictation", "assistant"]);
  assert.equal(
    createTrayManager([])
      .buildContextMenuTemplate()
      .some((item) => item.label === "app.commandMenu.startMeetingRecording"),
    false
  );
});

test("the tray's listen item stops the recording it reflects", () => {
  const calls = [];
  const [listen] = createTrayManager(calls, { dictating: true }).buildContextMenuTemplate();

  assert.equal(listen.label, "app.commandMenu.stopListening");
  listen.click();
  assert.deepEqual(calls, ["stop-dictation"]);
});

test("tray offers update checking without opening a settings window", async () => {
  const calls = [];
  const manager = createTrayManager(calls);
  manager.setUpdateManager({
    checkForUpdates: async () => {
      calls.push("check");
      return { updateAvailable: false };
    },
  });
  const item = manager
    .buildContextMenuTemplate()
    .find((entry) => entry.label === "Check for Updates");
  assert.ok(item);
  await item.click();
  assert.deepEqual(calls, ["check"]);
  assert.equal(dialogs.at(-1).message, "No Updates");
});

test("tray downloads an offered update and installs only after confirmation", async () => {
  const calls = [];
  const manager = createTrayManager(calls);
  manager.setUpdateManager({
    updateDownloaded: false,
    checkForUpdates: async () => ({ updateAvailable: true, version: "2.0.0" }),
    async downloadUpdate() {
      calls.push("download");
      this.updateDownloaded = true;
      return { success: true };
    },
    installUpdate: async () => {
      calls.push("install");
      return { success: true };
    },
  });
  response = 0;
  await manager.checkForUpdatesFromTray();
  assert.deepEqual(calls, ["download", "install"]);
});

test("tray cancellation leaves available updates untouched", async () => {
  const calls = [];
  const manager = createTrayManager(calls);
  manager.setUpdateManager({
    checkForUpdates: async () => ({ updateAvailable: true, version: "2.0.0" }),
    downloadUpdate: async () => calls.push("download"),
  });
  response = 1;
  await manager.checkForUpdatesFromTray();
  assert.deepEqual(calls, []);
});

test("tray reports network errors and clears its busy state", async () => {
  const manager = createTrayManager([]);
  manager.setUpdateManager({
    checkForUpdates: async () => {
      throw new Error("Offline");
    },
  });
  await manager.checkForUpdatesFromTray();
  assert.equal(dialogs.at(-1).message, "Couldn't check for updates");
  assert.equal(
    dialogs.at(-1).detail,
    "We had trouble checking for updates. Please try again later."
  );
  assert.equal(manager.isCheckingForUpdates, false);
});

test("tray installs a staged update without another network check", async () => {
  const calls = [];
  const manager = createTrayManager(calls);
  manager.setUpdateManager({
    updateDownloaded: true,
    checkForUpdates: async () => calls.push("check"),
    installUpdate: async () => {
      calls.push("install");
      return { success: true };
    },
  });
  response = 0;
  await manager.checkForUpdatesFromTray();
  assert.deepEqual(calls, ["install"]);
});

test("tray does not install after a failed download", async () => {
  const calls = [];
  const manager = createTrayManager(calls);
  manager.setUpdateManager({
    checkForUpdates: async () => ({ updateAvailable: true, version: "2.0.0" }),
    downloadUpdate: async () => {
      throw new Error("Offline");
    },
    installUpdate: async () => calls.push("install"),
  });
  response = 0;
  await manager.checkForUpdatesFromTray();
  assert.deepEqual(calls, []);
  assert.equal(dialogs.at(-1).message, "Couldn't download update");
});

test("a reachable repository with no releases shows its own result, not latest-version or failure copy", async () => {
  const manager = createTrayManager([]);
  manager.setUpdateManager({
    checkForUpdates: async () => ({ updateAvailable: false, status: "no-releases" }),
  });
  await manager.checkForUpdatesFromTray();
  assert.equal(dialogs.at(-1).type, "info");
  assert.equal(dialogs.at(-1).message, "No published releases");
  assert.doesNotMatch(dialogs.at(-1).detail, /settingsPage\.|latest version/);
});

test("tray ignores repeated clicks while a check is pending", async () => {
  let finish;
  let checks = 0;
  const manager = createTrayManager([]);
  manager.setUpdateManager({
    checkForUpdates: () => {
      checks += 1;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const pending = manager.checkForUpdatesFromTray();
  await manager.checkForUpdatesFromTray();
  assert.equal(checks, 1);
  finish({ updateAvailable: false });
  await pending;
  assert.equal(manager.isCheckingForUpdates, false);
});

test("update failure dialogs resolve actual English and Russian translation resources", async () => {
  try {
    for (const language of ["en", "ru"]) {
      updateLanguage = language;
      const manager = createTrayManager([]);
      manager.setUpdateManager({
        checkForUpdates: async () => {
          throw new Error("Offline");
        },
      });
      await manager.checkForUpdatesFromTray();
      const expected = i18nMain.t("settingsPage.general.updates.dialogs.checkFailed.description", {
        lng: language,
      });
      assert.equal(dialogs.at(-1).detail, expected);
      assert.doesNotMatch(dialogs.at(-1).detail, /^settings(Page)?\./);
    }
  } finally {
    updateLanguage = "en";
  }
});

test("unavailable development checks are not described as the latest version", async () => {
  const manager = createTrayManager([]);
  manager.setUpdateManager({
    checkForUpdates: async () => ({
      updateAvailable: false,
      message: "Update checks are disabled in development mode",
    }),
  });
  await manager.checkForUpdatesFromTray();
  assert.match(dialogs.at(-1).detail, /disabled in development mode/);
});
