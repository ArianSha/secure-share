const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function localTunnelOrigin(request: Request): string | null {
	const host = request.headers.get("host");

	if (!host || request.headers.has("cf-connecting-ip")) return null;
	try {
		const url = new URL(request.url);
		const hostUrl = new URL(`http://${host}`);
		if (!loopbackHosts.has(hostUrl.hostname) || hostUrl.host !== host)
			return null;
		if (
			request.headers.get("x-forwarded-host") &&
			request.headers.get("x-forwarded-host") !== host
		)
			return null;
		const origin = request.headers.get("origin");
		if (origin && origin !== `${url.protocol}//${host}`) return null;
		const fetchSite = request.headers.get("sec-fetch-site");
		if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none")
			return null;
		if (request.method !== "GET" && !origin) return null;
		// The browser never supplies a target port or service URL in the request body.
		return `http://127.0.0.1:${hostUrl.port || "80"}`;
	} catch {
		return null;
	}
}
