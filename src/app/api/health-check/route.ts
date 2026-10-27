import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const TIMEOUT_MS = 5000;

// This endpoint fetches a caller-supplied URL, so it must never reach internal addresses (SSRF).
function isPrivateAddress(ip: string) {
  if (ip.includes(":")) {
    const v6 = ip.toLowerCase();
    if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
    return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

const fail = (status: number) => Response.json({ ok: false, status, latencyMs: 0 }, { status: status === 400 ? 400 : 200 });

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  let target: URL;
  try {
    target = new URL(raw ?? "");
  } catch {
    return fail(400);
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") return fail(400);

  try {
    const host = target.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) return fail(400);
  } catch {
    return Response.json({ ok: false, status: 0, latencyMs: 0 });
  }

  const started = performance.now();
  try {
    const res = await fetch(target, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    void res.body?.cancel();
    const latencyMs = Math.round(performance.now() - started);
    // Redirects (3xx) still mean the app is answering.
    return Response.json({ ok: res.status < 400, status: res.status, latencyMs });
  } catch {
    return Response.json({ ok: false, status: 0, latencyMs: Math.round(performance.now() - started) });
  }
}
