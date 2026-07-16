import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const init = await readFile(new URL("../assets/js/sentry-init.js", import.meta.url), "utf8");
const sdk = await fetch("https://browser.sentry-cdn.com/10.66.0/bundle.min.js");

if (!sdk.ok) throw new Error(`Pinned Sentry SDK was unavailable: HTTP ${sdk.status}`);

const sri = `sha384-${createHash("sha384").update(Buffer.from(await sdk.arrayBuffer())).digest("base64")}`;
const requiredIndex = [
  'id="sentry-sdk"',
  'data-dsn=""',
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

if (/data-dsn="(?!")[^"]+"/.test(index)) {
  throw new Error("The source page must remain DSN-inert until the approved production release.");
}

console.log("Sentry integration check passed: pinned SDK, inert source DSN, and privacy controls verified.");
