import { CONFIG_NAMES, requireSetting, type Clock, type Config } from "./config.ts";

export { CONFIG_NAMES, MissingSetting, requireSetting } from "./config.ts";
export type { Clock, Config, ConfigName } from "./config.ts";
export { API_HOST, AUTHORIZE_ADDRESS, TOKEN_ADDRESS, createGithubClient, guardedFetch } from "./github.ts";
export { EMPTY_LIST_PHRASE, createApp } from "./app.ts";
export type { AppOptions } from "./app.ts";
export { clearCookie, readCookie, serializeCookie } from "./cookies.ts";
export {
  ARCHIVE_REASON,
  LISTING_INCOMPLETE_REASON,
  MALFORMED_LIST_REASON,
  NO_ARTIFACT_REASON,
  REQUEST_FAILED_REASON,
  readFacts,
  statusReason,
} from "./facts.ts";
export type { FactsResult } from "./facts.ts";
export { PROJECTS_UNREADABLE_PHRASE, factsCard, listProjectCards, listReadableRepositories, permissionsRefusedLine } from "./projects.ts";
export type { Listing } from "./projects.ts";
export { SESSION_COOKIE, SESSION_MAX_MS, completeSignIn, openSession, sealPlaintext, sealSession, sessionCookie } from "./session.ts";
export type { Session } from "./session.ts";
export {
  NOTICE_COOKIE,
  OFFER_HTML,
  SESSION_ENDED_PHRASE,
  SIGN_IN_FAILED_PHRASE,
  STATE_COOKIE,
  constantTimeEqual,
  hashState,
  newState,
  offerPage,
  refusal,
  startSignIn,
  verifyCallback,
} from "./signin.ts";
export type { CodeExchange, GithubClient } from "./github.ts";
export {
  CONTENT_SECURITY_POLICY,
  FIXED_ERROR_PHRASE,
  errorPage,
  htmlPage,
  notFoundPage,
  redirectHome,
  redirectToAuthorize,
  safely,
  stylesheet,
  withCookies,
} from "./responses.ts";

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
