// The staging deployment (ADR-0016, brief item 9 moved forward): the Worker's configuration and the runbook that the
// maintainers follow by hand. They are read as text. The configuration names no secret and no binding, the runbook names
// each setting and no value, and no workflow deploys anything. No network.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { CONFIG_NAMES, CONTENT_SECURITY_POLICY } from "../src/core/index.ts";

const siteRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(siteRoot, "..");
const config = readFileSync(resolve(siteRoot, "wrangler.toml"), "utf8");
const runbook = readFileSync(resolve(repoRoot, "docs", "runs", "deploy-cloudflare.md"), "utf8");
const code = config.split("\n").filter((line) => !line.trim().startsWith("#") && line.trim() !== "").join("\n");

test("the Worker is the Cloudflare adapter, named for staging, on the workers.dev address, keeping the variables set in the dashboard", () => {
  assert.match(code, /^name = "agk-portal-staging"$/m);
  const main = /^main = "([^"]+)"$/m.exec(code)?.[1];
  assert.equal(main, "src/adapters/cloudflare/index.ts");
  assert.ok(existsSync(resolve(siteRoot, main ?? "missing")), "main exists");
  assert.match(code, /^compatibility_date = "\d{4}-\d{2}-\d{2}"$/m);
  assert.match(code, /^workers_dev = true$/m);
  assert.match(code, /^keep_vars = true$/m, "a deploy does not remove the settings put in the dashboard");
});

test("REQ-103 AC5: the configuration names no secret, no setting, no binding, no route and no account", () => {
  for (const name of CONFIG_NAMES) assert.ok(!config.includes(name), `${name} is not in wrangler.toml, even in a comment`);
  assert.ok(!/^\s*\[\[/m.test(code), "no binding table");
  assert.ok(!/^\s*\[(vars|env|triggers|kv_namespaces|d1_databases|r2_buckets|durable_objects|services|queues|ai|analytics_engine_datasets)/m.test(code), "no variables, environment or binding");
  assert.ok(!/^(account_id|route|routes|zone_id|pattern|kv_namespaces|d1_databases|r2_buckets)\b/m.test(code), "no account, route or storage");
  assert.deepEqual(
    [...code.matchAll(/^([a-z_]+) =/gm)].map((m) => m[1]).sort(),
    ["compatibility_date", "keep_vars", "main", "name", "workers_dev"],
    "exactly these keys",
  );
});

test("REQ-103 AC5: the runbook lists each of the four settings by name, the two secrets as secrets and the two others as variables, and no value", () => {
  for (const name of CONFIG_NAMES) assert.ok(runbook.includes(name), `${name} is in the runbook`);
  const row = (name: string): string => runbook.split("\n").find((line) => line.startsWith("|") && line.includes(name)) ?? "";
  for (const name of ["GITHUB_APP_CLIENT_SECRET", "SESSION_KEY"]) assert.match(row(name), /\bsecret\b/i, `${name} is a secret`);
  for (const name of ["GITHUB_APP_CLIENT_ID", "CALLBACK_URL"]) assert.match(row(name), /\bvariable\b/i, `${name} is a variable`);
  assert.ok(!/\bgh[pousr]_[A-Za-z0-9]{10,}|github_pat_|-----BEGIN|[A-Fa-f0-9]{32,}|[A-Za-z0-9+/=_-]{40,}/.test(runbook.replace(/https?:\/\/\S+/g, " ").replace(/`[^`]*`/g, (m) => (m.length > 60 ? " " : ` ${m} `))), "no token, key or long random value");
  assert.ok(!/(secret|key|token)\s*[:=]\s*["']?[A-Za-z0-9+/_-]{12,}/i.test(runbook), "no assignment of a value to a secret");
});

test("REQ-104 AC1: the runbook tells the maintainers to check the response headers, with the exact policy the code sends", () => {
  assert.ok(runbook.includes(CONTENT_SECURITY_POLICY), "the Content-Security-Policy string of the code, exactly");
  for (const header of ["X-Content-Type-Options: nosniff", "Referrer-Policy: no-referrer", "Strict-Transport-Security:", "Cache-Control: no-store"]) {
    assert.ok(runbook.includes(header), header);
  }
  assert.match(runbook, /curl -sI https:\/\/agk-portal-staging\./);
});

test("the runbook says what the maintainers do in Cloudflare and in GitHub, and that nothing is deployed from GitHub", () => {
  for (const heading of ["## In Cloudflare", "## In GitHub", "## Checks after the first deployment", "## What to send back", "## Undo"]) {
    assert.ok(runbook.includes(heading), heading);
  }
  assert.match(runbook, /Workers Builds/);
  assert.match(runbook, /no deploy workflow/i);
  assert.match(runbook, /no Cloudflare token in GitHub/i);
  const workflows = resolve(repoRoot, ".github", "workflows");
  for (const file of readdirSync(workflows)) {
    assert.ok(!/wrangler|cloudflare/i.test(readFileSync(resolve(workflows, file), "utf8")), `${file} deploys nothing`);
  }
});

test("the runbook lists every unconfirmed fact that the staging deployment settles, each with where to read it", () => {
  const section = runbook.split("## Unconfirmed facts this deployment settles")[1] ?? "";
  assert.ok(section.length > 0, "the section exists");
  for (const fact of [
    "authorization address",
    "token answer",
    "permissions",
    "installations listing",
    "artifact listing",
    "Location",
    "env",
    "8 hours",
    "selected repositories",
    "compatibility_date",
    "keep_vars",
  ]) {
    assert.ok(section.includes(fact), `the list names: ${fact}`);
  }
});
