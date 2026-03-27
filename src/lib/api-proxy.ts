import { getRequiredConvexHttpUrl } from "@/lib/env";

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

	headers.delete("host");
	headers.set("accept-encoding", "identity");

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
