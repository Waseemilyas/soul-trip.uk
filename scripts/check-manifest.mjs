#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  repoRoot,
  listIntendedServedFiles,
  listUntrackedNonIgnored,
  sha256File,
  isServedPath,
  isFingerprintExcluded
} from "./site-contract-lib.mjs";

const MANIFEST_NAME = "site-manifest.json";

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

const root = path.resolve(argValue("--root") ?? repoRoot());
const failures = [];

// Canonical expectation is derived ONLY from the working tree: the served file
// list (sorted by git) plus freshly computed digests. The manifest's own byte
// order is never trusted as a reference.
const served = await listIntendedServedFiles(root);
const expectedOrder = served.filter((rel) => rel !== MANIFEST_NAME && !isFingerprintExcluded(rel));

try {
  let raw;
  try {
    raw = await readFile(path.join(root, MANIFEST_NAME), "utf8");
  } catch {
    console.error(`check-manifest: ${MANIFEST_NAME} is missing at the repo root; run scripts/generate-manifest.mjs and commit the result`);
    process.exit(1);
  }

  const manifest = JSON.parse(raw);
  if (manifest.algorithm !== "sha256") failures.push(`unexpected algorithm "${manifest.algorithm ?? ""}"`);
  if (typeof manifest.files !== "object" || manifest.files === null || Array.isArray(manifest.files)) {
    failures.push("manifest.files is missing or not an object");
    for (const f of failures) console.error(`check-manifest: ${f}`);
    process.exit(1);
  }
  if (Object.prototype.hasOwnProperty.call(manifest.files, MANIFEST_NAME)) {
    failures.push(`${MANIFEST_NAME} must not list itself`);
  }

  const untracked = await listUntrackedNonIgnored(root);
  const ambiguous = untracked.filter((p) => p !== MANIFEST_NAME && isServedPath(p));
  if (ambiguous.length) {
    failures.push(
      `untracked non-ignored served files make the intended tree ambiguous:\n    ${ambiguous.join("\n    ")}`
    );
  }

  const expectedFiles = new Map();
  for (const rel of expectedOrder) {
    expectedFiles.set(rel, await sha256File(path.join(root, rel)));
  }

  const listedKeys = Object.keys(manifest.files);
  for (const rel of expectedOrder) {
    const actual = manifest.files[rel];
    if (actual === undefined) {
      failures.push(`served file "${rel}" is missing from the manifest`);
      continue;
    }
    if (actual !== expectedFiles.get(rel)) {
      failures.push(`"${rel}" content hash ${expectedFiles.get(rel).slice(0, 12)}… does not match manifest ${String(actual).slice(0, 12)}…`);
    }
  }
  for (const rel of listedKeys) {
    if (isFingerprintExcluded(rel)) {
      failures.push(`manifest lists "${rel}" which is excluded from the deploy fingerprint; re-run generate-manifest`);
      continue;
    }
    if (!expectedFiles.has(rel)) failures.push(`manifest lists "${rel}" which is not a served tracked file`);
  }

  // Ordering: the manifest may hold exactly the expected entries, yet in a
  // different sequence than the working tree produces. Hashes cannot catch
  // this; the derived order does.
  const listedSet = new Set(listedKeys);
  const expectedSet = new Set(expectedOrder);
  const sameEntries =
    listedKeys.length === expectedOrder.length &&
    listedKeys.every((k) => expectedSet.has(k)) &&
    expectedOrder.every((k) => listedSet.has(k));
  if (sameEntries) {
    const divergeAt = listedKeys.findIndex((k, i) => k !== expectedOrder[i]);
    if (divergeAt !== -1) {
      failures.push(
        `manifest entry ordering does not match the canonical working-tree order (first divergence at position ${divergeAt}: listed "${listedKeys[divergeAt]}", expected "${expectedOrder[divergeAt]}"); re-run generate-manifest`
      );
    }
  }

  const canonicalJson =
    JSON.stringify(
      { algorithm: "sha256", files: Object.fromEntries(expectedOrder.map((rel) => [rel, expectedFiles.get(rel)])) },
      null,
      2
    ) + "\n";
  if (!failures.length && raw !== canonicalJson) {
    failures.push(`${MANIFEST_NAME} bytes are not the canonical deterministic encoding (re-run generate-manifest)`);
  }
} catch (error) {
  failures.push(error.message);
}

if (failures.length) {
  console.error(`check-manifest: manifest is STALE or invalid (${failures.length} problem(s)):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`check-manifest: ${MANIFEST_NAME} matches the working tree exactly and is canonical.`);
