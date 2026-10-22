const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const script = path.join(__dirname, "../../scripts/hina-connector-service.sh");

test("review mode emits a standalone user service before any installation", () => {
  const source = fs.readFileSync(script, "utf8");
  const unit = source.slice(source.indexOf("[Unit]"), source.indexOf("\nUNIT"));
  assert.match(unit, /^EnvironmentFile=\$\{env_file\/\/%\/%%\}$/m);
  assert.match(unit, /^WorkingDirectory=\$\{connector_root\/\/%\/%%\}$/m);
  assert.doesNotMatch(unit, /^WorkingDirectory=.*unit_quote/m);
  assert.match(unit, /UnsetEnvironment=OPENCLAW_SHELL OPENCLAW_CLI/);
  assert.match(unit, /Environment=\$\(unit_quote "OPENCLAW_BIN=\$openclaw_bin"\)/);
  assert.match(
    unit,
    /ExecStart=\$\(unit_quote "\$node_bin"\) \$\(unit_quote "\$connector_root\/dist\/server\.js"\)/
  );
  assert.match(unit, /Restart=on-failure/);
  assert.match(unit, /WantedBy=default.target/);
  assert.doesNotMatch(unit, /CONNECTOR_API_TOKEN=/);
  assert.ok(source.indexOf('if [[ "$mode" == --print-unit ]]') < source.indexOf("mkdir -p"));
});

test("installation preserves existing token content and probes only local health", () => {
  const source = fs.readFileSync(script, "utf8");
  assert.match(source, /flag: "wx", mode: 0o600/);
  assert.match(source, /randomBytes\(32\)/);
  assert.match(source, /error\.code !== "EEXIST"/);
  assert.match(source, /systemctl --user enable --now hina-connector\.service/);
  assert.match(source, /http:\/\/127\.0\.0\.1:3210\/health/);
  assert.doesNotMatch(source, /\/command|\/v1\/chat\/completions|openclaw\.json/);
});
