const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
let template;
const originalLoad = Module._load;
Module._load = function localMenuStubs(request, parent, isMain) {
  if (request === "electron")
    return {
      Menu: {
        buildFromTemplate: (items) => {
          template = items;
          return items;
        },
        setApplicationMenu() {},
      },
    };
  if (request === "./i18nMain") return { i18nMain: { t: (key) => key } };
  return originalLoad.call(this, request, parent, isMain);
};
const MenuManager = require("../../src/helpers/menuManager");
Module._load = originalLoad;

test("the macOS settings menu stays local and opens settings directly", () => {
  const platform = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
  try {
    let opened = false;
    MenuManager.setupControlPanelMenu({}, () => {
      opened = true;
    });
    assert.equal(
      template.some((item) => item.label === "menu.help"),
      false
    );
    template[0].submenu.find((item) => item.label === "menu.settings").click();
    assert.equal(opened, true);
  } finally {
    Object.defineProperty(process, "platform", platform);
  }
});
