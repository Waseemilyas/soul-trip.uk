#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, stat, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "./site-contract-lib.mjs";

const REPO = repoRoot();

function copyTree(src, dest) {
  return new Promise((resolve, reject) => {
    const cp = spawn("cp", ["-a", path.join(src) + "/.", dest + "/"], { stdio: "ignore" });
    cp.on("error", reject);
    cp.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`cp -a exited ${code}`))));
  });
}

async function makeCopy(prefix) {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  await copyTree(REPO, dir);
  return dir;
}

async function walkSnapshot(dir, base = dir, acc = { files: new Map(), dirs: new Map() }) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full);
    if (entry.isDirectory()) {
      acc.dirs.set(rel, [...(await readdir(full))].sort().join("\n"));
      await walkSnapshot(full, base, acc);
    } else {
      const st = await stat(full);
      acc.files.set(rel, {
        sha256: createHash("sha256").update(await readFile(full)).digest("hex"),
        mtimeMs: st.mtimeMs,
        ino: st.ino,
        size: st.size
      });
    }
  }
  return acc;
}

function snapshotProblems(before, after) {
  const problems = [];
  for (const [rel, meta] of before.files) {
    const now = after.files.get(rel);
    if (!now) problems.push(`file deleted by checker: ${rel}`);
    else if (now.sha256 !== meta.sha256 || now.mtimeMs !== meta.mtimeMs || now.ino !== meta.ino || now.size !== meta.size) {
      problems.push(`file mutated by checker: ${rel} (bytes/mtime/inode changed)`);
    }
  }
  for (const rel of after.files.keys()) {
    if (!before.files.has(rel)) problems.push(`extra file written by checker: ${rel}`);
  }
  for (const [rel, listing] of before.dirs) {
    const now = after.dirs.get(rel);
    if (now === undefined) problems.push(`directory removed by checker: ${rel}`);
    else if (now !== listing) problems.push(`directory listing changed by checker: ${rel}`);
  }
  for (const rel of after.dirs.keys()) {
    if (!before.dirs.has(rel)) problems.push(`extra directory created by checker: ${rel}`);
  }
  return problems;
}

function runNode(scriptRel, cwd, args = []) {
  return spawnSync(process.execPath, [path.join(REPO, scriptRel), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120000
  });
}

function runNodeAsync(scriptRel, cwd, args = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(REPO, scriptRel), ...args], { cwd });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const timer = setTimeout(() => child.kill("SIGKILL"), 120000);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ status: code, stdout: out, stderr: "" });
    });
  });
}

const results = [];
async function test(id, name, fn) {
  try {
    const outcome = await fn();
    results.push({ id, name, pass: !!outcome.pass, evidence: String(outcome.evidence ?? "") });
  } catch (error) {
    results.push({ id, name, pass: false, evidence: `harness error: ${error.message}` });
  }
}

async function sabotageInCopy(dir, fileRel, replacements) {
  const filePath = path.join(dir, fileRel);
  let text = await readFile(filePath, "utf8");
  for (const [from, to] of replacements) {
    const found = from instanceof RegExp ? new RegExp(from.source, from.flags).test(text) : text.includes(from);
    if (!found) throw new Error(`sabotage anchor not found in ${fileRel}: ${String(from instanceof RegExp ? from.source : from).slice(0, 60)}`);
    text = text.replace(from, to);
  }
  await writeFile(filePath, text);
}

async function checkSite(dir) {
  const r = runNode("scripts/check-site.mjs", dir, ["--root", dir]);
  return { code: r.status, out: `${r.stdout}\n${r.stderr}`, timedOut: r.signal === "SIGTERM" };
}

// Runs the pristine shipped Sentry checker against a tree copy (the copy supplies the
// page under test via --root; the logic under test always comes from this repo).
function runSentryChecker(dir, args = [], extraEnv = {}) {
  return spawnSync(
    process.execPath,
    [path.join(REPO, "scripts/check-sentry-integration.mjs"), "--root", dir, ...args],
    { cwd: dir, encoding: "utf8", timeout: 120000, env: { ...process.env, ...extraEnv } }
  );
}

// Runs the COPY's own checker file. Only used by the sabotage-of-the-checker meta-proofs,
// where the shipped script inside the copy has itself been tampered with.
function runCopySentryChecker(dir, args = [], extraEnv = {}) {
  return spawnSync(
    process.execPath,
    [path.join(dir, "scripts/check-sentry-integration.mjs"), "--root", dir, ...args],
    { cwd: dir, encoding: "utf8", timeout: 120000, env: { ...process.env, ...extraEnv } }
  );
}

const SYNTHETIC_SDK_V1 = '/* synthetic Sentry bundle fixture v1 — generated test bytes, never the production bundle */\nwindow.__syntheticSdkFixture = "v1";\n';
const SYNTHETIC_SDK_V2 = '/* synthetic Sentry bundle fixture v2 — generated test bytes, never the production bundle */\nwindow.__syntheticSdkFixture = "v2";\n';

function sha384b64(bytes) {
  return `sha384-${createHash("sha384").update(bytes).digest("base64")}`;
}

// Builds a tree copy whose Sentry loader keeps the real pinned CDN URL but declares the
// SRI of synthetic fixture bytes served through the offline seam — every sub-property
// holds, so any failure of a single mutated direction is attributable to that direction.
async function makeOfflineGreenCopy(prefix) {
  const dir = await makeCopy(prefix);
  const fixturePath = path.join(dir, ".fixtures", "synthetic-sdk.js");
  await mkdir(path.dirname(fixturePath), { recursive: true });
  await writeFile(fixturePath, SYNTHETIC_SDK_V1);
  const htmlPath = path.join(dir, "index.html");
  const html = await readFile(htmlPath, "utf8");
  const patched = html.replace(/integrity="sha384-[^"]*"/, `integrity="${sha384b64(SYNTHETIC_SDK_V1)}"`);
  if (patched === html) throw new Error("integrity attribute anchor not found in copied index.html");
  await writeFile(htmlPath, patched);
  return { dir, fixturePath };
}

async function failureBullets(out) {
  return out.split("\n").filter((line) => line.startsWith("  - "));
}

await test("T01", "clean tree is green: every site-contract check passes on the faithful tree", async () => {
  const dir = await makeCopy("soultrip-negctl-baseline-");
  try {
    const r = await checkSite(dir);
    return {
      pass: r.code === 0 && r.out.includes("all site-contract checks passed") && (await failureBullets(r.out)).length === 0,
      evidence: `exit=${r.code}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T02", "sabotage: removing the .ico icon makes C1 AND C6 fail naming it", async () => {
  const dir = await makeCopy("soultrip-negctl-iconrm-");
  try {
    await rm(path.join(dir, "favicon.ico"));
    const untrack = spawnSync("git", ["rm", "--cached", "--quiet", "favicon.ico"], { cwd: dir });
    if (untrack.status !== 0) return { pass: false, evidence: `git rm --cached failed in copy: ${untrack.stderr}` };
    const r = await checkSite(dir);
    const bullets = await failureBullets(r.out);
    return {
      pass:
        r.code === 1 &&
        bullets.length === 2 &&
        /missing "favicon\.ico"/.test(r.out) &&
        /favicon asset "\/favicon\.ico" .* not present/.test(r.out),
      evidence: `exit=${r.code}, ${bullets.length} violation(s)`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T03", "sabotage: an icon link mispointed at a missing asset fails naming THAT asset only", async () => {
  const dir = await makeCopy("soultrip-negctl-iconswap-");
  try {
    await sabotageInCopy(dir, "index.html", [
      ['<link rel="icon" href="/favicon.ico" type="image/x-icon" />', '<link rel="icon" href="/favicon-missing.svg" type="image/svg+xml" />']
    ]);
    const r = await checkSite(dir);
    return {
      pass:
        r.code === 1 &&
        /missing "favicon-missing\.svg"/.test(r.out) &&
        /favicon asset "\/favicon-missing\.svg" .* not present/.test(r.out) &&
        !/missing "favicon\.ico"/.test(r.out),
      evidence: `exit=${r.code}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const SABOTAGES = [
  ['T04', 'C1 broken fragment anchor', [['href="#about"', 'href="#aboutx"']], [/anchor "#aboutx" has no matching id/]],
  ['T05', 'C1 broken image src', [['images/experiences/diriyah-heritage-village.jpg', 'images/experiences/diriyah-MISSING.jpg']], [/does not resolve to a served file/, /diriyah-MISSING\.jpg/]],
  ['T06', 'C2 alt attribute removed', [[/ alt="The Holy Kaaba[^"]*"/, '']], [/has no alt attribute/]],
  ['T07', 'C2 empty alt text', [[/alt="The Holy Kaaba[^"]*"/, 'alt="   "']], [/has an empty alt attribute/]],
  ['T08', 'C3 form action host off allowlist', [['https://formspree.io/p/3011773691026472174/f/enquiry', 'https://malicious.example.net/collect']], [/not on the Formspree allowlist/, /malicious\.example\.net/]],
  ['T09', 'C3 form action downgraded to http', [['https://formspree.io/p/3011773691026472174/f/enquiry', 'http://formspree.io/p/3011773691026472174/f/enquiry']], [/is not HTTPS/]],
  ['T10', 'C3 honeypot removed', [[/<input type="text" class="hp" name="_gotcha"[^>]*\/>/, '']], [/honeypot input\[name="_gotcha"\] missing/]],
  ['T11', 'C3 required marker removed from email field', [['id="email" name="email" autocomplete="email" required', 'id="email" name="email" autocomplete="email"']], [/field "email" .*not marked required/]],
  ['T12', 'C3 success panel id renamed', [['form-success" role="status"', 'form-successx" role="status"']], [/#form-success element is missing/]],
  ['T13', 'C4 Sentry DSN blanked', [[' data-dsn="https://be9441f84918f5340663a91ed182498c@o4511673494732800.ingest.de.sentry.io/4511769917128784"', '']], [/no https data-dsn/]]
];

for (const [id, name, replacements, expectedPatterns] of SABOTAGES) {
  await test(id, `sabotage: ${name} → nonzero exit with expected diagnostic`, async () => {
    const dir = await makeCopy("soultrip-negctl-");
    try {
      await sabotageInCopy(dir, "index.html", replacements);
      const r = await checkSite(dir);
      const missing = expectedPatterns.filter((p) => !p.test(r.out));
      return {
        pass: r.code === 1 && missing.length === 0,
        evidence: r.code !== 1 ? `exit=${r.code} (expected 1)` : `diagnostic(s) missing: ${missing.map(String).join(", ")}`
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}

await test("T14", "sabotage: lightened gold token drops eyebrow contrast below AA (C5)", async () => {
  const dir = await makeCopy("soultrip-negctl-c5-");
  try {
    await sabotageInCopy(dir, "assets/css/styles.css", [["--gold-700: #7A5F18;", "--gold-700: #B08A2E;"]]);
    const r = await checkSite(dir);
    return {
      pass: r.code === 1 && /eyebrow accent on sand-200 section.*below the required WCAG AA/.test(r.out),
      evidence: `exit=${r.code}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T15", "sabotage: renamed CSS token makes a pair unextractable (stylesheet drift caught)", async () => {
  const dir = await makeCopy("soultrip-negctl-c5b-");
  try {
    await sabotageInCopy(dir, "assets/css/styles.css", [["--gold-700:", "--gold-text:"]]);
    const r = await checkSite(dir);
    return {
      pass: r.code === 1 && /could not be extracted from styles\.css|uses unparseable colour/.test(r.out),
      evidence: `exit=${r.code}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T16", "sabotage: robots.txt declaring an unshipped sitemap is caught (C6)", async () => {
  const dir = await makeCopy("soultrip-negctl-c6b-");
  try {
    await writeFile(path.join(dir, "robots.txt"), "User-agent: *\nAllow: /\nSitemap: https://soul-trip.uk/sitemap-missing.xml\n");
    const r = await checkSite(dir);
    return {
      pass: r.code === 1 && /robots\.txt declares sitemap .*sitemap-missing\.xml.* not in the served tree/.test(r.out),
      evidence: `exit=${r.code}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T17", "sabotage: sitemap.xml listing a route that does not ship is caught (C6)", async () => {
  const dir = await makeCopy("soultrip-negctl-c6c-");
  try {
    await sabotageInCopy(dir, "sitemap.xml", [
      [/<\/urlset>/, '  <url>\n    <loc>https://soul-trip.uk/pricing.html</loc>\n  </url>\n</urlset>']
    ]);
    const r = await checkSite(dir);
    return {
      pass:
        r.code === 1 &&
        /sitemap\.xml lists "https:\/\/soul-trip\.uk\/pricing\.html" which does not resolve to a served file/.test(r.out),
      evidence: `exit=${r.code}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T18", "manifest check is green on a faithful copy and fails on tampered content", async () => {
  const dir = await makeCopy("soultrip-negctl-man1-");
  try {
    const clean = runNode("scripts/check-manifest.mjs", dir, ["--root", dir]);
    if (clean.status !== 0) return { pass: false, evidence: `clean copy failed: exit=${clean.status} ${clean.stderr}` };
    await writeFile(path.join(dir, "CNAME"), (await readFile(path.join(dir, "CNAME"), "utf8")) + "\n");
    const stale = runNode("scripts/check-manifest.mjs", dir, ["--root", dir]);
    return {
      pass: stale.status === 1 && /does not match manifest/.test(stale.stdout + stale.stderr) && /CNAME/.test(stale.stdout + stale.stderr),
      evidence: `clean exit=${clean.status}, tampered exit=${stale.status}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T19", "manifest check fails on an extra untracked served file (ambiguity guard)", async () => {
  const dir = await makeCopy("soultrip-negctl-man2-");
  try {
    await writeFile(path.join(dir, "about.html"), "<!doctype html><title>x</title>");
    const r = runNode("scripts/check-manifest.mjs", dir, ["--root", dir]);
    return {
      pass: r.status === 1 && /untracked non-ignored served files/.test(r.stdout + r.stderr),
      evidence: `exit=${r.status}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T20", "manifest check fails when a manifest entry is missing from the file", async () => {
  const dir = await makeCopy("soultrip-negctl-man3-");
  try {
    await sabotageInCopy(dir, "site-manifest.json", [[/"CNAME": "[0-9a-f]{64}",\n/, ""]]);
    const r = runNode("scripts/check-manifest.mjs", dir, ["--root", dir]);
    return {
      pass: r.status === 1 && /"CNAME" is missing from the manifest/.test(r.stdout + r.stderr),
      evidence: `exit=${r.status}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T21", "manifest check rejects reordered entries even though hashes and whitespace stay valid", async () => {
  const dir = await makeCopy("soultrip-negctl-order-");
  try {
    const manifestPath = path.join(dir, "site-manifest.json");
    const raw = await readFile(manifestPath, "utf8");
    const m = JSON.parse(raw);
    const keys = Object.keys(m.files);
    const reordered = {};
    for (const k of keys.slice(1)) reordered[k] = m.files[k];
    reordered[keys[0]] = m.files[keys[0]];
    const rewritten = JSON.stringify({ algorithm: m.algorithm, files: reordered }, null, 2) + "\n";
    // same keys, same digests, same canonical encoding style — only order moved
    if ([...Object.keys(JSON.parse(rewritten).files)].sort().join("|") !== [...keys].sort().join("|")) {
      throw new Error("sabotage fixture changed the key set");
    }
    await writeFile(manifestPath, rewritten);
    const r = runNode("scripts/check-manifest.mjs", dir, ["--root", dir]);
    return {
      pass:
        r.status === 1 &&
        /ordering does not match the canonical working-tree order/.test(r.stdout + r.stderr) &&
        !/matches the working tree exactly/.test(r.stdout + r.stderr),
      evidence: `exit=${r.status}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T22", "manifest check rejects non-canonical byte encoding of identical content", async () => {
  const dir = await makeCopy("soultrip-negctl-man4-");
  try {
    const manifest = JSON.parse(await readFile(path.join(dir, "site-manifest.json"), "utf8"));
    await writeFile(path.join(dir, "site-manifest.json"), JSON.stringify(manifest));
    const r = runNode("scripts/check-manifest.mjs", dir, ["--root", dir]);
    const out = r.stdout + r.stderr;
    return {
      pass:
        r.status === 1 &&
        /canonical deterministic encoding/.test(out) &&
        !/ordering does not match/.test(out),
      evidence: `exit=${r.status} (encoding diagnostic fired without the ordering one — distinct causes)`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T23", "generate-manifest is deterministic: two runs produce identical bytes; no-op second run does not rewrite", async () => {
  const dir = await makeCopy("soultrip-negctl-gen-");
  try {
    const first = runNode("scripts/generate-manifest.mjs", dir, ["--root", dir]);
    const bytes1 = await readFile(path.join(dir, "site-manifest.json"));
    const mtimeBefore = (await stat(path.join(dir, "site-manifest.json"))).mtimeMs;
    await new Promise((r) => setTimeout(r, 20));
    const second = runNode("scripts/generate-manifest.mjs", dir, ["--root", dir]);
    const bytes2 = await readFile(path.join(dir, "site-manifest.json"));
    const mtimeAfter = (await stat(path.join(dir, "site-manifest.json"))).mtimeMs;
    return {
      pass:
        first.status === 0 &&
        second.status === 0 &&
        bytes1.equals(bytes2) &&
        mtimeBefore === mtimeAfter &&
        /already up to date/.test(second.stdout),
      evidence: `first exit=${first.status}, second exit=${second.status}, identical=${bytes1.equals(bytes2)}, mtime unchanged=${mtimeBefore === mtimeAfter}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T24", "purity: check-site.mjs never mutates its input tree (bytes+mtime+inode+directory listings)", async () => {
  const dir = await makeCopy("soultrip-negctl-pure1-");
  try {
    const before = await walkSnapshot(dir);
    const r = await checkSite(dir);
    const after = await walkSnapshot(dir);
    const problems = snapshotProblems(before, after);
    return { pass: problems.length === 0 && r.code === 0, evidence: problems.length ? problems.join("; ") : "tree byte-identical across full green run" };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T25", "purity: check-manifest.mjs is read-only (bytes+mtime+inode+directory listings, .git/index included)", async () => {
  const dir = await makeCopy("soultrip-negctl-pure2-");
  try {
    const before = await walkSnapshot(dir);
    const r = runNode("scripts/check-manifest.mjs", dir, ["--root", dir]);
    const after = await walkSnapshot(dir);
    const problems = snapshotProblems(before, after);
    return { pass: problems.length === 0 && r.status === 0, evidence: problems.length ? problems.join("; ") : "no file, metadata or directory change" };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T26", "purity: verify-production GETs only manifest-listed paths; harness port refuses connections after its single awaited close", async () => {
  const dir = await makeCopy("soultrip-negctl-pure3-");
  let server;
  let verdict = { pass: false, evidence: "not run" };
  let portFreed = false;
  try {
    const requests = [];
    server = http.createServer(async (req, res) => {
      try {
        const rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(/^\/+/, "");
        requests.push({ method: req.method, path: rel });
        const data = await readFile(path.join(dir, rel || "index.html"));
        res.writeHead(200);
        res.end(data);
      } catch {
        if (!res.headersSent) {
          res.writeHead(404);
          res.end("nf");
        }
      }
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const port = server.address().port;
    const r = await runNodeAsync("scripts/verify-production.mjs", dir, ["--base", `http://127.0.0.1:${port}/`, "--root", dir]);
    const manifestFiles = Object.keys(JSON.parse(await readFile(path.join(dir, "site-manifest.json"), "utf8")).files);
    const allowed = new Set(["site-manifest.json", ...manifestFiles]);
    const badMethod = requests.filter((q) => q.method !== "GET");
    const badPath = requests.filter((q) => !allowed.has(q.path));
    verdict = {
      pass: r.status === 0 && badMethod.length === 0 && badPath.length === 0 && requests.length === manifestFiles.length + 1,
      evidence:
        r.status !== 0
          ? `verifier failed against faithful mirror: ${r.stdout} ${r.stderr}`.slice(0, 300)
          : `${requests.length} GETs, all methods GET, all paths manifest-covered${badMethod.length || badPath.length ? `, BAD=${JSON.stringify([...badMethod, ...badPath])}` : ""}`
    };
  } finally {
    if (server) {
      const port = server.address().port;
      await new Promise((resolve) => server.close(resolve)); // exactly one awaited close path
      try {
        await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(3000) });
        portFreed = false;
      } catch {
        portFreed = true;
      }
      verdict.evidence += `; 127.0.0.1:${port} ${portFreed ? "refuses connections after close" : "STILL ACCEPTS CONNECTIONS AFTER CLOSE"}`;
    }
    await rm(dir, { recursive: true, force: true });
  }
  return { pass: verdict.pass && portFreed, evidence: verdict.evidence };
});

// ===== Review-repair additions (T27+) ===============================================
// T27 closes the missing #form-error rename control; T28-T31 prove the C7 structural
// accessibility regressions (regression coverage only, not an axe substitute);
// T32-T39 prove each Sentry checker direction independently through the offline seam;
// T40-T41 are meta-proofs that these controls detect a broken or lying checker.

await test("T27", "sabotage: C3 error panel id renamed (#form-error) → fails naming #form-error, distinct from the #form-success case", async () => {
  const dir = await makeCopy("soultrip-negctl-errid-");
  try {
    await sabotageInCopy(dir, "index.html", [
      ['<div class="form-error" id="form-error" role="alert">', '<div class="form-errorx" id="form-errorx" role="alert">']
    ]);
    const r = await checkSite(dir);
    return {
      pass:
        r.code === 1 &&
        /#form-error element is missing/.test(r.out) &&
        !/#form-success element is missing/.test(r.out),
      evidence: `exit=${r.code}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T28", "sabotage: footer heading regressed to h4 → C7 names the heading-order regression", async () => {
  const dir = await makeCopy("soultrip-negctl-h4-");
  try {
    await sabotageInCopy(dir, "index.html", [["<h3>What We Offer</h3>", "<h4>What We Offer</h4>"]]);
    const r = await checkSite(dir);
    return {
      pass:
        r.code === 1 &&
        /\[C7\]/.test(r.out) &&
        /footer headings must remain <h3>/.test(r.out) &&
        /<h4> inside <footer>/.test(r.out),
      evidence: `exit=${r.code}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T29", "sabotage: floating WhatsApp moved outside the footer landmark → C7 names the region regression only", async () => {
  const dir = await makeCopy("soultrip-negctl-waland-");
  try {
    // Reproduce the pre-repair state: same link, same label, but outside </footer>.
    await sabotageInCopy(dir, "index.html", [
      [/\n\s*<!-- Floating WhatsApp lives[\s\S]*?<\/a>\n/, "\n"],
      [/<\/footer>/, '</footer>\n\n    <a class="wa-float" href="https://wa.me/447577177172" aria-label="Chat on WhatsApp">\n      <span class="wa-float__tip">Chat on WhatsApp</span>\n    </a>']
    ]);
    const r = await checkSite(dir);
    return {
      pass:
        r.code === 1 &&
        /floating WhatsApp link \(\.wa-float\) sits outside the <footer> landmark/.test(r.out) &&
        !/is not focusable by keyboard users/.test(r.out) &&
        !/no accessible name/.test(r.out),
      evidence: `exit=${r.code}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T30", "sabotage: floating WhatsApp given tabindex=-1 → C7 names the focusability regression only", async () => {
  const dir = await makeCopy("soultrip-negctl-watab-");
  try {
    await sabotageInCopy(dir, "index.html", [
      [
        '<a class="wa-float" href="https://wa.me/447577177172" aria-label="Chat on WhatsApp">',
        '<a class="wa-float" href="https://wa.me/447577177172" aria-label="Chat on WhatsApp" tabindex="-1">'
      ]
    ]);
    const r = await checkSite(dir);
    return {
      pass:
        r.code === 1 &&
        /is not focusable by keyboard users/.test(r.out) &&
        !/sits outside the <footer> landmark/.test(r.out) &&
        !/no accessible name/.test(r.out),
      evidence: `exit=${r.code}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T31", "sabotage: floating WhatsApp stripped of its accessible name → C7 names the labelling regression only", async () => {
  const dir = await makeCopy("soultrip-negctl-walabel-");
  try {
    await sabotageInCopy(dir, "index.html", [
      ['<a class="wa-float" href="https://wa.me/447577177172" aria-label="Chat on WhatsApp">', '<a class="wa-float" href="https://wa.me/447577177172">']
    ]);
    const r = await checkSite(dir);
    return {
      pass:
        r.code === 1 &&
        /no accessible name/.test(r.out) &&
        !/sits outside the <footer> landmark/.test(r.out) &&
        !/is not focusable by keyboard users/.test(r.out),
      evidence: `exit=${r.code}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T32", "offline seam: synthetic fixture + consistent SRI passes --expect-active with zero network; seam is load-bearing", async () => {
  const { dir, fixturePath } = await makeOfflineGreenCopy("soultrip-negctl-sok-");
  try {
    const good = runSentryChecker(dir, ["--expect-active"], { SENTRY_SDK_FIXTURE: fixturePath });
    const goodOut = good.stdout + good.stderr;
    if (!(good.status === 0 && /Sentry integration check passed/.test(goodOut) && /\(offline fixture seam\)/.test(goodOut))) {
      return { pass: false, evidence: `green fixture failed: exit=${good.status} ${goodOut.slice(0, 200)}` };
    }
    const brokenSeam = runSentryChecker(dir, ["--expect-active"], {
      SENTRY_SDK_FIXTURE: path.join(dir, ".fixtures", "missing.js")
    });
    return {
      pass:
        brokenSeam.status === 1 &&
        /SENTRY_SDK_FIXTURE .*could not be read/.test(brokenSeam.stdout + brokenSeam.stderr),
      evidence: `good exit=0 (offline); seam pointed at a missing file exit=${brokenSeam.status} — the green result came through the seam, not a live fetch`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T33", "inert mode: blanked DSN passes offline; active DSN under --expect-inert fails naming the contradiction", async () => {
  const inert = await makeOfflineGreenCopy("soultrip-negctl-inert-");
  try {
    await sabotageInCopy(inert.dir, "index.html", [[/ data-dsn="[^"]*"/, ""]]);
    const ok = runSentryChecker(inert.dir, ["--expect-inert"], { SENTRY_SDK_FIXTURE: inert.fixturePath });
    if (!(ok.status === 0 && /inert pre-release DSN/.test(ok.stdout))) {
      return { pass: false, evidence: `inert green failed: exit=${ok.status} ${(ok.stdout + ok.stderr).slice(0, 200)}` };
    }
  } finally {
    await rm(inert.dir, { recursive: true, force: true });
  }
  const active = await makeOfflineGreenCopy("soultrip-negctl-inert2-");
  try {
    const bad = runSentryChecker(active.dir, ["--expect-inert"], { SENTRY_SDK_FIXTURE: active.fixturePath });
    return {
      pass:
        bad.status === 1 &&
        /Expected an inert pre-release page, but the Sentry DSN is active\./.test(bad.stdout + bad.stderr),
      evidence: `active-DSN-under-inert exit=${bad.status}`
    };
  } finally {
    await rm(active.dir, { recursive: true, force: true });
  }
});

await test("T34", "Sentry hostile: pinned SDK source swapped to another version → fails naming the exact pinned URL", async () => {
  const { dir, fixturePath } = await makeOfflineGreenCopy("soultrip-negctl-spin-");
  try {
    await sabotageInCopy(dir, "index.html", [
      ["https://browser.sentry-cdn.com/10.66.0/bundle.min.js", "https://browser.sentry-cdn.com/10.65.0/bundle.min.js"]
    ]);
    const r = runSentryChecker(dir, ["--expect-active"], { SENTRY_SDK_FIXTURE: fixturePath });
    const out = r.stdout + r.stderr;
    return {
      pass:
        r.status === 1 &&
        out.includes(`Sentry SDK is not pinned to ${"https://browser.sentry-cdn.com/10.66.0/bundle.min.js"} `) &&
        !/does not match the sha384 of the bytes served/.test(out),
      evidence: `exit=${r.status}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T35", "Sentry hostile: integrity attribute removed → fails naming the missing subresource-integrity attribute", async () => {
  const { dir, fixturePath } = await makeOfflineGreenCopy("soultrip-negctl-srirm-");
  try {
    await sabotageInCopy(dir, "index.html", [[/ integrity="sha384-[^"]*"/, ""]]);
    const r = runSentryChecker(dir, ["--expect-active"], { SENTRY_SDK_FIXTURE: fixturePath });
    const out = r.stdout + r.stderr;
    return {
      pass:
        r.status === 1 &&
        /no sha384 subresource-integrity attribute/.test(out) &&
        !/does not match the sha384 of the bytes served/.test(out) &&
        !/not pinned to/.test(out),
      evidence: `exit=${r.status}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T36", "Sentry hostile: served bytes altered after the SRI was written → fails with the byte-mismatch diagnostic naming both digests", async () => {
  const { dir, fixturePath } = await makeOfflineGreenCopy("soultrip-negctl-srimm-");
  try {
    await writeFile(fixturePath, SYNTHETIC_SDK_V2);
    const r = runSentryChecker(dir, ["--expect-active"], { SENTRY_SDK_FIXTURE: fixturePath });
    const out = r.stdout + r.stderr;
    return {
      pass:
        r.status === 1 &&
        /does not match the sha384 of the bytes served at the pinned SDK URL/.test(out) &&
        /computed "sha384-/.test(out) &&
        !/no sha384 subresource-integrity attribute/.test(out),
      evidence: `exit=${r.status}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T37", "Sentry hostile: DSN blanked under --expect-active → fails naming the absent active browser DSN", async () => {
  const { dir, fixturePath } = await makeOfflineGreenCopy("soultrip-negctl-dsn0-");
  try {
    await sabotageInCopy(dir, "index.html", [[/ data-dsn="[^"]*"/, ""]]);
    const r = runSentryChecker(dir, ["--expect-active"], { SENTRY_SDK_FIXTURE: fixturePath });
    return {
      pass:
        r.status === 1 &&
        /Expected an active production browser DSN, but none was present\./.test(r.stdout + r.stderr),
      evidence: `exit=${r.status}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T38", "Sentry hostile: non-ingest https DSN under --expect-active → fails naming the invalid DSN shape", async () => {
  const { dir, fixturePath } = await makeOfflineGreenCopy("soultrip-negctl-dsns-");
  try {
    await sabotageInCopy(dir, "index.html", [[/ data-dsn="https:\/\/[^"]*"/, ' data-dsn="https://monitoring.example.com/collect"']]);
    const r = runSentryChecker(dir, ["--expect-active"], { SENTRY_SDK_FIXTURE: fixturePath });
    return {
      pass:
        r.status === 1 &&
        /The active Sentry DSN is not a valid browser ingest DSN\./.test(r.stdout + r.stderr),
      evidence: `exit=${r.status}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T39", "Sentry hostile: privacy control stripped from sentry-init.js → fails naming that exact control", async () => {
  const { dir, fixturePath } = await makeOfflineGreenCopy("soultrip-negctl-pii-");
  try {
    await sabotageInCopy(dir, "assets/js/sentry-init.js", [["    sendDefaultPii: false,\n", ""]]);
    const r = runSentryChecker(dir, ["--expect-active"], { SENTRY_SDK_FIXTURE: fixturePath });
    return {
      pass:
        r.status === 1 &&
        /Missing Sentry privacy control: sendDefaultPii: false/.test(r.stdout + r.stderr),
      evidence: `exit=${r.status}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T40", "meta-proof: an unconditional-throw sabotage of the checker makes the green-direction Sentry control FAIL", async () => {
  const { dir, fixturePath } = await makeOfflineGreenCopy("soultrip-negctl-throw-");
  try {
    await writeFile(path.join(dir, "scripts/check-sentry-integration.mjs"), 'throw new Error("sabotage: unconditional throw");');
    const r = runCopySentryChecker(dir, ["--expect-active"], { SENTRY_SDK_FIXTURE: fixturePath });
    return {
      pass: r.status !== 0,
      evidence: `sabotaged checker exit=${r.status} on a faithful-good fixture tree — the green control is not vacuous`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T41", "meta-proof: an always-success no-op checker masks a real violation → the hostile-direction expectation is violated", async () => {
  const { dir, fixturePath } = await makeOfflineGreenCopy("soultrip-negctl-noop-");
  try {
    await sabotageInCopy(dir, "index.html", [
      ["https://browser.sentry-cdn.com/10.66.0/bundle.min.js", "https://browser.sentry-cdn.com/10.65.0/bundle.min.js"]
    ]);
    const pristine = runSentryChecker(dir, ["--expect-active"], { SENTRY_SDK_FIXTURE: fixturePath });
    await writeFile(path.join(dir, "scripts/check-sentry-integration.mjs"), "process.exit(0);");
    const noop = runCopySentryChecker(dir, ["--expect-active"], { SENTRY_SDK_FIXTURE: fixturePath });
    return {
      pass: pristine.status === 1 && noop.status === 0,
      evidence: `pristine checker exit=${pristine.status} (hostile tree rejected); no-op checker exit=${noop.status} — a lying checker is caught by this hostile control`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ===== Release-cycle repair additions (T42+) ========================================
// CHANGELOG.md is excluded from the deploy fingerprint (mutable release ledger,
// not a runtime dependency). These controls prove the exclusion is not a hole:
// runtime files must still be unforgeable, and the ledger itself must not stale.

await test("T42", "hostile: a newly tracked runtime file absent from the manifest still fails after the exclusion", async () => {
  const dir = await makeCopy("soultrip-negctl-extra-");
  try {
    await writeFile(path.join(dir, "assets/js/extra-runtime.js"), "// hostile fixture: runtime file smuggled in\n");
    const add = spawnSync("git", ["add", "assets/js/extra-runtime.js"], { cwd: dir });
    if (add.status !== 0) return { pass: false, evidence: `git add failed in copy: ${add.stderr}` };
    const r = runNode("scripts/check-manifest.mjs", dir, ["--root", dir]);
    const out = r.stdout + r.stderr;
    return {
      pass:
        r.status === 1 &&
        /served file "assets\/js\/extra-runtime\.js" is missing from the manifest/.test(out),
      evidence: `exit=${r.status}${r.status === 1 ? " — runtime file outside the manifest still rejected" : ` ${out.slice(0, 200)}`}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T43", "release-ledger isolation: mutating CHANGELOG.md alone keeps the fingerprint green and generation a no-op", async () => {
  const dir = await makeCopy("soultrip-negctl-chlog-");
  try {
    const before = runNode("scripts/check-manifest.mjs", dir, ["--root", dir]);
    if (before.status !== 0) return { pass: false, evidence: `baseline copy already stale: exit=${before.status} ${before.stderr}` };
    await writeFile(
      path.join(dir, "CHANGELOG.md"),
      (await readFile(path.join(dir, "CHANGELOG.md"), "utf8")) + "\n## hostile fixture entry (test bytes)\n"
    );
    const chk = runNode("scripts/check-manifest.mjs", dir, ["--root", dir]);
    if (chk.status !== 0) return { pass: false, evidence: `CHANGELOG-only edit staled the fingerprint: exit=${chk.status} ${(chk.stdout + chk.stderr).slice(0, 300)}` };
    const mtimeBefore = (await stat(path.join(dir, "site-manifest.json"))).mtimeMs;
    const bytesBefore = await readFile(path.join(dir, "site-manifest.json"));
    await new Promise((r) => setTimeout(r, 20));
    const gen = runNode("scripts/generate-manifest.mjs", dir, ["--root", dir]);
    const mtimeAfter = (await stat(path.join(dir, "site-manifest.json"))).mtimeMs;
    const bytesAfter = await readFile(path.join(dir, "site-manifest.json"));
    const genOut = gen.stdout + gen.stderr;
    return {
      pass:
        chk.status === 0 &&
        gen.status === 0 &&
        /already up to date/.test(genOut) &&
        bytesBefore.equals(bytesAfter) &&
        mtimeBefore === mtimeAfter &&
        !/"CHANGELOG\.md"/.test(await readFile(path.join(dir, "site-manifest.json"), "utf8")),
      evidence: `checker exit=${chk.status}, generator exit=${gen.status} (${genOut.trim()}), manifest bytes+mtime unchanged=${bytesBefore.equals(bytesAfter) && mtimeBefore === mtimeAfter}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

await test("T44", "hostile: a manifest that still lists CHANGELOG.md fails with the explicit exclusion diagnostic", async () => {
  const dir = await makeCopy("soultrip-negctl-chlist-");
  try {
    const raw = await readFile(path.join(dir, "site-manifest.json"), "utf8");
    const m = JSON.parse(raw);
    const files = {};
    for (const [k, v] of Object.entries(m.files)) files[k] = v;
    files["CHANGELOG.md"] = createHash("sha256").update(await readFile(path.join(dir, "CHANGELOG.md"))).digest("hex");
    const ordered = {};
    for (const k of Object.keys(m.files).concat("CHANGELOG.md").sort()) ordered[k] = files[k];
    await writeFile(path.join(dir, "site-manifest.json"), JSON.stringify({ algorithm: m.algorithm, files: ordered }, null, 2) + "\n");
    const r = runNode("scripts/check-manifest.mjs", dir, ["--root", dir]);
    return {
      pass:
        r.status === 1 &&
        /manifest lists "CHANGELOG\.md" which is excluded from the deploy fingerprint/.test(r.stdout + r.stderr),
      evidence: `exit=${r.status}`
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

console.log("\nnegative-control suite results:");
let failures = 0;
for (const r of results) {
  if (!r.pass) failures++;
  console.log(`  ${r.pass ? "PASS" : "FAIL"} ${r.id} ${r.name}${r.evidence ? ` — ${r.evidence}` : ""}`);
}
if (failures) {
  console.error(`\n${failures} negative-control test(s) FAILED`);
  process.exit(1);
}
console.log(`\nall ${results.length} negative-control tests passed.`);
