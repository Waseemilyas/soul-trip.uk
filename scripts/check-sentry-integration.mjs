import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const init = await readFile(new URL("../assets/js/sentry-init.js", import.meta.url), "utf8");
const mode = process.argv[2] ?? "--expect-active";

if (mode !== "--expect-active" && mode !== "--expect-inert") {
  throw new Error("Usage: node scripts/check-sentry-integration.mjs [--expect-active|--expect-inert]");
}

const sdk = await fetch("https://browser.sentry-cdn.com/10.66.0/bundle.min.js");

if (!sdk.ok) throw new Error(`Pinned Sentry SDK was unavailable: HTTP ${sdk.status}`);

const sri = `sha384-${createHash("sha384").update(Buffer.from(await sdk.arrayBuffer())).digest("base64")}`;
const requiredIndex = [
  'id="sentry-sdk"',
  "https://browser.sentry-cdn.com/10.66.0/bundle.min.js",
  `integrity="${sri}"`,
  'src="assets/js/sentry-init.js"'
];
const requiredPrivacyControls = [
  "sendDefaultPii: false",
  "tracesSampleRate: 0",
  "profilesSampleRate: 0",
  "maxBreadcrumbs: 0",
  'integration.name !== "Breadcrumbs"',
  'integration.name !== "BrowserSession"',
  "beforeBreadcrumb",
  "beforeSend",
  "delete event.request",
  "delete event.user",
  "delete event.breadcrumbs",
  "delete event.contexts",
  "delete event.extra",
  "delete event.tags"
];

for (const value of requiredIndex) {
  if (!index.includes(value)) throw new Error(`Missing Sentry page control: ${value}`);
}

for (const value of requiredPrivacyControls) {
  if (!init.includes(value)) throw new Error(`Missing Sentry privacy control: ${value}`);
}

const dsnMatch = index.match(/id="sentry-sdk"[\s\S]*?data-dsn="([^"]*)"/);
const dsn = dsnMatch?.[1];

if (mode === "--expect-inert" && dsn) {
  throw new Error("Expected an inert pre-release page, but the Sentry DSN is active.");
}

if (mode === "--expect-active") {
  if (!dsn) throw new Error("Expected an active production browser DSN, but none was present.");
  if (!/^https:\/\/[^@/]+@o\d+\.ingest(?:\.[a-z0-9-]+)*\.sentry\.io\/\d+$/i.test(dsn)) {
    throw new Error("The active Sentry DSN is not a valid browser ingest DSN.");
  }
}

console.log(`Sentry integration check passed: pinned SDK, ${mode === "--expect-active" ? "active browser DSN" : "inert pre-release DSN"}, and privacy controls verified.`);
