#!/usr/bin/env node
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "./site-contract-lib.mjs";

const MANIFEST_NAME = "site-manifest.json";

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

// Statuses a CDN edge can produce transiently for a single asset while every
// sibling serves fine. Observed in production on 2026-08-29: GitHub Pages
// returned one 503 for images/business/saudi-pavilion-trade-show.jpg while the
// manifest and all other files verified green in the same run, and the asset
// served 200 again seconds later. With one attempt per file, that single edge
// hiccup turned the whole uptime run red — a false alarm.
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBytes(url) {
  // Retry only transient statuses and network/timeout errors, with bounded
  // backoff. 4xx and content-hash mismatches stay hard, immediate failures —
  // a retry must never mask a file that is genuinely missing or wrong.
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(20000) });
      const body = Buffer.from(await res.arrayBuffer());
      if (TRANSIENT_STATUSES.has(res.status) && attempt < MAX_ATTEMPTS) {
        await sleep(500 * attempt);
        continue;
      }
      return { status: res.status, body };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await sleep(500 * attempt);
    }
  }
  throw lastError;
}

export async function verifyOrigin(base, expectedManifestBytes, log) {
  const baseDir = base.endsWith("/") ? base : base + "/";
  const problems = [];
  let checked = 0;
  let manifest;
  try {
    manifest = await fetchBytes(new URL(MANIFEST_NAME, baseDir).href);
  } catch (error) {
    return { ok: false, checked: 0, problems: [`${MANIFEST_NAME} could not be fetched from ${baseDir}: ${error.message}`] };
  }
  if (manifest.status !== 200) {
    problems.push(`${MANIFEST_NAME} is not served (HTTP ${manifest.status}); production is running a build without a published artifact manifest`);
    return { ok: false, checked: 0, problems };
  }
  if (!manifest.body.equals(expectedManifestBytes)) {
    problems.push(
      `live ${MANIFEST_NAME} differs from the intended local manifest (live ${manifest.body.length} bytes vs intended ${expectedManifestBytes.length}); production is NOT serving this tree`
    );
    return { ok: false, checked: 0, problems };
  }
  const entries = Object.entries(JSON.parse(manifest.body.toString("utf8")).files);
  for (const [rel, digest] of entries) {
    let res;
    try {
      res = await fetchBytes(new URL(rel.split("/").map(encodeURIComponent).join("/"), baseDir).href);
    } catch (error) {
      problems.push(`"${rel}" could not be fetched: ${error.message}`);
      continue;
    }
    if (res.status !== 200) {
      problems.push(`"${rel}" is not served correctly (HTTP ${res.status})`);
      continue;
    }
    const actual = createHash("sha256").update(res.body).digest("hex");
    if (actual !== digest) {
      problems.push(`"${rel}" live content hash ${actual.slice(0, 12)}… does not match the intended manifest`);
      continue;
    }
    checked++;
    if (log) console.log(`  ok ${rel}`);
  }
  return { ok: problems.length === 0, checked, problems };
}

async function copyServedTree(root, targetDir, rels) {
  for (const rel of rels) {
    const dest = path.join(targetDir, rel);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, await readFile(path.join(root, rel)));
  }
  return rels;
}

function serveDir(dir) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        const rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(/^\/+/, "");
        const data = await readFile(path.join(dir, rel || "index.html"));
        res.writeHead(200);
        res.end(data);
      } catch {
        if (!res.headersSent) {
          res.writeHead(404);
          res.end("not found");
        }
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

// The one awaited teardown path for every temporary server. Called exactly
// once per server instance.
function closeServer(server) {
  return new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
  });
}

async function portRefusesConnection(port) {
  try {
    await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(3000) });
    return false;
  } catch {
    return true;
  }
}

async function runProveMode(root) {
  const expectedManifestBytes = await readFile(path.join(root, MANIFEST_NAME));
  const intendedRels = Object.keys(JSON.parse(expectedManifestBytes.toString("utf8")).files);
  const results = [];

  const impossible = await verifyOrigin("http://127.0.0.1:1/", expectedManifestBytes);
  results.push({
    name: "impossible target must fail",
    pass: !impossible.ok,
    evidence: impossible.ok ? "VERIFIER PASSED against an unreachable origin" : `failed as required (${impossible.problems[0]})`
  });

  const tmpA = await mkdtemp(path.join(os.tmpdir(), "soultrip-prove-tampered-"));
  const tmpB = await mkdtemp(path.join(os.tmpdir(), "soultrip-prove-oldbuild-"));
  try {
    await copyServedTree(root, tmpA, intendedRels);
    await writeFile(path.join(tmpA, MANIFEST_NAME), expectedManifestBytes);
    const indexPath = path.join(tmpA, "index.html");
    await writeFile(indexPath, (await readFile(indexPath, "utf8")).replace("</title>", " TAMPERED</title>"));
    let serverA = await serveDir(tmpA);
    const portA = serverA.address().port;
    try {
      const tampered = await verifyOrigin(`http://127.0.0.1:${portA}/`, expectedManifestBytes);
      results.push({
        name: "tampered live file must fail with file-level diagnosis",
        pass: !tampered.ok && tampered.problems.some((p) => p.includes('"index.html"')),
        evidence: tampered.ok ? "VERIFIER PASSED against tampered content" : `failed as required (${tampered.problems[0]})`
      });
    } finally {
      await closeServer(serverA); // single awaited close for this server
    }
    const portAFreed = await portRefusesConnection(portA);
    results.push({
      name: "fixture port stops accepting connections after its one awaited close",
      pass: portAFreed,
      evidence: `127.0.0.1:${portA} ${portAFreed ? "refuses" : "still accepts"} connections after close`
    });

    await copyServedTree(root, tmpB, intendedRels);
    const oldIndexPath = path.join(tmpB, "index.html");
    await writeFile(oldIndexPath, (await readFile(oldIndexPath, "utf8")).replace("SoulTrip Travel and Tours Ltd —", "SoulTrip — previous build —"));
    const files = {};
    for (const rel of intendedRels) {
      if (rel === MANIFEST_NAME) continue;
      files[rel] = createHash("sha256").update(await readFile(path.join(tmpB, rel))).digest("hex");
    }
    const oldManifestBytes = Buffer.from(JSON.stringify({ algorithm: "sha256", files }, null, 2) + "\n");
    await writeFile(path.join(tmpB, MANIFEST_NAME), oldManifestBytes);
    let serverB = await serveDir(tmpB);
    const portB = serverB.address().port;
    try {
      const oldBuild = await verifyOrigin(`http://127.0.0.1:${portB}/`, expectedManifestBytes);
      results.push({
        name: "coherent previous build must fail at manifest comparison",
        pass: !oldBuild.ok && oldBuild.checked === 0 && /differs from the intended/.test(oldBuild.problems[0] ?? ""),
        evidence: oldBuild.ok ? "VERIFIER PASSED against a previous build" : `failed as required (${oldBuild.problems[0]})`
      });
    } finally {
      await closeServer(serverB); // single awaited close for this server
    }
    const portBFreed = await portRefusesConnection(portB);
    results.push({
      name: "previous-build fixture port stops accepting connections after its one awaited close",
      pass: portBFreed,
      evidence: `127.0.0.1:${portB} ${portBFreed ? "refuses" : "still accepts"} connections after close`
    });
  } finally {
    await rm(tmpA, { recursive: true, force: true });
    await rm(tmpB, { recursive: true, force: true });
  }

  console.log("verify-production --prove-verification:");
  for (const r of results) console.log(`  ${r.pass ? "PASS" : "FAIL"} ${r.name}: ${r.evidence}`);
  if (!results.every((r) => r.pass)) {
    console.error("prove-verification FAILED: the verifier accepted a scenario it must reject.");
    process.exit(1);
  }
  console.log("prove-verification passed: every impossible/mismatched target was rejected.");
}

const root = path.resolve(argValue("--root") ?? repoRoot());
if (process.argv.includes("--prove-verification")) {
  await runProveMode(root);
} else {
  const base = argValue("--base");
  if (!base) {
    console.error("usage: node scripts/verify-production.mjs --base https://<origin>/ [--prove-verification]");
    console.error("the production verifier is read-only (GET only), never submits forms, and never runs without an explicit --base");
    process.exit(2);
  }
  let expected;
  try {
    expected = await readFile(path.join(root, MANIFEST_NAME));
  } catch {
    console.error(`${MANIFEST_NAME} missing locally; run scripts/generate-manifest.mjs first`);
    process.exit(2);
  }
  console.log(`verifying ${base} against the intended tree (${expected.length}-byte manifest)…`);
  const result = await verifyOrigin(base, expected, process.argv.includes("--verbose"));
  if (!result.ok) {
    console.error(`\nproduction does NOT match this tree (${result.problems.length} problem(s)):`);
    for (const p of result.problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`production matches this tree exactly: manifest byte-identical plus ${result.checked} files hash-verified.`);
}
