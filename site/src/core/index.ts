import { CONFIG_NAMES, requireSetting, type Clock, type Config } from "./config.ts";

export { CONFIG_NAMES, MissingSetting, requireSetting } from "./config.ts";
export type { Clock, Config, ConfigName } from "./config.ts";

export interface Settings {
  clientId: string;
  clientSecret: string;
  sessionKey: string;
  callbackUrl: string;
}

export interface Dependencies {
  config: Config;
  now: Clock;
}

export interface Core {
  settings: Settings;
  now: Clock;
}

// The core reads its settings only through Config, and refuses before it does anything else when one is missing.
export function loadSettings(config: Config): Settings {
  const [clientId, clientSecret, sessionKey, callbackUrl] = CONFIG_NAMES.map((name) => requireSetting(config, name));
  return {
    clientId: clientId as string,
    clientSecret: clientSecret as string,
    sessionKey: sessionKey as string,
    callbackUrl: callbackUrl as string,
  };
}

export function createCore(dependencies: Dependencies): Core {
  return { settings: loadSettings(dependencies.config), now: dependencies.now };
}
