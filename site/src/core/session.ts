// The stateless session (SPEC-0002 rules 4 to 8): one cookie, `__Host-session`, that holds the user token and its
// expiry and nothing else, encrypted and authenticated with AES-256-GCM through Web Crypto (a random 96-bit nonce
// for each cookie; the authentication tag is the signature) under a key derived from the one session key that the
// maintainers set. No database, no key-value store, no host storage: any instance that has the key reads any cookie.
import { base64urlDecode, base64urlEncode } from "./encoding.ts";
import { serializeCookie } from "./cookies.ts";
import type { GithubClient } from "./github.ts";
import { redirectHome } from "./responses.ts";
import { refusal, tokenError } from "./signin.ts";
import type { Core } from "./index.ts";

export const SESSION_COOKIE = "__Host-session";
export const SESSION_MAX_MS = 8 * 3_600_000;

const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const MIN_KEY_LENGTH = 32;
const text = new TextEncoder();
const AAD = text.encode("agk-portal-session-v1");
const INFO = text.encode("agk-portal-session-key-v1");

export interface Session {
  token: string;
  expiresAt: number;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  // A refusal names the setting, never its value (principle 8).
  if (secret.length < MIN_KEY_LENGTH) throw new Error("the setting SESSION_KEY is too short");
  const base = await crypto.subtle.importKey("raw", text.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: text.encode("agk-portal"), info: INFO },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function sealSession(session: Session, secret: string): Promise<string> {
  return sealPlaintext(JSON.stringify({ t: session.token, e: session.expiresAt }), secret);
}

// Seals any text under the key. The session is sealed through sealSession; tests use this to show that a cookie with
// a plaintext of another shape is refused on opening.
export async function sealPlaintext(content: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const plaintext = text.encode(content);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: AAD }, key, plaintext));
  const out = new Uint8Array(nonce.length + sealed.length);
  out.set(nonce, 0);
  out.set(sealed, nonce.length);
  return base64urlEncode(out);
}

// Anything that is not a cookie this key made, unexpired, with exactly the two fields, is nothing (rule 8).
export async function openSession(value: string, secret: string, now: number): Promise<Session | undefined> {
  const key = await deriveKey(secret);
  const bytes = base64urlDecode(value);
  if (bytes === undefined || bytes.length < NONCE_BYTES + TAG_BYTES + 2) return undefined;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, NONCE_BYTES), additionalData: AAD },
      key,
      bytes.slice(NONCE_BYTES),
    );
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(plain));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
    const fields = Object.keys(parsed).sort();
    const { t, e } = parsed as { t?: unknown; e?: unknown };
    if (fields.join() !== "e,t" || typeof t !== "string" || t === "" || typeof e !== "number" || !Number.isFinite(e)) return undefined;
    return e > now ? { token: t, expiresAt: e } : undefined;
  } catch {
    return undefined;
  }
}

export async function sessionCookie(session: Session, secret: string, now: number): Promise<string> {
  const seconds = Math.max(1, Math.ceil((session.expiresAt - now) / 1000));
  return serializeCookie(SESSION_COOKIE, await sealSession(session, secret), seconds);
}

function parseToken(answer: unknown): { token: string; expiresInSeconds?: number } | undefined {
  if (typeof answer !== "object" || answer === null) return undefined;
  const { access_token: token, expires_in: expires, error } = answer as Record<string, unknown>;
  if (error !== undefined || typeof token !== "string" || token === "") return undefined;
  // A refresh token in the answer is never read, never stored and never put in the cookie (rule 4).
  return typeof expires === "number" && Number.isFinite(expires) && expires > 0 ? { token, expiresInSeconds: expires } : { token };
}

// The code-for-token exchange and the session (SPEC-0002 rules 4 to 6). The lifetime is the smaller of 8 hours and
// the token's own expiry; with no expiry in the answer it is 8 hours. Any failure is the refusal of the sign-in.
export async function completeSignIn(core: Core, github: GithubClient, code: string): Promise<Response> {
  const { clientId, clientSecret, callbackUrl, sessionKey } = core.settings;
  const noToken = refusal({ kind: "token", error: "unknown" });
  let response: Response;
  try {
    response = await github.exchangeCode({ clientId, clientSecret, code, redirectUri: callbackUrl });
  } catch {
    return noToken;
  }
  if (!response.ok) return refusal({ kind: "exchange", status: response.status });
  let answer: unknown;
  try {
    answer = await response.json();
  } catch {
    return noToken;
  }
  const parsed = parseToken(answer);
  if (parsed === undefined) return refusal({ kind: "token", error: tokenError(answer) });
  const now = core.now();
  const limit = now + SESSION_MAX_MS;
  const expiresAt = parsed.expiresInSeconds === undefined ? limit : Math.min(limit, now + parsed.expiresInSeconds * 1000);
  return redirectHome([await sessionCookie({ token: parsed.token, expiresAt }, sessionKey, now)]);
}
