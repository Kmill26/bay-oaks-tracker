import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runGate } from "./gate.mjs";

// Acceptance for the ship gate. Every case runs against a real clone of this repo,
// so the oracle under test is the actual oracle, and mutates ONLY the clone.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = (root, ...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const snapshots = () => fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("bayoaks-gate-")).length;
const quiet = () => {};

// The clone is of HEAD, so it carries the last COMMITTED gate. Sync the working-tree
// versions in and commit them, or these tests would grade yesterday's gate -- the same
// staged-vs-working-tree confusion the gate itself exists to remove.
// verify.mjs is in this list because block 20d asserts the gate's own topology:
// syncing a new gate without its oracle would grade the new gate against the old
// assertions and fail for the wrong reason.
const GATE_FILES = [".agents/gate.mjs", ".agents/oracle-gate.sh", "hooks/pre-commit", "hooks/pre-push",
  "install-hooks.mjs", "verify.mjs", "package.json"];

function clone() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bayoaks-clone-"));
  const root = path.join(dir, "repo");
  execFileSync("git", ["clone", "-q", REPO, root], { stdio: ["ignore", "pipe", "pipe"] });
  git(root, "config", "user.email", "test@example.com");
  git(root, "config", "user.name", "gate test");

  for (const rel of GATE_FILES) {
    const src = path.join(REPO, rel);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    fs.chmodSync(dest, fs.statSync(src).mode);
  }
  git(root, "add", "-A");
  // Nothing here is app code, so no cache bump is owed; hooks are not armed yet.
  try { git(root, "commit", "-q", "-m", "sync gate under test"); } catch { /* already identical */ }
  return root;
}

// A defect the oracle cannot miss: js/ is concatenated and eval'd, so this throws.
const BREAK = "\nthis is not valid javascript at all\n";
const bumpCache = (root) => {
  const p = path.join(root, "sw.js");
  const t = fs.readFileSync(p, "utf8");
  const n = Number(t.match(/bayoaks-v(\d+)/)[1]) + 1;
  fs.writeFileSync(p, t.replace(/bayoaks-v\d+/, `bayoaks-v${n}`));
};

test("baseline: a clean clone passes both modes", () => {
  const root = clone();
  assert.equal(runGate({ root, mode: "staged", log: quiet }).ok, true);
  assert.equal(runGate({ root, mode: "head", log: quiet }).ok, true);
});

// (1) A staged defect fails even though the working tree is repaired.
// This is the exact hole: the old gate ran the oracle on disk, so this passed.
test("staged defect FAILS despite a repaired working tree", () => {
  const root = clone();
  const file = path.join(root, "js/seed.js");
  const clean = fs.readFileSync(file, "utf8");

  fs.writeFileSync(file, clean + BREAK);
  git(root, "add", "js/seed.js");
  fs.writeFileSync(file, clean); // repair exists ONLY in the working tree

  const result = runGate({ root, mode: "staged", log: quiet });
  assert.equal(result.ok, false, "the staged tree is broken and must be rejected");
  assert.match(result.reasons.join(" "), /oracle is red in the staged tree/);

  // And the working tree really is clean -- the green the old gate reported.
  execFileSync("node", ["verify.mjs"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
});

// (2) An unstaged defect must not invalidate clean staged content.
test("unstaged defect does NOT invalidate a clean staged tree", () => {
  const root = clone();
  const file = path.join(root, "js/seed.js");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8") + BREAK); // working tree only, never staged

  const result = runGate({ root, mode: "staged", log: quiet });
  assert.equal(result.ok, true, `a defect that is not staged is not in the commit: ${result.reasons.join("; ")}`);
});

// (3) Temp snapshots are cleaned up on both paths.
test("snapshots are removed on pass and on failure", () => {
  const root = clone();
  const before = snapshots();
  assert.equal(runGate({ root, mode: "staged", log: quiet }).ok, true);
  assert.equal(snapshots(), before, "green run leaked a snapshot");

  const file = path.join(root, "js/seed.js");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8") + BREAK);
  git(root, "add", "js/seed.js");
  assert.equal(runGate({ root, mode: "staged", log: quiet }).ok, false);
  assert.equal(snapshots(), before, "red run leaked a snapshot");
});

// (4) The check blocks the operation it claims to guard -- a real `git commit`.
test("the armed pre-commit hook actually BLOCKS a real commit", () => {
  const root = clone();
  execFileSync("node", ["install-hooks.mjs"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(git(root, "config", "--get", "core.hooksPath").trim(), "hooks");

  const head = git(root, "rev-parse", "HEAD").trim();
  const file = path.join(root, "js/seed.js");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8") + BREAK);
  git(root, "add", "js/seed.js");

  let blocked = false;
  try {
    git(root, "commit", "-m", "should not land");
  } catch {
    blocked = true;
  }
  assert.equal(blocked, true, "the commit was not blocked");
  assert.equal(git(root, "rev-parse", "HEAD").trim(), head, "HEAD moved -- the commit landed anyway");
});

test("the armed hook still lets a clean commit through", () => {
  const root = clone();
  execFileSync("node", ["install-hooks.mjs"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  const head = git(root, "rev-parse", "HEAD").trim();

  fs.writeFileSync(path.join(root, "docs/gate-test-note.md"), "not app code\n");
  git(root, "add", "docs/gate-test-note.md");
  git(root, "commit", "-m", "clean change");

  assert.notEqual(git(root, "rev-parse", "HEAD").trim(), head, "a clean commit must land");
});

// The cache-bump rule, computed from the staged tree rather than staged-union-unstaged.
test("staged app code without a cache bump FAILS; with a bump it passes", () => {
  const root = clone();
  const file = path.join(root, "js/seed.js");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8") + "\n// harmless comment\n");
  git(root, "add", "js/seed.js");

  const missing = runGate({ root, mode: "staged", log: quiet });
  assert.equal(missing.ok, false);
  assert.match(missing.reasons.join(" "), /cache version is still bayoaks-v\d+/);

  bumpCache(root);
  git(root, "add", "sw.js");
  assert.equal(runGate({ root, mode: "staged", log: quiet }).ok, true);
});

// A bump sitting unstaged does not satisfy the rule -- it is not in the commit.
test("an UNSTAGED cache bump does not satisfy the staged rule", () => {
  const root = clone();
  const file = path.join(root, "js/seed.js");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8") + "\n// harmless comment\n");
  git(root, "add", "js/seed.js");
  bumpCache(root); // edited, never staged

  const result = runGate({ root, mode: "staged", log: quiet });
  assert.equal(result.ok, false, "a bump that is not staged is not in the commit");
});

// (4b) The push path catches what pre-commit could not: --no-verify, or a commit
// made before the hooks were armed.
test("--head rejects a committed defect that bypassed pre-commit", () => {
  const root = clone();
  const file = path.join(root, "js/seed.js");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8") + BREAK);
  git(root, "add", "js/seed.js");
  git(root, "commit", "--no-verify", "-m", "bypassed the hook");

  const result = runGate({ root, mode: "head", log: quiet });
  assert.equal(result.ok, false, "the committed tip is broken and must not reach the remote");
  assert.match(result.reasons.join(" "), /oracle is red in the committed tree/);
});

test("a repo with no verify.mjs fails closed", () => {
  const root = clone();
  fs.rmSync(path.join(root, "verify.mjs"));
  const result = runGate({ root, mode: "staged", log: quiet });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join(" "), /fails closed/);
});
