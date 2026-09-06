#!/usr/bin/env node
// Arms the tracked hooks in hooks/ by pointing git at them.
//
// .git/hooks is not version-controlled, so a tracked hook does nothing until this
// runs. Same pattern as the vault's scripts/install-hooks.mjs. Run once per clone:
//   node install-hooks.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const dir = path.join(root, "hooks");
for (const hook of ["pre-commit", "pre-push"]) {
  const file = path.join(dir, hook);
  if (!fs.existsSync(file)) {
    console.error(`missing ${path.relative(root, file)} -- nothing to arm`);
    process.exit(1);
  }
  fs.chmodSync(file, 0o755);
}
execFileSync("git", ["-C", root, "config", "core.hooksPath", "hooks"]);
const set = execFileSync("git", ["-C", root, "config", "--get", "core.hooksPath"], { encoding: "utf8" }).trim();
if (set !== "hooks") {
  console.error(`core.hooksPath is "${set}", expected "hooks"`);
  process.exit(1);
}
console.log("hooks armed: core.hooksPath -> hooks (pre-commit, pre-push)");
