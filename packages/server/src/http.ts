/** True when the browser reached us over HTTPS, directly or through a reverse proxy. */
export function isSecureRequest(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  return req.url.startsWith("https://");
}
