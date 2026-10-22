const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function loadAuthHook(localOnly) {
  const source = readFileSync("src/hooks/useAuth.ts", "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    window: { electronAPI: { localOnly } },
    require: (name) => {
      if (name === "../lib/auth") {
        return {
          authClient: {
            useSession() {
              throw new Error("Account session invoked");
            },
          },
        };
      }
      return {};
    },
  });
  return exports.useAuth;
}

test("the local edition resolves as ready without starting an account session", async () => {
  const state = loadAuthHook(true)();
  assert.equal(state.isLoaded, true);
  assert.equal(state.isSignedIn, false);
  assert.equal(state.isGracePeriodOnly, false);
  assert.equal(state.user, null);
  assert.equal(state.session, null);
  assert.equal(await state.refetch(), null);
});

test("upstream test fixtures still select the account implementation outside the local runtime", () => {
  assert.throws(() => loadAuthHook(false)(), /Account session invoked/);
});
