type AuthClientErrorLike = {
	code?: unknown;
	message?: unknown;
	status?: unknown;
	statusText?: unknown;
};

function readErrorText(value: unknown) {
	return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function getAuthClientErrorMessage(error: unknown, fallback: string) {
	if (!error || typeof error !== "object") {
		return fallback;
	}

	const authError = error as AuthClientErrorLike;

	const message = readErrorText(authError.message);

	if (message) {
		return message;
	}

	const statusText = readErrorText(authError.statusText);

	if (statusText) {
		return statusText;
	}

	const code = readErrorText(authError.code);

	if (code) {
		return code;
	}

	if (typeof authError.status === "number") {
		return `Request failed with status ${authError.status}.`;
	}

	return fallback;
}
