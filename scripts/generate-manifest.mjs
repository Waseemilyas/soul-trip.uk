#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  repoRoot,
  listIntendedServedFiles,
  listUntrackedNonIgnored,
  sha256File,
  isFingerprintExcluded
} from "./site-contract-lib.mjs";

export const MANIFEST_NAME = "site-manifest.json";

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

export function manifestPath(root) {
  return path.join(root, MANIFEST_NAME);
}

export async function buildManifest(root) {
  const untracked = await listUntrackedNonIgnored(root);
  const ambiguous = untracked.filter((p) => !p.endsWith(MANIFEST_NAME));
  if (ambiguous.length) {
    throw new Error(
      `untracked non-ignored files make the intended tree ambiguous; commit, gitignore or remove them first:\n  ${ambiguous.join("\n  ")}`
    );
  }
  const served = await listIntendedServedFiles(root);
  const files = {};
  for (const rel of served) {
    if (rel === MANIFEST_NAME || isFingerprintExcluded(rel)) continue;
    files[rel] = await sha256File(path.join(root, rel));
  }
  return JSON.stringify({ algorithm: "sha256", files }, null, 2) + "\n";
}

const root = path.resolve(argValue("--root") ?? repoRoot());
try {
  const content = await buildManifest(root);
  const target = manifestPath(root);
  let existing = null;
  try {
    existing = await readFile(target, "utf8");
  } catch {}
  if (existing === content) {
    console.log(`generate-manifest: ${MANIFEST_NAME} already up to date (${Object.keys(JSON.parse(content).files).length} files); not rewritten`);
  } else {
    await writeFile(target, content, { mode: 0o644 });
    console.log(`generate-manifest: wrote ${target} with ${Object.keys(JSON.parse(content).files).length} file entries`);
  }
} catch (error) {
  console.error(`generate-manifest: ${error.message}`);
  process.exit(1);
}
