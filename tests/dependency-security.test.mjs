import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const readJson = async (relativePath) =>
  JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));

function versionTuple(version, label) {
  assert.equal(typeof version, "string", `${label} must have a version string`);
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  assert.ok(match, `${label} must be pinned to a stable x.y.z version; received ${version}`);
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  const a = versionTuple(left, "left version");
  const b = versionTuple(right, "right version");
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

test("the locked Next.js release is outside the October 2026 affected ranges", async () => {
  const manifest = await readJson("../package.json");
  const lock = await readJson("../package-lock.json");
  const declared = manifest.dependencies?.next;
  const installed = lock.packages?.["node_modules/next"]?.version;

  assert.equal(declared, installed, "package.json and package-lock.json must pin the same Next.js version");
  const [major, minor, patch] = versionTuple(installed, "Next.js");
  if (major <= 15) {
    assert.ok(
      compareVersions(installed, "15.5.28") >= 0,
      `Next.js ${installed} is in the affected 10.x–15.5.27 range; use 15.5.28 or a later release`,
    );
  } else if (major === 16) {
    assert.ok(
      compareVersions(installed, "16.4.1") >= 0,
      `Next.js ${installed} is in the affected 16.0.0–16.4.0 range; use 16.4.1 or a later release`,
    );
  } else {
    assert.ok(major > 16 || (major === 16 && minor >= 4 && patch >= 1));
  }

  assert.ok(installed, "Next.js must exist in the production lockfile");
});

test("Next.js runtime, compiler, and lint packages remain patch-aligned", async () => {
  const manifest = await readJson("../package.json");
  const lock = await readJson("../package-lock.json");
  const nextVersion = lock.packages?.["node_modules/next"]?.version;
  assert.ok(nextVersion, "Next.js must exist in the lockfile");

  assert.equal(manifest.devDependencies?.["eslint-config-next"], nextVersion);
  assert.equal(lock.packages?.["node_modules/eslint-config-next"]?.version, nextVersion);
  assert.equal(lock.packages?.["node_modules/@next/eslint-plugin-next"]?.version, nextVersion);
  assert.equal(lock.packages?.["node_modules/@next/env"]?.version, nextVersion);

  const swcEntries = Object.entries(lock.packages ?? {}).filter(([path]) =>
    path.startsWith("node_modules/@next/swc-"),
  );
  assert.ok(swcEntries.length > 0, "Next.js native compiler packages must be locked");
  for (const [path, entry] of swcEntries) {
    assert.equal(entry.version, nextVersion, `${path} must match Next.js ${nextVersion}`);
  }
});

test("Next.js image-optimization workaround stays on a patched Sharp release", async () => {
  const lock = await readJson("../package-lock.json");
  const nextVersion = lock.packages?.["node_modules/next"]?.version;
  const sharpVersion = lock.packages?.["node_modules/sharp"]?.version;

  assert.ok(sharpVersion, "Sharp must remain present in the lockfile for image optimization");
  // Next.js 15.5.28 permits Sharp 0.35.5+; preserve that security floor so
  // lockfile regeneration cannot silently restore the vulnerable 0.34.x line.
  if (compareVersions(nextVersion, "15.5.28") >= 0 && versionTuple(nextVersion, "Next.js")[0] === 15) {
    assert.ok(
      compareVersions(sharpVersion, "0.35.5") >= 0,
      `Sharp ${sharpVersion} is below the patched 0.35.5 security floor`,
    );
  }
});

test("both CI and scheduled dependency audits fail closed when the registry cannot be reached", async () => {
  const ciWorkflow = await readFile(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  const scheduledWorkflow = await readFile(
    new URL("../.github/workflows/dependency-security.yml", import.meta.url),
    "utf8",
  );

  const unverifiedMarker = "Dependency status is unverified; investigate the registry outage and rerun the audit.";
  for (const [name, workflow] of [
    ["pull-request CI", ciWorkflow],
    ["scheduled dependency audit", scheduledWorkflow],
  ]) {
    const markerIndex = workflow.indexOf(unverifiedMarker);
    assert.notEqual(markerIndex, -1, name + " must report unavailable audit results as unverified");
    const errorIndex = workflow.lastIndexOf("::error::", markerIndex);
    const fallback = workflow.slice(
      errorIndex === -1 ? markerIndex : errorIndex,
      workflow.indexOf("\n            fi", markerIndex),
    );
    assert.match(fallback, /exit 1/, name + " must fail when it cannot verify dependencies");
    assert.doesNotMatch(fallback, /exit 0/, name + " must not treat an unverified audit as success");
    assert.match(fallback, /::error::/, name + " must emit an actionable CI error");
  }
});
