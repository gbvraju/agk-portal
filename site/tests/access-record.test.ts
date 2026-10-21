// The access record (SPEC-0001 rule 9): the proof that a GitHub App user token reads a private repository's artifacts is
// kept in docs/runs/. This test reads the record as text. REQ-101 AC8 is proven by the record, which this test keeps
// honest after the throwaway workflow that produced it is removed. No network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const record = readFileSync(resolve(import.meta.dirname, "..", "..", "docs", "runs", "app-access-proof.md"), "utf8");

test("REQ-101 AC8: the record names each call of the proof run with its HTTP status and the control call without a token", () => {
  assert.match(record, /39591232745/, "the run that proved it");
  assert.match(record, /call: POST \/login\/oauth\/access_token -> 200/);
  assert.match(record, /call: GET \/repos\/[^\s]+\/actions\/artifacts -> 200/);
  assert.match(record, /artifacts\/\{id\}\/zip -> 302/);
  assert.match(record, /redirect host [^\s]+\) -> 200/);
  assert.match(record, /control: GET [^\n]*without a token -> 404/);
});

test("REQ-101 AC8: the record keeps what failed, and the refusal that stopped the run with no workaround", () => {
  assert.match(record, /actions\/artifacts -> 403/);
  assert.match(record, /stop: access was refused \(403\); no workaround, no secret/);
});

test("REQ-101 AC8: the record holds no token, no device code and no signed address", () => {
  assert.ok(!/\bgh[pousr]_[A-Za-z0-9]{10,}/.test(record), "no GitHub token");
  assert.ok(!/[?&](sig|se|sp|sv|token)=/i.test(record), "no signed query");
  assert.ok(!/https:\/\/[^\s)]*blob\.core\.windows\.net\/[^\s)]*/i.test(record), "only the redirect host is named, never an address");
  assert.ok(!/personal access token/i.test(record.replace(/no personal access token|adds no personal access token/gi, "")), "no personal access token is used");
});
