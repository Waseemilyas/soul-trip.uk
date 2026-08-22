#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  repoRoot,
  listIntendedServedFiles,
  scanHtml,
  extractCssTokens,
  resolveCssColor,
  cssRuleBodies,
  parseCssColor,
  compositeOver,
  contrastRatio
} from "./site-contract-lib.mjs";

const FORMSPREE_HOSTS = new Set(["formspree.io", "www.formspree.io", "submit.formspree.io"]);
const OWN_HOSTS = new Set(["soul-trip.uk", "www.soul-trip.uk"]);
const REQUIRED_FIELD_NAMES = ["name", "phone", "email", "type"];
const REQUIRED_JS_SNIPPETS = [
  ["form binding", 'document.getElementById("enquiry-form")'],
  ["success panel binding", 'document.getElementById("form-success")'],
  ["error panel binding", 'document.getElementById("form-error")'],
  ["submit button binding", 'document.getElementById("submit-btn")'],
  ["submit handler", 'addEventListener("submit"'],
  ["honeypot query", 'input[name="_gotcha"]'],
  ["submit target", "fetch(form.action"]
];

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

const root = path.resolve(argValue("--root") ?? repoRoot());
const failures = [];
function fail(check, message) {
  failures.push({ check, message });
}

function decodeSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function normalizeRel(p) {
  const parts = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

function resolveTarget(rawUrl) {
  const raw = rawUrl.trim();
  if (!raw) return { type: "empty" };
  if (/^(javascript|data|mailto|tel|blob):/i.test(raw)) return { type: "external" };
  let rest = raw;
  let frag = null;
  const hashIndex = rest.indexOf("#");
  if (hashIndex !== -1) {
    frag = rest.slice(hashIndex + 1);
    rest = rest.slice(0, hashIndex);
  }
  const queryIndex = rest.indexOf("?");
  if (queryIndex !== -1) rest = rest.slice(0, queryIndex);
  const absolute = /^https?:\/\/([^/?#]*)\/?(.*)$/i.exec(rest);
  let rel;
  if (absolute) {
    if (!OWN_HOSTS.has(absolute[1].toLowerCase())) return { type: "external" };
    rel = absolute[2];
  } else if (/^\/\//.test(rest)) {
    return { type: "external" };
  } else if (rest.startsWith("/")) {
    rel = rest.slice(1);
  } else {
    rel = rest;
  }
  const decoded = decodeSafe(rel);
  if (decoded === null) return { type: "malformed" };
  return { type: "file", relPath: normalizeRel(decoded), frag };
}

function srcsetCandidates(value) {
  return value
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

async function loadText(rel) {
  try {
    return await readFile(path.join(root, rel), "utf8");
  } catch {
    return null;
  }
}

const indexHtml = await loadText("index.html");
if (indexHtml === null) {
  console.error(`check-site: fatal: index.html not found under ${root}`);
  process.exit(2);
}
const { tags, ids } = scanHtml(indexHtml);

let servedFiles;
try {
  servedFiles = await listIntendedServedFiles(root);
} catch (error) {
  console.error(`check-site: fatal: cannot enumerate served tree: ${error.message}`);
  process.exit(2);
}
const servedSet = new Set(servedFiles);

const mainJs = await loadText("assets/js/main.js");

function checkFragment(fragment, ref, relPath) {
  const baseId = fragment.split("?")[0];
  if (!baseId) {
    fail("C1", `line ${ref.line}: empty fragment "#" resolves nowhere`);
    return;
  }
  if (relPath && relPath !== "index.html") return;
  if (!ids.has(baseId)) {
    fail("C1", `line ${ref.line}: anchor "#${baseId}" has no matching id/name in index.html`);
  }
  if (fragment.includes("?")) {
    const intercept = `a[href^="#${baseId}?"]`;
    if (mainJs !== null && !mainJs.includes(intercept)) {
      fail("C1", `line ${ref.line}: query-hash "#${fragment}" has no JS intercept (${intercept}) in assets/js/main.js`);
    }
  }
}

const refs = [];
for (const tag of tags) {
  const { attrs, line, name } = tag;
  const addRef = (attrName, kind) => {
    if (typeof attrs[attrName] !== "string") return;
    for (const value of kind === "srcset" ? srcsetCandidates(attrs[attrName]) : [attrs[attrName]]) {
      refs.push({ value, kind, line });
    }
  };
  if (name === "img" || name === "source" || name === "script" || name === "iframe") {
    addRef("src", "src");
    addRef("srcset", "srcset");
  } else if (name === "link" || name === "a" || name === "area") {
    addRef("href", "href");
  } else if (name === "meta" && (attrs.property || "").toLowerCase() === "og:image" && typeof attrs.content === "string") {
    refs.push({ value: attrs.content, kind: "meta", line });
  }
}

for (const ref of refs) {
  const target = resolveTarget(ref.value);
  if (target.type === "external") continue;
  if (target.type === "empty") {
    fail("C1", `line ${ref.line}: empty URL reference`);
    continue;
  }
  if (target.type === "malformed") {
    fail("C1", `line ${ref.line}: malformed percent-encoding in "${ref.value}"`);
    continue;
  }
  if (target.relPath === "") target.relPath = "index.html";
  if (!servedSet.has(target.relPath)) {
    fail("C1", `line ${ref.line}: "${ref.value}" does not resolve to a served file (missing "${target.relPath}")`);
  }
  if (target.frag) checkFragment(target.frag, ref, target.relPath);
}

for (const tag of tags) {
  if (tag.name !== "img") continue;
  const { attrs, line } = tag;
  if (!("alt" in attrs)) {
    fail("C2", `line ${line}: <img src="${attrs.src ?? ""}"> has no alt attribute`);
  } else if (!attrs.alt.trim()) {
    fail("C2", `line ${line}: <img src="${attrs.src ?? ""}"> has an empty alt attribute`);
  }
}

const forms = tags.filter((t) => t.name === "form");
if (forms.length === 0) {
  fail("C3", "no <form> found; the enquiry contract requires exactly one");
} else if (forms.length > 1) {
  fail("C3", `${forms.length} <form> elements found at lines ${forms.map((f) => f.line).join(", ")}; expected exactly one`);
} else {
  const form = forms[0];
  const actionRaw = typeof form.attrs.action === "string" ? form.attrs.action.trim() : "";
  let action = null;
  try {
    action = new URL(actionRaw);
  } catch {}
  if (!actionRaw) {
    fail("C3", `line ${form.line}: enquiry form has no action`);
  } else if (!action || action.protocol !== "https:") {
    fail("C3", `line ${form.line}: form action "${actionRaw}" is not HTTPS`);
  } else if (!FORMSPREE_HOSTS.has(action.hostname)) {
    fail(
      "C3",
      `line ${form.line}: form action host "${action.hostname}" is not on the Formspree allowlist (${[...FORMSPREE_HOSTS].join(", ")})`
    );
  }
  const method = typeof form.attrs.method === "string" ? form.attrs.method.toUpperCase() : "";
  if (method !== "POST") fail("C3", `line ${form.line}: form method must be POST (found "${form.attrs.method ?? ""}")`);

  const formStartLine = form.line;
  let formEndLine = tags[tags.length - 1].line;
  const closeIndex = indexHtml.toLowerCase().indexOf("</form", indexHtml.toLowerCase().indexOf("<form"));
  if (closeIndex !== -1) formEndLine = indexHtml.slice(0, closeIndex).split("\n").length;
  const inForm = (t) => t.line >= formStartLine && t.line <= formEndLine;

  const honeypot = tags.find((t) => t.name === "input" && inForm(t) && t.attrs.name === "_gotcha");
  if (!honeypot) fail("C3", 'honeypot input[name="_gotcha"] missing inside the enquiry form');

  for (const fieldName of REQUIRED_FIELD_NAMES) {
    const field = tags.find((t) => (t.name === "input" || t.name === "select") && inForm(t) && t.attrs.id === fieldName);
    if (!field) {
      fail("C3", `required field with id "${fieldName}" missing inside the enquiry form`);
      continue;
    }
    if (!field.attrs.name) {
      fail("C3", `field "${fieldName}" (line ${field.line}) has no form name to submit`);
    }
    if (field.attrs.required === undefined) {
      fail("C3", `field "${fieldName}" (line ${field.line}) is not marked required`);
    }
    const label = tags.find((t) => t.name === "label" && t.attrs.for === fieldName);
    if (!label) fail("C3", `field "${fieldName}" has no <label for="${fieldName}">`);
  }

  for (const panel of ["form-success", "form-error"]) {
    if (!ids.has(panel)) fail("C3", `#${panel} element is missing from index.html`);
  }

  if (mainJs === null) {
    fail("C3", "assets/js/main.js is missing; enquiry JavaScript bindings unverifiable");
  } else {
    for (const [label, snippet] of REQUIRED_JS_SNIPPETS) {
      if (!mainJs.includes(snippet)) fail("C3", `main.js lacks the enquiry ${label} (${snippet})`);
    }
  }
}

const sentryLoader = tags.find((t) => t.name === "script" && t.attrs.id === "sentry-sdk");
if (!sentryLoader) {
  fail("C4", "Sentry loader <script id=\"sentry-sdk\"> missing from index.html");
} else {
  if (!/^https:\/\/browser\.sentry-cdn\.com\//.test(sentryLoader.attrs.src ?? "")) {
    fail("C4", `Sentry SDK src "${sentryLoader.attrs.src ?? ""}" is not a pinned browser.sentry-cdn.com URL`);
  }
  const integrity = String(sentryLoader.attrs.integrity ?? "");
  if (!integrity.startsWith("sha384-")) {
    fail("C4", "Sentry SDK script has no sha384 subresource-integrity attribute");
  }
  const dsn = sentryLoader.attrs["data-dsn"];
  if (typeof dsn !== "string" || !dsn.startsWith("https://")) {
    fail("C4", "Sentry loader has no https data-dsn; browser error monitoring would stay inert");
  }
}
if (!refs.some((r) => r.kind !== "meta" && resolveTarget(r.value).type === "file" && resolveTarget(r.value).relPath === "assets/js/sentry-init.js")) {
  fail("C4", "index.html does not reference assets/js/sentry-init.js");
}

const FAVICON_RELS = new Set(["icon", "shortcut icon", "apple-touch-icon", "mask-icon"]);
for (const tag of tags) {
  if (tag.name !== "link" || !FAVICON_RELS.has((tag.attrs.rel || "").toLowerCase())) continue;
  const href = tag.attrs.href;
  if (typeof href !== "string") continue;
  const target = resolveTarget(href);
  const relPath = target.type === "file" ? target.relPath || "index.html" : null;
  if (target.type === "external") continue;
  if (relPath === null || !servedSet.has(relPath)) {
    fail("C6", `favicon asset "${href}" referenced at line ${tag.line} is not present in the served tree`);
  }
}

// C7 — structural accessibility regressions.
// Dependency-free regression coverage for two previously repaired axe violations
// (footer h4 heading-order; floating WhatsApp link outside every landmark).
// This is structural regression coverage only — it does NOT replace an axe audit.
const footerOpen = tags.find((t) => t.name === "footer");
const footerCloseOffset = indexHtml.toLowerCase().indexOf("</footer");
if (!footerOpen || footerCloseOffset === -1) {
  fail("C7", "<footer> landmark not found; structural accessibility contract unverifiable");
} else {
  const footerEndLine = indexHtml.slice(0, footerCloseOffset).split("\n").length;
  const inFooter = (t) => t.line >= footerOpen.line && t.line <= footerEndLine;

  // The page outline is h1 → h2 sections → h3 groups, so footer group headings must
  // remain <h3>: the next valid level. Anything deeper (the old h4 state) reintroduces
  // the heading-order violation; shallower levels would flatten footer grouping.
  const footerHeadings = tags.filter((t) => /^h[1-6]$/.test(t.name) && inFooter(t));
  if (footerHeadings.length === 0) {
    fail("C7", "no headings found inside <footer>; the group-heading contract regressed");
  }
  for (const h of footerHeadings) {
    if (h.name !== "h3") {
      fail(
        "C7",
        `line ${h.line}: <${h.name}> inside <footer> reintroduces the heading-order regression; footer headings must remain <h3> (next valid level under the page's h2 sections)`
      );
    }
  }

  // Floating WhatsApp link: exactly one, inside the footer landmark, focusable, labelled.
  const waFloats = tags.filter(
    (t) => t.name === "a" && typeof t.attrs.class === "string" && t.attrs.class.split(/\s+/).includes("wa-float")
  );
  if (waFloats.length !== 1) {
    fail("C7", `expected exactly one floating WhatsApp link (<a class="wa-float">), found ${waFloats.length}`);
  } else {
    const wa = waFloats[0];
    if (!inFooter(wa)) {
      fail(
        "C7",
        `line ${wa.line}: floating WhatsApp link (.wa-float) sits outside the <footer> landmark; it must stay inside a landmark so it is not orphaned content (axe: region)`
      );
    }
    if (!wa.attrs.href || wa.attrs.tabindex === "-1" || wa.attrs["aria-hidden"] === "true" || "hidden" in wa.attrs) {
      fail(
        "C7",
        `line ${wa.line}: floating WhatsApp link is not focusable by keyboard users (needs href, no tabindex="-1"/aria-hidden/hidden)`
      );
    }
    const ariaLabel = typeof wa.attrs["aria-label"] === "string" ? wa.attrs["aria-label"].trim() : "";
    if (!ariaLabel) {
      fail("C7", 'floating WhatsApp link has no accessible name: aria-label="Chat on WhatsApp" is missing');
    }
  }
}

const css = await loadText("assets/css/styles.css");
if (css === null) {
  fail("C5", "assets/css/styles.css is missing; theme colour contract unverifiable");
}

const robots = await loadText("robots.txt");
if (robots !== null) {
  const sitemapMatch = /sitemap\s*:\s*(\S+)/gi;
  let m;
  while ((m = sitemapMatch.exec(robots))) {
    const t = resolveTarget(m[1]);
    if (t.type === "file" && t.relPath && !t.relPath.startsWith("http") && !servedSet.has(t.relPath)) {
      fail("C6", `robots.txt declares sitemap "${m[1]}" which is not in the served tree`);
    }
  }
}

const sitemapText = await loadText("sitemap.xml");
if (sitemapText !== null) {
  const locs = [...sitemapText.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map((m) => m[1]);
  if (locs.length === 0) {
    fail("C6", "sitemap.xml contains no <loc> entries; it would advertise nothing");
  }
  for (const loc of locs) {
    const t = resolveTarget(loc);
    if (t.type === "external") continue;
    if (t.type !== "file") {
      fail("C6", `sitemap.xml lists "${loc}" which is not a resolvable URL`);
      continue;
    }
    if (t.relPath === "") t.relPath = "index.html";
    if (!servedSet.has(t.relPath)) {
      fail("C6", `sitemap.xml lists "${loc}" which does not resolve to a served file (missing "${t.relPath}")`);
    }
  }
}

if (css !== null) {
  const tokens = extractCssTokens(css);
  const literalFromCss = (selectorPattern, property) => {
    for (const body of cssRuleBodies(css, selectorPattern)) {
      const m = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i").exec(body);
      if (m) return m[1].trim();
    }
    return null;
  };
  const CONTRAST_PAIRS = [
    { label: "body text on white", fg: "var(--ink-900)", bg: "var(--white)", min: 4.5 },
    { label: "secondary text on white", fg: "var(--ink-600)", bg: "var(--white)", min: 4.5 },
    { label: "secondary text on sand section", fg: "var(--ink-600)", bg: "var(--sand-100)", min: 4.5 },
    { label: "eyebrow accent on white", fg: "var(--gold-700)", bg: "var(--white)", min: 4.5 },
    { label: "eyebrow accent on sand-100 section", fg: "var(--gold-700)", bg: "var(--sand-100)", min: 4.5 },
    { label: "eyebrow accent on sand-200 section", fg: "var(--gold-700)", bg: "var(--sand-200)", min: 4.5 },
    { label: "service chip text", fg: "var(--emerald-700)", bg: "var(--sand-100)", min: 4.5 },
    { label: "primary button label", fg: "var(--emerald-900)", bg: "var(--gold-500)", min: 4.5 },
    { label: "primary button label on hover fill", fg: "var(--emerald-900)", bg: "var(--gold-300)", min: 4.5 },
    { label: "dark-section heading", fg: "var(--gold-300)", bg: "var(--emerald-900)", min: 3 },
    { label: "dark-section body text", fg: literalFromCss("\\.hajj__body p", "color"), bg: "var(--emerald-900)", min: 4.5 },
    { label: "footer link", fg: literalFromCss("\\.footer__links a", "color"), bg: "var(--emerald-900)", min: 4.5 },
    { label: "footer legal small print", fg: literalFromCss("\\.footer__bottom \\.footer__legal", "color"), bg: "var(--emerald-900)", min: 4.5 },
    { label: "input placeholder", fg: literalFromCss("[^{}]*::placeholder[^{}]*", "color"), bg: "var(--sand-100)", min: 4.5 },
    { label: "form error message", fg: literalFromCss("\\.form-error", "color"), bg: literalFromCss("\\.form-error", "background"), min: 4.5 }
  ];
  for (const pair of CONTRAST_PAIRS) {
    if (!pair.fg || !pair.bg) {
      fail("C5", `contrast pair "${pair.label}" could not be extracted from styles.css; stylesheet structure drifted`);
      continue;
    }
    const fg = resolveCssColor(pair.fg, tokens);
    const bg = resolveCssColor(pair.bg, tokens);
    if (!fg || !bg) {
      fail("C5", `contrast pair "${pair.label}" uses unparseable colour (${pair.fg} on ${pair.bg})`);
      continue;
    }
    const effectiveFg = fg.a < 1 ? compositeOver(fg, bg) : fg;
    const ratio = contrastRatio(effectiveFg, bg);
    if (!(ratio >= pair.min)) {
      fail("C5", `"${pair.label}" contrast ${ratio.toFixed(2)}:1 is below the required WCAG AA ${pair.min}:1 (${pair.fg} on ${pair.bg})`);
    }
  }
}

const CHECK_LABELS = {
  C1: "internal references & fragment anchors",
  C2: "image alt text",
  C3: "enquiry form wiring",
  C4: "Sentry integration wired",
  C5: "WCAG AA theme colour pairs",
  C6: "favicon / robots / sitemap references",
  C7: "structural a11y regressions (footer heading level, floating WhatsApp landmark/focus/label) — regression coverage, not an axe substitute"
};

const byCheck = new Map();
for (const f of failures) {
  if (!byCheck.has(f.check)) byCheck.set(f.check, []);
  byCheck.get(f.check).push(f.message);
}

console.log(`check-site: index.html ${tags.length} tags, ${refs.length} URL references, served tree ${servedSet.size} files`);
let exitCode = 0;
for (const id of Object.keys(CHECK_LABELS)) {
  const list = byCheck.get(id) ?? [];
  console.log(`  [${id}] ${CHECK_LABELS[id]}: ${list.length ? `${list.length} failure(s)` : "ok"}`);
}
if (failures.length) {
  console.error(`\ncheck-site: ${failures.length} contract violation(s):`);
  let lastId = null;
  for (const f of failures) {
    if (f.check !== lastId) {
      console.error(`\n[${f.check}] ${CHECK_LABELS[f.check] ?? f.check}`);
      lastId = f.check;
    }
    console.error(`  - ${f.message}`);
  }
  exitCode = 1;
} else {
  console.log("\ncheck-site: all site-contract checks passed.");
}
process.exit(exitCode);
