// Permissions-Policy on every response (SPEC-0004 rule 1 as amended by Amendment 5, ADR-0018): the page uses no browser
// feature, so every feature of the current list is denied with an empty allowlist. The list was read on 2026-10-22 from
// the W3C Permissions Policy features list (standardized, proposed and experimental), without the client-hint family
// ch-ua* (hints the page never asks for) and without interest-cohort (removed, not on the list). Marker REQ-104 AC1.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PERMISSIONS_POLICY,
  SESSION_COOKIE,
  createApp,
  createCore,
  errorPage,
  htmlPage,
  notFoundPage,
  redirectHome,
  redirectToAuthorize,
  sealSession,
  startSignIn,
  stylesheet,
  withCookies,
  type Config,
  type ConfigName,
} from "../src/core/index.ts";
import { createWorker } from "../src/adapters/cloudflare/index.ts";

const FEATURES: string[] = ["accelerometer", "all-screens-capture", "ambient-light-sensor", "attribution-reporting", "autofill", "autoplay", "battery", "bluetooth", "browsing-topics", "camera", "captured-surface-control", "clipboard-read", "clipboard-write", "compute-pressure", "conversion-measurement", "cross-origin-isolated", "deferred-fetch", "digital-credentials-create", "digital-credentials-get", "direct-sockets", "display-capture", "encrypted-media", "execution-while-not-rendered", "execution-while-out-of-viewport", "focus-without-user-activation", "fullscreen", "gamepad", "geolocation", "gyroscope", "hid", "identity-credentials-get", "idle-detection", "join-ad-interest-group", "keyboard-map", "language-detector", "language-model", "local-fonts", "magnetometer", "manual-text", "mediasession", "microphone", "midi", "monetization", "navigation-override", "otp-credentials", "payment", "picture-in-picture", "publickey-credentials-get", "rewriter", "run-ad-auction", "screen-wake-lock", "serial", "smart-card", "speaker-selection", "storage-access", "summarizer", "sync-script", "sync-xhr", "tools", "translator", "trust-token-redemption", "unload", "usb", "vertical-scroll", "web-share", "window-management", "writer", "xr-spatial-tracking"];

const KEY = "fixture-session-key-A-0123456789abcdefXYZ";
const START = 1_800_000_000_000;
const values: Record<ConfigName, string> = {
  GITHUB_APP_CLIENT_ID: "Iv1.fixtureclientid",
  GITHUB_APP_CLIENT_SECRET: "fixture-client-secret-value",
  SESSION_KEY: KEY,
  CALLBACK_URL: "https://portal.example/callback",
};
const config: Config = { get: (name) => values[name] };
const app = createApp(createCore({ config, now: () => START }), { projects: async () => [] });

test("REQ-104 AC1: the header value denies every feature of the verified list with an empty allowlist, and nothing else", () => {
  const entries = PERMISSIONS_POLICY.split(", ");
  assert.equal(entries.length, FEATURES.length, "one entry per feature");
  assert.deepEqual(entries, FEATURES.map((name) => `${name}=()`), "the list, in order");
  assert.equal(new Set(entries).size, entries.length, "no duplicate");
  assert.deepEqual([...FEATURES].sort(), FEATURES, "sorted");
  for (const entry of entries) assert.match(entry, /^[a-z][a-z0-9-]*=\(\)$/, entry);
  assert.ok(!PERMISSIONS_POLICY.includes("*") && !PERMISSIONS_POLICY.includes("self") && !PERMISSIONS_POLICY.includes('"'), "no feature is allowed to anyone");
});

test("REQ-104 AC1: the features a page could ask for are denied: camera, microphone, geolocation, payment, usb and the rest", () => {
  const entries = new Set(PERMISSIONS_POLICY.split(", "));
  for (const name of ["camera", "microphone", "geolocation", "payment", "usb", "serial", "hid", "bluetooth", "midi", "display-capture", "fullscreen", "picture-in-picture", "screen-wake-lock", "accelerometer", "gyroscope", "magnetometer", "ambient-light-sensor", "xr-spatial-tracking", "clipboard-read", "clipboard-write", "web-share", "idle-detection", "publickey-credentials-get", "identity-credentials-get", "otp-credentials", "storage-access", "sync-xhr", "autoplay", "encrypted-media", "browsing-topics", "attribution-reporting", "local-fonts", "window-management", "compute-pressure", "keyboard-map", "gamepad", "speaker-selection"]) {
    assert.ok(entries.has(`${name}=()`), name);
  }
  assert.ok(!/interest-cohort/.test(PERMISSIONS_POLICY), "removed from browsers and not on the current list");
  assert.ok(!/ch-ua/.test(PERMISSIONS_POLICY), "the client-hint family is not denied here");
});

async function responses(): Promise<[string, Response][]> {
  const cookie = `${SESSION_COOKIE}=${await sealSession({ token: "ghu_fixture_user_token_0123456789", expiresAt: START + 3_600_000 }, KEY)}`;
  const worker = createWorker({ now: () => START, send: async () => new Response("{}", { status: 404 }) });
  const incomplete = { ...values } as Record<string, unknown>;
  delete incomplete["SESSION_KEY"];
  return [
    ["htmlPage", htmlPage("t", "<p>x</p>")],
    ["htmlPage 500", htmlPage("t", "<p>x</p>", 500)],
    ["stylesheet", stylesheet()],
    ["redirectHome", redirectHome()],
    ["redirectToAuthorize", redirectToAuthorize("https://github.com/login/oauth/authorize?x=1", [])],
    ["notFoundPage", notFoundPage()],
    ["errorPage", errorPage()],
    ["withCookies", withCookies(htmlPage("t", "<p>x</p>"), ["__Host-a=b; Path=/; Secure"])],
    ["startSignIn", await startSignIn({ clientId: "id", callbackUrl: "https://portal.example/callback" })],
    ["offer", await app(new Request("https://portal.example/"))],
    ["signed in", await app(new Request("https://portal.example/", { headers: { cookie } }))],
    ["style.css", await app(new Request("https://portal.example/style.css"))],
    ["unknown path", await app(new Request("https://portal.example/nothing"))],
    ["refused callback", await app(new Request("https://portal.example/callback"))],
    ["refused signout", await app(new Request("https://portal.example/signout", { method: "POST", headers: { origin: "https://evil.example" } }))],
    ["signout", await app(new Request("https://portal.example/signout", { method: "POST", headers: { origin: "https://portal.example" } }))],
    ["wrong method", await app(new Request("https://portal.example/", { method: "PUT" }))],
    ["missing setting", await worker.fetch(new Request("https://portal.example/"), incomplete)],
  ];
}

test("REQ-104 AC1: every response of the server carries exactly one Permissions-Policy header with the exact value", async () => {
  const all = await responses();
  assert.ok(all.length >= 18);
  for (const [name, response] of all) {
    assert.equal(response.headers.get("permissions-policy"), PERMISSIONS_POLICY, name);
    assert.ok(!response.headers.get("permissions-policy")!.includes(","[0] + "  "), `${name}: one value`);
    assert.equal([...response.headers].filter(([key]) => key.toLowerCase() === "permissions-policy").length, 1, `${name}: one header`);
  }
});

test("REQ-104 AC1: the four former headers are unchanged beside it", async () => {
  for (const [name, response] of await responses()) {
    assert.match(response.headers.get("content-security-policy") ?? "", /^default-src 'none'; style-src 'self'/, name);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff", name);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer", name);
    assert.match(response.headers.get("strict-transport-security") ?? "", /^max-age=31536000/, name);
  }
});
