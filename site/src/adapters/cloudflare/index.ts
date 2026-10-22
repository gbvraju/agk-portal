// The Cloudflare Workers adapter (SPEC-0003 rule 8): the one place that knows the host's `env`. It copies the four
// documented settings out of `env` into a Config, builds the core with that Config and the host's clock and fetch (the
// core reads neither a clock nor a global, SPEC-0003 rule 7), answers the request with the core's app and returns the
// core's response unchanged. It passes no `env`, no binding and no execution context to the core.
import {
  CONFIG_NAMES,
  MissingSetting,
  createApp,
  createCore,
  createGithubClient,
  errorPage,
  htmlPage,
  type Clock,
  type Config,
  type ConfigName,
} from "../../core/index.ts";

type Send = Parameters<typeof createGithubClient>[0]["fetch"];

export interface Runtime {
  send: Send;
  now: Clock;
}

// Only text values of the documented names are copied, once, so the env cannot be reached through the Config.
function configFrom(env: Record<string, unknown>): Config {
  const copy = new Map<string, string>();
  for (const name of CONFIG_NAMES) {
    const value = env[name];
    if (typeof value === "string" && value !== "") copy.set(name, value);
  }
  return { get: (name: ConfigName) => copy.get(name) };
}

export function createWorker(runtime: Runtime) {
  return {
    // The Workers module signature is (request, env, context); the context is not used.
    async fetch(request: Request, env: Record<string, unknown>, _context?: unknown): Promise<Response> {
      try {
        const core = createCore({ config: configFrom(env), now: runtime.now });
        const github = createGithubClient({ fetch: runtime.send });
        return await createApp(core, { github })(request);
      } catch (error) {
        // A missing setting is refused by its name; nothing else of the failure reaches the response.
        if (error instanceof MissingSetting) return htmlPage("Not set up", `<p>The portal is not set up: the setting ${error.setting} is not set.</p>`, 500);
        return errorPage();
      }
    },
  };
}

export default createWorker({ send: (input, init) => fetch(input, init), now: () => Date.now() });
