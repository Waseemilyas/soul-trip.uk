import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

export function isServedPath(relPath) {
  return !relPath.split("/").some((segment) => segment.startsWith(".") || segment.startsWith("_"));
}

export function listTrackedFiles(root) {
  let stdout;
  try {
    stdout = execFileSync("git", ["ls-files", "-z"], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    throw new Error(`Cannot enumerate git-tracked files in ${root}: ${error.message}`);
  }
  return stdout.toString("utf8").split("\0").filter(Boolean).sort();
}

export async function listUntrackedNonIgnored(root) {
  const stdout = execFileSync("git", ["ls-files", "-z", "--others", "--exclude-standard"], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024
  });
  return stdout.toString("utf8").split("\0").filter(Boolean).sort();
}

export async function listIntendedServedFiles(root) {
  const tracked = listTrackedFiles(root);
  const served = [];
  for (const rel of tracked) {
    if (!isServedPath(rel)) continue;
    await stat(path.join(root, rel));
    served.push(rel);
  }
  return served;
}

export async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"
]);

function parseAttrs(raw) {
  const attrs = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  for (let m; (m = re.exec(raw)); ) {
    const name = m[1].toLowerCase();
    if (!(name in attrs)) attrs[name] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return attrs;
}

export function scanHtml(html) {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
  const tags = [];
  const ids = new Set();
  const rawText = new Set(["script", "style"]);
  let i = 0;
  while (i < withoutComments.length) {
    const start = withoutComments.indexOf("<", i);
    if (start === -1) break;
    const m = /^<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)>(\/?)/.exec(withoutComments.slice(start));
    if (!m) {
      i = start + 1;
      continue;
    }
    const name = m[1].toLowerCase();
    const attrs = parseAttrs(m[2]);
    const selfClosed = m[3] === "/";
    const line = withoutComments.slice(0, start).split("\n").length;
    if ("id" in attrs && attrs.id) ids.add(attrs.id);
    if ("name" in attrs && name === "a" && attrs.name) ids.add(attrs.name);
    tags.push({ name, attrs, line });
    const end = start + m[0].length;
    if (!selfClosed && !VOID_ELEMENTS.has(name) && rawText.has(name)) {
      const closer = new RegExp(`</${name}\\s*>`, "i").exec(withoutComments.slice(end));
      i = closer ? end + closer.index + closer[0].length : withoutComments.length;
    } else {
      i = end;
    }
  }
  return { tags, ids };
}

export function parseCssColor(value) {
  const v = value.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) {
    const [r, g, b] = m[1].split("").map((c) => parseInt(c + c, 16));
    return { r, g, b, a: 1 };
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(v);
  if (m) {
    const n = m[1];
    return {
      r: parseInt(n.slice(0, 2), 16),
      g: parseInt(n.slice(2, 4), 16),
      b: parseInt(n.slice(4, 6), 16),
      a: m[2] ? parseInt(m[2], 16) / 255 : 1
    };
  }
  m = /^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)(?:[\s,]+([0-9.]+%?))?\s*\)$/.exec(v);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: parseFloat(m[1]), g: parseFloat(m[2]), b: parseFloat(m[3]), a };
  }
  return null;
}

export function compositeOver(fgColor, bgColor) {
  const a = fgColor.a;
  return {
    r: Math.round(fgColor.r * a + bgColor.r * (1 - a)),
    g: Math.round(fgColor.g * a + bgColor.g * (1 - a)),
    b: Math.round(fgColor.b * a + bgColor.b * (1 - a))
  };
}

function srgbChannel(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }) {
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b);
}

export function contrastRatio(colorA, colorB) {
  const la = relativeLuminance(colorA);
  const lb = relativeLuminance(colorB);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function extractCssTokens(css) {
  const tokens = new Map();
  const rootRe = /(^|[}\s]):root\s*\{([^{}]*)\}/g;
  for (let m; (m = rootRe.exec(css)); ) {
    const declRe = /--([a-zA-Z0-9-]+)\s*:\s*([^;{}]+)/g;
    for (let d; (d = declRe.exec(m[2])); ) tokens.set(d[1], d[2].trim());
  }
  return tokens;
}

export function resolveCssColor(specifier, tokens, depth = 0) {
  if (depth > 8) return null;
  const value = specifier.trim();
  const varMatch = /^var\(\s*--([a-zA-Z0-9-]+)\s*(?:,\s*([^)]+)\s*)?\)$/.exec(value);
  if (varMatch) {
    const token = tokens.get(varMatch[1]);
    if (token === undefined) return varMatch[2] ? resolveCssColor(varMatch[2], tokens, depth + 1) : null;
    return resolveCssColor(token, tokens, depth + 1);
  }
  return parseCssColor(value);
}

export function cssRuleBodies(css, selectorPattern) {
  const bodies = [];
  const re = new RegExp(`(^|[}\\s])(${selectorPattern})\\s*\\{([^{}]*)\\}`, "g");
  for (let m; (m = re.exec(css)); ) bodies.push(m[3]);
  return bodies;
}
