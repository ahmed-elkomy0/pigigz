#!/usr/bin/env bun
/**
 * Regenerates `server/.generated/privileged.contract.ts` from
 * `server/src/privileged.ts`.
 *
 * Inside Muse this file is produced by the platform build driver, so a
 * clean GitHub checkout (e.g. on Vercel) does not contain it — yet
 * `server/src/actions.ts` imports the contracts from `@space/privileged`,
 * which `server/tsconfig.json` maps to that generated file. Without it,
 * `bun build` fails with `Could not resolve: "@space/privileged"`.
 *
 * The contracts block in privileged.ts is a self-contained object literal
 * passed to `definePrivilegedContracts(...)` that only uses `z` from the
 * SDK, so we can lift it verbatim: find the call, balance its parentheses
 * (string- and comment-aware), and emit a module that re-declares the same
 * contracts. The privileged *handlers* (which read server secrets) stay in
 * privileged.ts and are never copied here.
 *
 * Runs as the first step of `bun run build:server`; writes the file only
 * when its content would change.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const serverDir = import.meta.dir;
const srcPath = join(serverDir, "src", "privileged.ts");
const outPath = join(serverDir, ".generated", "privileged.contract.ts");

const src = readFileSync(srcPath, "utf8");
const marker = "definePrivilegedContracts(";
const callStart = src.indexOf(marker);
if (callStart === -1) {
  console.error(`gen-privileged: ${marker} not found in ${srcPath}`);
  process.exit(1);
}

// Scan from the opening paren, tracking depth while skipping string
// literals and comments so braces/parens inside them don't miscount.
let i = callStart + marker.length - 1; // index of "("
let depth = 0;
let end = -1;
while (i < src.length) {
  const ch = src[i];
  const next = src[i + 1];
  if (ch === "/" && next === "/") {
    const nl = src.indexOf("\n", i);
    i = nl === -1 ? src.length : nl + 1;
    continue;
  }
  if (ch === "/" && next === "*") {
    const close = src.indexOf("*/", i + 2);
    if (close === -1) break;
    i = close + 2;
    continue;
  }
  if (ch === '"' || ch === "'" || ch === "`") {
    const quote = ch;
    i++;
    while (i < src.length && src[i] !== quote) {
      if (src[i] === "\\") i++;
      i++;
    }
    i++;
    continue;
  }
  if (ch === "(") depth++;
  if (ch === ")") {
    depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }
  i++;
}
if (end === -1) {
  console.error("gen-privileged: unbalanced definePrivilegedContracts( call");
  process.exit(1);
}

const objectLiteral = src.slice(callStart + marker.length, end).trim();
const generated = `// Generated from server/src/privileged.ts by server/gen-privileged.mjs. Do not edit.
import { definePrivilegedContracts, z } from "@hatch/space-sdk";

export const privileged = definePrivilegedContracts(${objectLiteral});
`;

mkdirSync(join(serverDir, ".generated"), { recursive: true });
if (!existsSync(outPath) || readFileSync(outPath, "utf8") !== generated) {
  writeFileSync(outPath, generated);
  console.log(`gen-privileged: wrote ${outPath}`);
} else {
  console.log("gen-privileged: contract already up to date");
}
