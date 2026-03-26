import { Resend } from "@convex-dev/resend";
import { components } from "@convex/_generated/api";
import type { ActionCtx } from "@convex/_generated/server";

const DEFAULT_FROM_NAME = "StoreAI";
const RESEND_LOG_PREFIX = "[internal-auth]";

type EmailMutationCtx = Pick<ActionCtx, "runMutation">;

export const resend = new Resend(components.resend, {
	testMode: false,
});

export async function sendPasswordResetEmail(
	ctx: EmailMutationCtx,
	args: {
		email: string;
		name?: string | null;
		resetUrl: string;
	},
) {
	const { email, name, resetUrl } = args;

	if (!hasResendApiKey()) {
		console.warn(
			`${RESEND_LOG_PREFIX} RESEND_API_KEY is not configured; falling back to console log.`,
		);
		console.log(`${RESEND_LOG_PREFIX} Password reset for ${email}: ${resetUrl}`);
		return;
	}

	const { html, subject, text } = buildPasswordResetEmail({
		name,
		resetUrl,
	});

	await resend.sendEmail(ctx, {
		from: getResendFromAddress(),
		html,
		subject,
		text,
		to: email,
	});
}

function buildPasswordResetEmail(args: { name?: string | null; resetUrl: string }) {
	const greetingName = args.name?.trim() || "there";
	const escapedGreetingName = escapeHtml(greetingName);
	const escapedResetUrl = escapeHtml(args.resetUrl);
	const subject = "Reset your StoreAI password";
	const intro = "We received a request to reset the password for your StoreAI admin account.";
	const outro = "If you did not request this, you can ignore this email.";
	const text = [
		`Hi ${greetingName},`,
		"",
		intro,
		"",
		`Reset your password: ${args.resetUrl}`,
		"",
		outro,
	].join("\n");
	const html = `
		<div style="background:#f8fafc;padding:32px 16px;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
			<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:40px 32px;">
				<p style="margin:0;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;font-weight:700;color:#64748b;">
					StoreAI
				</p>
				<h1 style="margin:16px 0 0;font-size:30px;line-height:1.15;font-weight:700;color:#020617;">
					Reset your password
				</h1>
				<p style="margin:20px 0 0;font-size:16px;line-height:1.7;color:#334155;">
					Hi ${escapedGreetingName},
				</p>
				<p style="margin:16px 0 0;font-size:16px;line-height:1.7;color:#334155;">
					${intro}
				</p>
				<p style="margin:28px 0 0;">
					<a
						href="${escapedResetUrl}"
						style="display:inline-block;border-radius:999px;background:#0f172a;color:#ffffff;padding:14px 22px;text-decoration:none;font-weight:600;"
					>
						Reset password
					</a>
				</p>
				<p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#475569;">
					If the button does not work, copy and paste this link into your browser:
				</p>
				<p style="margin:12px 0 0;font-size:14px;line-height:1.7;word-break:break-word;">
					<a href="${escapedResetUrl}" style="color:#0f172a;">${escapedResetUrl}</a>
				</p>
				<p style="margin:28px 0 0;font-size:14px;line-height:1.7;color:#64748b;">
					${outro}
				</p>
			</div>
		</div>
	`.trim();

	return {
		html,
		subject,
		text,
	};
}

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function getResendFromAddress() {
	const fromName = getOptionalEnv("RESEND_FROM_NAME") ?? DEFAULT_FROM_NAME;
	const fromEmail = getOptionalEnv("RESEND_FROM_EMAIL");

	if (!fromEmail) {
		throw new Error("RESEND_FROM_EMAIL must be configured.");
	}

	return `${fromName} <${fromEmail}>`;
}

function hasResendApiKey() {
	return Boolean(getOptionalEnv("RESEND_API_KEY"));
}

function getOptionalEnv(name: string) {
	return getProcessEnv(name)?.trim() || undefined;
}

function getProcessEnv(name: string) {
	return (
		globalThis as typeof globalThis & {
			process?: {
				env?: Record<string, string | undefined>;
			};
		}
	).process?.env?.[name];
}
