const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

for (const helper of ["key-listener", "fast-paste", "text-monitor"]) {
  for (const available of ["cl", "gcc", "clang"]) {
    test(`${helper} compiles with ${available} without interpreting path metacharacters`, () => {
      const file = path.join(__dirname, `../../scripts/build-windows-${helper}.js`);
      const source = fs.readFileSync(file, "utf8");
      const calls = [];
      const directory = String.raw`C:\builds\Hina & tools %TEMP%\scripts`;
      const context = vm.createContext({
        __dirname: directory,
        process: { platform: "win32" },
        console: { log() {} },
        require(name) {
          if (name === "path") return path.win32;
          if (name === "fs") return { existsSync: () => true };
          assert.equal(name, "child_process");
          return {
            spawnSync(command, args, options) {
              if (args[0] === "--capabilities") {
                return { status: 0, stdout: Buffer.from("selection-copy-v1") };
              }
              calls.push({ command, args, options });
              return command === available
                ? { status: 0 }
                : { status: null, error: { code: "ENOENT" } };
            },
          };
        },
      });
      // Exercise compilation without starting the downloader or touching disk.
      vm.runInContext(source.slice(0, source.lastIndexOf("main().catch")), context);
      assert.equal(context.tryCompile(), true);
      for (const call of calls) assert.equal(call.options.shell, false);
      const compilation = calls.at(-1);
      assert.equal(compilation.command, available);
      const root = path.win32.resolve(directory, "..");
      const input = path.win32.join(root, "resources", `windows-${helper}.c`);
      const output = path.win32.join(root, "resources", "bin", `windows-${helper}.exe`);
      assert.ok(compilation.args.includes(input));
      assert.ok(compilation.args.includes(available === "cl" ? `/Fe:${output}` : output));
    });
  }
}
