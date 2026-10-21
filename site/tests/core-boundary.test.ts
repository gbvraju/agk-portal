// The portable core boundary (SPEC-0003): the core uses only web-standard APIs and imports nothing host-specific.
// Markers REQ-103 AC1 to AC6 are in the test names. No network.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { CONFIG_NAMES, MissingSetting, createCore, type Config, type ConfigName } from "../src/core/index.ts";
import { filesUnder, scanCore, scanFile } from "./support/import-scan.ts";

const siteRoot = resolve(import.meta.dirname, "..");
const coreDir = resolve(siteRoot, "src", "core");
const tsc = resolve(siteRoot, "node_modules", ".bin", "tsc");
const coreProject = resolve(siteRoot, "tsconfig.core.json");

let work = "";
before(() => {
  work = mkdtempSync(join(tmpdir(), "core-boundary-"));
});
after(() => {
  rmSync(work, { recursive: true, force: true });
});

function compile(project: string): { status: number | null; output: string } {
  const run = spawnSync(tsc, ["-p", project, "--noEmit"], { encoding: "utf8" });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

function fixtureDir(name: string, files: Record<string, string>): string {
  const dir = join(work, name);
  mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
  return dir;
}

const values: Record<ConfigName, string> = {
  GITHUB_APP_CLIENT_ID: "client-id-value",
  GITHUB_APP_CLIENT_SECRET: "client-secret-value",
  SESSION_KEY: "session-key-value",
  CALLBACK_URL: "https://portal.example/callback",
};

test("REQ-103 AC1: the core compiles under its own configuration with the web-worker libraries and no Node types", () => {
  const config = JSON.parse(readFileSync(coreProject, "utf8")) as { compilerOptions: { types?: string[]; lib?: string[] } };
  assert.deepEqual(config.compilerOptions.types, [], "no types are loaded, so no Node types");
  assert.ok(config.compilerOptions.lib?.includes("WebWorker"), "the web-worker library is used");
  const run = compile(coreProject);
  assert.equal(run.status, 0, run.output);
});

test("REQ-103 AC2: a core file that uses a Node-only global fails the same check and is named", () => {
  for (const [name, code] of [
    ["uses-process", "export const home = process.env.HOME;\n"],
    ["uses-buffer", 'export const raw = Buffer.from("a");\n'],
  ] as const) {
    const dir = fixtureDir(name, { [`${name}.ts`]: code });
    const project = join(dir, "tsconfig.json");
    writeFileSync(project, JSON.stringify({ extends: coreProject, include: [dir] }));
    const run = compile(project);
    assert.notEqual(run.status, 0, `${name} must fail to compile`);
    assert.ok(run.output.includes(`${name}.ts`), `the output names the file: ${run.output}`);
  }
});

test("REQ-103 AC3: every file of the real core imports only relative paths inside the core and the core has no runtime dependency", () => {
  const files = filesUnder(coreDir);
  assert.ok(files.length >= 2, "the core has files");
  assert.deepEqual(scanCore(coreDir), []);
  const manifest = JSON.parse(readFileSync(resolve(siteRoot, "package.json"), "utf8")) as Record<string, unknown>;
  assert.ok(!("dependencies" in manifest), "package.json has no dependencies entry, only devDependencies");
});

test("REQ-103 AC4: a core file that imports a host module, a package, an absolute path or leaves the core fails the scan and is named", () => {
  const cases: Record<string, [string, string]> = {
    "node-module.ts": ['import { readFileSync } from "node:fs";\nexport const a = readFileSync;\n', "node:fs"],
    "cloudflare-module.ts": ['import { env } from "cloudflare:workers";\nexport const b = env;\n', "cloudflare:workers"],
    "scoped-cloudflare.ts": ['import type { Fetcher } from "@cloudflare/workers-types";\nexport type C = Fetcher;\n', "@cloudflare/workers-types"],
    "package.ts": ['import { z } from "zod";\nexport const d = z;\n', "zod"],
    "absolute.ts": ['import { x } from "/etc/x";\nexport const e = x;\n', "/etc/x"],
    "leaves-core.ts": ['import { y } from "../../outside";\nexport const f = y;\n', "../../outside"],
    "dynamic.ts": ['export const g = () => import("node:fs");\n', "node:fs"],
    "required.ts": ['import fs = require("fs");\nexport const h = fs;\n', "fs"],
    "reexport.ts": ['export * from "somewhere-else";\n', "somewhere-else"],
    "import-type.ts": ['export type I = import("node:buffer").Buffer;\n', "node:buffer"],
    "computed.ts": ["const name = String(1);\nexport const j = () => import(name);\n", "<computed>"],
  };
  const dir = fixtureDir("scan-core", { "ok.ts": 'export { k } from "./ok2.ts";\n', "ok2.ts": "export const k = 1;\n" });
  assert.deepEqual(scanFile(join(dir, "ok.ts"), dir), [], "a relative path inside the core passes");
  for (const [file, [code, specifier]] of Object.entries(cases)) {
    writeFileSync(join(dir, file), code);
    const violations = scanFile(join(dir, file), dir);
    assert.ok(
      violations.some((v) => basename(v.file) === file && v.specifier === specifier),
      `${file} must be named with ${specifier}, got ${JSON.stringify(violations)}`,
    );
  }
  writeFileSync(join(dir, "broken.ts"), "export const = ;\n");
  assert.equal(scanFile(join(dir, "broken.ts"), dir).length, 1, "a file that cannot be parsed fails closed");
  writeFileSync(join(dir, "plain.js"), "export const z = 1;\n");
  assert.equal(scanFile(join(dir, "plain.js"), dir).length, 1, "a file that is not .ts fails closed");
});

test("REQ-103 AC5: the core asks only through the configuration interface, for names on the documented list", () => {
  const asked: string[] = [];
  const config: Config = {
    get(name) {
      asked.push(name);
      return values[name];
    },
  };
  process.env["SESSION_KEY"] = "env-decoy";
  process.env["GITHUB_APP_CLIENT_SECRET"] = "env-decoy";
  (globalThis as Record<string, unknown>)["SESSION_KEY"] = "global-decoy";
  try {
    const core = createCore({ config, now: () => 1_000 });
    assert.deepEqual(core.settings, {
      clientId: values.GITHUB_APP_CLIENT_ID,
      clientSecret: values.GITHUB_APP_CLIENT_SECRET,
      sessionKey: values.SESSION_KEY,
      callbackUrl: values.CALLBACK_URL,
    });
    assert.equal(core.now(), 1_000, "the time comes from the injected clock");
  } finally {
    delete process.env["SESSION_KEY"];
    delete process.env["GITHUB_APP_CLIENT_SECRET"];
    delete (globalThis as Record<string, unknown>)["SESSION_KEY"];
  }
  assert.ok(asked.length > 0, "the core asked for its settings");
  for (const name of asked) assert.ok((CONFIG_NAMES as readonly string[]).includes(name), `${name} is on the documented list`);
  assert.deepEqual([...new Set(asked)].sort(), [...CONFIG_NAMES].sort());
});

test("REQ-103 AC6: a missing setting is refused by name, never by value, and nothing is called", () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (() => {
    calls += 1;
    throw new Error("fetch must not be called");
  }) as typeof fetch;
  try {
    for (const missing of CONFIG_NAMES) {
      const config: Config = { get: (name) => (name === missing ? undefined : values[name]) };
      assert.throws(
        () => createCore({ config, now: () => 0 }),
        (error: unknown) => {
          assert.ok(error instanceof MissingSetting);
          assert.ok(error.message.includes(missing), `the message names ${missing}`);
          for (const value of Object.values(values)) assert.ok(!error.message.includes(value), "the message holds no value");
          return true;
        },
      );
    }
    assert.throws(() => createCore({ config: { get: () => "" }, now: () => 0 }), MissingSetting, "an empty setting is missing");
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(calls, 0);
});
