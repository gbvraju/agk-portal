// Cookies for the sign-in (SPEC-0002 rules 2 and 5): every cookie of the portal is `__Host-` prefixed, so it must be
// Secure, Path=/ and have no Domain; all are HttpOnly and SameSite=Lax. Values are restricted to base64url.
const VALUE = /^[A-Za-z0-9_-]*$/;

export function serializeCookie(name: string, value: string, maxAgeSeconds: number): string {
  if (!name.startsWith("__Host-") || !VALUE.test(value)) throw new Error("the cookie is not allowed");
  return `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; Secure; HttpOnly; SameSite=Lax`;
}

export function clearCookie(name: string): string {
  return serializeCookie(name, "", 0);
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (header === null) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return undefined;
}
