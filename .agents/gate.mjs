#!/usr/bin/env node
// Ship gate -- one implementation, every path.
//
// THE MAP THIS REPLACES. Before this file there were four ways a commit or push
// could happen and no two of them validated the same thing:
//
//   1. Antigravity `git commit`  -> .agents/oracle-gate.sh, which ran verify.mjs
//                                   against the WORKING TREE and computed its cache
//                                   bump from staged UNION unstaged changes.
//   2. Kenny/Claude at a terminal -> NOTHING. core.hooksPath was unset and .git/hooks
//                                   held only samples, so a hand-typed commit passed
//                                   through no gate at all.
//   3. `git push`                 -> nothing locally.
//   4. CI, after the push         -> the only staged-truth check, arriving too late to
//                                   stop anything, and its cache guard compares
//                                   HEAD~1..HEAD so a multi-commit push can hide a
//                                   missing bump in an earlier commit.
//
// So the gate that "protected" the repo had a hole wide enough to walk through, and
// the half that did run answered a question nobody asked: it certified the files on
// disk, not the files going into the commit. A partial stage -- fix in the editor,
// stage only some of it -- was gated green and committed red.
//
// WHAT THIS VALIDATES. `--staged` exports the git index to a temp directory and runs
// the oracle THERE, so what the gate certifies is what the commit will contain.
// `--head` does the same for the committed tip, for the push path.
//
// UNTRACKED FILES: this repo needs no overlay, and that was established by running
// the oracle inside a bare index export rather than assumed. The vault's snapshot
// carries zero-byte stubs of `personal/` because its wikilink graph spans an
// untracked tree; nothing here does. This repo's .gitignore holds `tools-*.mjs`
// (dev scripts) and `.agents/oracle-status.txt` (a scratch status line) -- verify.mjs
// reads neither. If that ever changes, the oracle fails loudly inside the snapshot
// rather than quietly passing, which is the failure mode worth having.
//
// WHAT IT STRUCTURALLY CANNOT SEE: everything verify.mjs cannot see (read its header),
// plus anything about the remote, the deployed build, or a `--no-verify` commit. A
// hook is a gate on the paths that run it, never a proof about the repository.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_CODE = /^(index\.html|styles\.css|js\/)/;
const CACHE_RE = /bayoaks-v(\d+)/;

const git = (root, args, opts = {}) =>
  execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });

function repoRoot() {
  try {
    return git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
  } catch {
    return null;
  }
}

// Export a tree to a temp dir. `index` = what a commit would contain; a committish =
// what that commit does contain. Returns { dir, cleanup } and cleanup is always safe.
function exportTree(root, treeish) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bayoaks-gate-"));
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  try {
    if (treeish === "index") {
      git(root, ["checkout-index", "-a", "-f", `--prefix=${dir}${path.sep}`]);
    } else {
      const tar = execFileSync("git", ["-C", root, "archive", treeish], { maxBuffer: 1 << 28 });
      execFileSync("tar", ["-x", "-C", dir], { input: tar });
    }
  } catch (error) {
    cleanup();
    throw error;
  }
  return { dir, cleanup };
}

const cacheVersion = (text) => (text ?? "").match(CACHE_RE)?.[0] ?? null;

function readFrom(root, ref, file) {
  try {
    return git(root, ["show", `${ref}:${file}`]);
  } catch {
    return null;
  }
}

export function runGate({ root = repoRoot(), mode = "staged", log = console.log } = {}) {
  if (!root) return { ok: false, reasons: ["not inside a git work tree -- the gate cannot resolve the repo, so nothing is certified"] };
  if (!fs.existsSync(path.join(root, "verify.mjs"))) {
    return { ok: false, reasons: [`no verify.mjs at ${root} -- the oracle is missing, so the gate fails closed`] };
  }

  const staged = mode === "staged";
  const treeish = staged ? "index" : "HEAD";
  const reasons = [];
  let snapshot = null;
  try {
    snapshot = exportTree(root, treeish);

    // 1. The oracle, against the exported tree -- not the working tree.
    let out;
    let oracleOk = true;
    try {
      out = execFileSync("node", ["verify.mjs"], { cwd: snapshot.dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 });
    } catch (error) {
      oracleOk = false;
      out = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    }
    if (!oracleOk || !/RESULT: ALL PASS/.test(out)) {
      const failed = out.split("\n").filter((l) => l.startsWith("FAIL ")).slice(0, 5).join("; ");
      reasons.push(`oracle is red in the ${staged ? "staged" : "committed"} tree -- ${failed || "run `node verify.mjs`"}. Fix the code; do not weaken the check.`);
    }

    // 2. The service-worker cache bump, computed from the same tree.
    // Staged: index vs HEAD. Push: the tip vs what the remote already has, which is
    // what CI's HEAD~1..HEAD misses when a push carries more than one commit.
    let changed = [];
    let baseRef = "HEAD";
    if (staged) {
      changed = git(root, ["diff", "--cached", "--name-only"]).split("\n").filter(Boolean);
    } else {
      baseRef = ["origin/main", "HEAD~1"].find((r) => {
        try { git(root, ["rev-parse", "--verify", r]); return true; } catch { return false; }
      });
      changed = baseRef ? git(root, ["diff", "--name-only", baseRef, "HEAD"]).split("\n").filter(Boolean) : [];
    }
    if (changed.some((f) => APP_CODE.test(f))) {
      const current = cacheVersion(fs.readFileSync(path.join(snapshot.dir, "sw.js"), "utf8"));
      const previous = cacheVersion(readFrom(root, staged ? "HEAD" : baseRef, "sw.js"));
      if (!current) {
        reasons.push("sw.js has no bayoaks-vN cache version string.");
      } else if (previous === current) {
        reasons.push(`app code changed (index.html / styles.css / js/) but the sw.js cache version is still ${current} -- phones would serve stale code. Bump it, then retry.`);
      }
    }
  } catch (error) {
    reasons.push(`gate could not validate the ${staged ? "staged" : "committed"} tree: ${String(error.message || error).trim()}`);
  } finally {
    if (snapshot) snapshot.cleanup();
  }

  if (reasons.length === 0) log(`gate: OK -- ${staged ? "staged" : "committed"} tree verified`);
  return { ok: reasons.length === 0, reasons };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv.includes("--head") ? "head" : "staged";
  const result = runGate({ mode });
  for (const reason of result.reasons) console.error(`gate: ${reason}`);
  process.exit(result.ok ? 0 : 1);
}
