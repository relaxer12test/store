import { getRequiredConvexHttpUrl } from "@/lib/env";

function isLocalhostHost(hostname: string) {
	return hostname === "localhost" || hostname === "127.0.0.1";
}

function readHostname(value: string | null) {
	if (!value) {
		return null;
	}

	try {
		return new URL(value).hostname;
	} catch {
		return null;
	}
}

function getForwardedIp(request: Request) {
	const xForwardedFor = request.headers.get("x-forwarded-for");

	if (xForwardedFor) {
		return xForwardedFor;
	}

	const forwardedIp =
		request.headers.get("cf-connecting-ip") ??
		request.headers.get("x-real-ip") ??
		request.headers.get("fly-client-ip");

	if (forwardedIp) {
		return forwardedIp;
	}

	const requestUrl = new URL(request.url);
	const originHostname = readHostname(request.headers.get("origin"));
	const refererHostname = readHostname(request.headers.get("referer"));

	if (
		isLocalhostHost(requestUrl.hostname) ||
		(originHostname && isLocalhostHost(originHostname)) ||
		(refererHostname && isLocalhostHost(refererHostname))
	) {
		return "127.0.0.1";
	}

	return null;
}

export function buildConvexApiProxyUrl(
	request: Request | URL | string,
	options?: {
		baseUrl?: string;
	},
) {
	const requestUrl =
		typeof request === "string"
			? new URL(request)
			: request instanceof URL
				? request
				: new URL(request.url);

	return new URL(
		requestUrl.pathname + requestUrl.search,
		options?.baseUrl ?? getRequiredConvexHttpUrl(),
	).toString();
}

export async function proxyApiRequestToConvex(
	request: Request,
	options?: {
		baseUrl?: string;
		fetchImpl?: typeof fetch;
	},
) {
	const headers = new Headers(request.headers);
	const requestUrl = new URL(request.url);

	headers.delete("host");
	headers.set("accept-encoding", "identity");

	const forwardedIp = getForwardedIp(request);

	if (forwardedIp) {
		headers.set("x-forwarded-for", forwardedIp);
	}

	if (!headers.has("x-forwarded-host")) {
		headers.set("x-forwarded-host", requestUrl.host);
	}

	if (!headers.has("x-forwarded-proto")) {
		headers.set("x-forwarded-proto", requestUrl.protocol.replace(":", ""));
	}

	const init: RequestInit & {
		duplex?: "half";
	} = {
		headers,
		method: request.method,
		redirect: "manual",
	};

	if (request.method !== "GET" && request.method !== "HEAD") {
		init.body = request.body;
		init.duplex = "half";
	}

	return await (options?.fetchImpl ?? fetch)(buildConvexApiProxyUrl(request, options), init);
}
