// The throwaway access proof (SPEC-0001 rule 9): this test reads the workflow file as text and fails when it
// could leak a credential, write to GitHub, or print more than the allowed lines. It uses no network.
// REQ-101 AC8: the proof records each call and stops on a refusal. REQ-101 AC7: no write call, no other credential.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const path = resolve(repoRoot, ".github", "workflows", "app-device-flow-proof.yml");
const text = readFileSync(path, "utf8");
const lines = text.split("\n");
// Code lines: comments removed, backslash continuations joined into one logical line.
const code = lines.filter((l) => !l.trim().startsWith("#")).join("\n").replace(/\\\n\s*/g, " ");
const logical = code.split("\n");

const DEVICE_ADDRESSES = ["https://github.com/login/device/code", "https://github.com/login/oauth/access_token"];
const ALLOWED_PRINT = ["call: ", "user code: ", "verify at: ", "redirect host: ", "file: ", "control: ", "stop: ", "waiting: "];
const SECRETS = ["USER_TOKEN", "DEVICE_CODE", "SIGNED_URL"];

test("REQ-101 AC8: the header says the workflow is throwaway and when it is removed", () => {
  const header = lines.filter((l) => l.trim().startsWith("#")).join("\n");
  assert.match(header, /throwaway/i);
  assert.match(header, /Q-B1-3/);
});

test("REQ-101 AC7: the only trigger is workflow_dispatch and the target is an input", () => {
  assert.match(code, /^on:\s*\n\s+workflow_dispatch:/m);
  for (const other of ["push:", "pull_request", "schedule:", "workflow_run", "repository_dispatch", "workflow_call"]) {
    assert.ok(!code.includes(other), `trigger ${other} is not allowed`);
  }
  assert.match(code, /inputs\.target/);
  assert.match(code, /target:\s*\n\s+description:/);
});

test("REQ-101 AC7: no secret, no personal access token, no workflow token, no action", () => {
  assert.ok(!/secrets\./.test(code), "no secrets. reference");
  assert.ok(!/GITHUB_TOKEN|github\.token|\bPAT\b|personal.access/i.test(code), "no other credential");
  assert.ok(!/^\s*-?\s*uses:/m.test(code), "no action is used");
  assert.match(code, /vars\.APP_CLIENT_ID/);
});

test("REQ-101 AC7: the permissions are empty or contents read", () => {
  assert.match(code, /^permissions:\s*(\{\}|\n\s+contents:\s*read\s*$)/m);
});

test("REQ-101 AC7: every repository path uses the input, none is hard coded", () => {
  const repos = [...code.matchAll(/\/repos\/([^\s"?]*)/g)].map((m) => m[1]);
  assert.ok(repos.length >= 2, "the list and the download paths are present");
  for (const r of repos) assert.match(r, /^\$\{?TARGET\}?\//, `path ${r} must start with the target`);
});

test("REQ-101 AC7: only GET calls to the API and the two device-flow POSTs", () => {
  for (const l of logical.filter((x) => /\bcurl\b/.test(x))) {
    const post = /-X\s*POST|\s-d\s|--data/.test(l);
    if (post) {
      assert.ok(DEVICE_ADDRESSES.some((a) => l.includes(a)), `a POST goes to a device-flow address only: ${l.trim()}`);
    }
    assert.ok(!/-X\s*(PUT|DELETE|PATCH)/.test(l), "no write method");
    if (l.includes("api.github.com")) assert.ok(!post, "no POST to the API");
  }
});

test("REQ-101 AC8: the download does not follow the redirect and the redirect target gets no token", () => {
  const download = logical.filter((l) => /\bcurl\b/.test(l) && l.includes("/zip"));
  assert.ok(download.length >= 1, "a download call is present");
  for (const l of download) assert.ok(!/\s-L\b|--location/.test(l), "the first hop is not followed");
  const follow = logical.filter((l) => /\bcurl\b/.test(l) && /\$\{?SIGNED_URL\}?/.test(l));
  assert.ok(follow.length >= 1, "the redirect target is fetched");
  for (const l of follow) assert.ok(!/Authorization/.test(l), "the redirect target is fetched without the token");
});

test("REQ-101 AC7: nothing verbose, no trace, no echo of a credential", () => {
  assert.ok(!/curl[^\n]*(\s-v\b|--verbose|--trace)/.test(code), "no verbose curl");
  assert.ok(!/set\s+-[a-z]*x|xtrace/.test(code), "no shell trace");
  for (const l of logical.filter((x) => /\b(echo|printf|say)\b/.test(x))) {
    if (SECRETS.some((v) => new RegExp(`\\$\\{?${v}\\}?`).test(l))) {
      assert.ok(l.includes("::add-mask::"), `a credential is only echoed to be masked: ${l.trim()}`);
    }
  }
});

test("REQ-101 AC7: each credential is masked before its first use", () => {
  const first = (re: RegExp): number => logical.findIndex((l) => re.test(l));
  const maskToken = first(/::add-mask::\$\{?USER_TOKEN\}?/);
  const maskDevice = first(/::add-mask::\$\{?DEVICE_CODE\}?/);
  const maskUrl = first(/::add-mask::\$\{?SIGNED_URL\}?/);
  assert.ok(maskToken >= 0 && maskDevice >= 0 && maskUrl >= 0, "all three are masked");
  assert.ok(maskToken < first(/Authorization:\s*Bearer/), "the token is masked before it is sent");
  assert.ok(maskDevice < first(/device_code=\$\{?DEVICE_CODE/), "the device code is masked before the poll");
  assert.ok(maskUrl < first(/curl[^\n]*\$\{?SIGNED_URL\}?/), "the signed address is masked before it is fetched");
});

test("REQ-101 AC8: every printed line is one of the allowed forms", () => {
  const printed = logical.filter((l) => /^\s*say\s/.test(l));
  assert.ok(printed.length >= 6, "the proof prints its calls");
  for (const l of printed) {
    const body = l.replace(/^\s*say\s+"?/, "");
    assert.ok(ALLOWED_PRINT.some((p) => body.startsWith(p)), `printed line not allowed: ${l.trim()}`);
  }
  const outputs = logical.filter((l) => /^\s*(echo|printf)\b/.test(l));
  for (const l of outputs) assert.ok(l.includes("::add-mask::") || /printf\s+'%s\\n'\s+"\$\*"/.test(l), `output outside say: ${l.trim()}`);
});

test("REQ-101 AC8: a refusal stops the run and each call prints its status", () => {
  assert.match(code, /401\|403\|404|401.*403.*404/);
  assert.match(code, /say "stop: /);
  for (const needle of ["call: POST /login/device/code", "call: POST /login/oauth/access_token", "call: GET /repos/", "control: GET /repos/"]) {
    assert.ok(code.includes(needle), `prints ${needle}`);
  }
  assert.ok(/timeout-minutes:\s*\d+/.test(code), "the job has a timeout");
});
