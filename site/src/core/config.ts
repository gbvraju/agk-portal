// The one small interface through which secrets and settings reach the core (SPEC-0003 rule 5). The names are
// on one documented list; the names are in the code and the values never are. A host adapter fills it from the
// host's own secret store.
export const CONFIG_NAMES = [
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_CLIENT_SECRET",
  "SESSION_KEY",
  "CALLBACK_URL",
] as const;

export type ConfigName = (typeof CONFIG_NAMES)[number];

export interface Config {
  get(name: ConfigName): string | undefined;
}

// The time comes from an injected function so that tests fix it (SPEC-0003 rule 7).
export type Clock = () => number;

// A refusal names the setting and never a value (principle 8).
export class MissingSetting extends Error {
  readonly setting: ConfigName;

  constructor(setting: ConfigName) {
    super(`the setting ${setting} is not set`);
    this.name = "MissingSetting";
    this.setting = setting;
  }
}

export function requireSetting(config: Config, name: ConfigName): string {
  const value = config.get(name);
  if (value === undefined || value === "") throw new MissingSetting(name);
  return value;
}
