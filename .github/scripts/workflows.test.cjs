const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const yaml = require("js-yaml");

function workflow(name) {
  return yaml.load(fs.readFileSync(`.github/workflows/${name}.yml`, "utf8"));
}

test("desktop CI checks and builds all supported platforms", () => {
  const ci = workflow("build-and-notarize");
  assert.deepEqual(ci.on.push.branches, ["main"]);
  assert.ok(ci.on.pull_request === null);
  for (const platform of ["linux", "windows", "macos"]) {
    assert.equal(ci.jobs[`build-${platform}`].needs, "quality");
  }
  assert.deepEqual(ci.jobs["build-macos"].strategy.matrix.arch, ["x64", "arm64"]);
});

test("release validates the tag and publishes only after CI succeeds", () => {
  const release = workflow("release");
  assert.deepEqual(release.on.push.tags, ["v*.*.*"]);
  assert.equal(release.jobs.build.needs, "validate");
  assert.equal(release.jobs.build.uses, "./.github/workflows/build-and-notarize.yml");
  assert.equal(release.jobs.publish.needs, "build");
  const publish = release.jobs.publish.steps.find(
    (step) => step.name === "Create and publish release"
  );
  assert.match(publish.run, /gh release create .*--draft/);
  assert.match(publish.run, /gh release edit .*--draft=false/);
});

test("Hina CI excludes upstream canaries and package publication", () => {
  for (const name of ["llm-canary", "stt-canary", "mobile-ci", "update-nix", "update-winget"]) {
    assert.equal(fs.existsSync(`.github/workflows/${name}.yml`), false);
  }
});
