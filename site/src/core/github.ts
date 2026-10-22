// The one place the core sends a request, and the one function that decides whether it may (SPEC-0004 rule 8):
// GET, and exactly one POST, the code-for-token exchange of the sign-in, at its exact address. Everything else is
// refused before any request is made (fail closed). A refusal names the kind of check, never an address or a value.
export const API_HOST = "api.github.com";
export const TOKEN_ADDRESS = "https://github.com/login/oauth/access_token";
// The GitHub App's web-flow authorization address (verify: from memory of GitHub's documentation).
export const AUTHORIZE_ADDRESS = "https://github.com/login/oauth/authorize";
// GitHub refuses a request with no User-Agent, and Cloudflare Workers' fetch adds none (Node's does). The guard puts this
// fixed name on every request that goes to GitHub; it is a name, not a credential.
export const USER_AGENT = "agk-portal";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function isGithub(hostname: string): boolean {
  return hostname === "github.com" || hostname.endsWith(".github.com") || hostname === "githubusercontent.com" || hostname.endsWith(".githubusercontent.com");
}

function refuse(reason: string): never {
  throw new Error(`the request is not allowed (${reason})`);
}

export function guardedFetch(send: FetchLike): FetchLike {
  return async (input, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      return refuse("address");
    }
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return refuse("address");
    const carriesToken = new Headers(init?.headers).has("authorization");
    if (method === "GET") {
      if (carriesToken && url.hostname !== API_HOST) return refuse("credential");
      // A request that carries a credential must not follow redirects: a runtime may carry the Authorization header
      // to the redirect target, and the artifact download answers 302 to a storage host. The caller reads the
      // Location and fetches it without a credential.
      if (carriesToken && init?.redirect !== "manual") return refuse("redirect");
    } else if (method === "POST") {
      if (input !== TOKEN_ADDRESS || carriesToken) return refuse("method");
    } else {
      return refuse("method");
    }
    if (!isGithub(url.hostname)) return send(input, init);
    const headers = new Headers(init?.headers);
    headers.set("User-Agent", USER_AGENT);
    return send(input, { ...init, headers });
  };
}

export interface CodeExchange {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}

export function createGithubClient(dependencies: { fetch: FetchLike }) {
  const guarded = guardedFetch(dependencies.fetch);
  return {
    // A call to the GitHub API with the person's own token, in the Authorization header and nowhere else.
    get(path: string, token: string): Promise<Response> {
      if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return Promise.reject(notAllowed("address"));
      if (/access_token|[?&]token=/i.test(path) || (token !== "" && path.includes(token))) {
        return Promise.reject(notAllowed("credential"));
      }
      return guarded(`https://${API_HOST}${path}`, {
        method: "GET",
        redirect: "manual",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
    },
    // The redirect target of an artifact download: fetched without any credential.
    getSigned(url: string): Promise<Response> {
      return guarded(url, { method: "GET" });
    },
    // The one POST: the secret travels in the body, never in the address.
    exchangeCode(exchange: CodeExchange): Promise<Response> {
      const body = new URLSearchParams({
        client_id: exchange.clientId,
        client_secret: exchange.clientSecret,
        code: exchange.code,
        redirect_uri: exchange.redirectUri,
      }).toString();
      return guarded(TOKEN_ADDRESS, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    },
  };
}

export type GithubClient = ReturnType<typeof createGithubClient>;

function notAllowed(reason: string): Error {
  return new Error(`the request is not allowed (${reason})`);
}
