"use node";

import type { EmailId } from "@convex-dev/resend";
import { internal } from "@convex/_generated/api";
import type { ActionCtx } from "@convex/_generated/server";
import { internalAction } from "@convex/_generated/server";
import PasswordResetEmail from "@convex/emails/PasswordResetEmail";
import VerifyEmailEmail from "@convex/emails/VerifyEmailEmail";
import {
	getResendFromAddress,
	getResendFromName,
	hasResendApiKey,
	hasResendFromEmail,
} from "@convex/mail";
import { resendWithEvents } from "@convex/observedMail";
import { render } from "@react-email/components";
import { v } from "convex/values";

const LOG_PREFIX = "[email]";
const EMAIL_STATUS_LOG_DELAY_MS = 30_000;

type EmailMarkupFactory = () => Parameters<typeof render>[0];
type QueuedEmailArgs = {
	email: string;
	emailKind: "password_reset" | "verification";
	name?: string;
	markup: EmailMarkupFactory;
	subject: string;
};

function maskEmailAddress(email: string) {
	const [localPart = "", domain = ""] = email.split("@");

	if (!localPart || !domain) {
		return "[invalid-email]";
	}

	const visibleLocalPart =
		localPart.length <= 2 ? `${localPart[0] ?? "*"}*` : `${localPart.slice(0, 2)}***`;

	return `${visibleLocalPart}@${domain}`;
}

function serializeError(error: unknown) {
	if (error instanceof Error) {
		return {
			message: error.message,
			name: error.name,
			stack: error.stack,
		};
	}

	return {
		message: String(error),
	};
}

async function queueObservedEmail(ctx: ActionCtx, args: QueuedEmailArgs) {
	const config = {
		hasResendApiKey: hasResendApiKey(),
		hasResendFromEmail: hasResendFromEmail(),
		resendFromName: getResendFromName(),
	};
	const logContext = {
		email: maskEmailAddress(args.email),
		emailKind: args.emailKind,
		hasName: Boolean(args.name),
		...config,
	};

	console.info(`${LOG_PREFIX} preparing transactional email`, logContext);

	if (!config.hasResendApiKey || !config.hasResendFromEmail) {
		console.error(`${LOG_PREFIX} resend delivery is not fully configured`, logContext);
		return;
	}

	try {
		const [html, text] = await Promise.all([
			render(args.markup()),
			render(args.markup(), { plainText: true }),
		]);
		const emailId = await resendWithEvents.sendEmail(ctx, {
			from: getResendFromAddress(),
			html,
			subject: args.subject,
			text,
			to: args.email,
		});

		console.info(`${LOG_PREFIX} transactional email queued`, {
			...logContext,
			emailId,
		});

		await scheduleEmailStatusLog(ctx, {
			emailId,
			emailKind: args.emailKind,
		});
	} catch (error) {
		console.error(`${LOG_PREFIX} transactional email failed`, {
			...logContext,
			error: serializeError(error),
		});
		throw error;
	}
}

async function scheduleEmailStatusLog(
	ctx: ActionCtx,
	args: {
		emailId: EmailId;
		emailKind: QueuedEmailArgs["emailKind"];
	},
) {
	await ctx.scheduler.runAfter(
		EMAIL_STATUS_LOG_DELAY_MS,
		internal.emailEvents.logQueuedEmailStatus,
		args,
	);
}

export const sendPasswordReset = internalAction({
	args: {
		email: v.string(),
		name: v.optional(v.string()),
		resetUrl: v.string(),
	},
	handler: async (ctx, args) => {
		const brandName = getResendFromName();
		await queueObservedEmail(ctx, {
			email: args.email,
			emailKind: "password_reset",
			markup: () =>
				PasswordResetEmail({
					brandName,
					name: args.name ?? undefined,
					resetUrl: args.resetUrl,
				}),
			name: args.name ?? undefined,
			subject: `Reset your ${brandName} password`,
		});
	},
});

export const sendVerificationEmail = internalAction({
	args: {
		email: v.string(),
		name: v.optional(v.string()),
		verificationUrl: v.string(),
	},
	handler: async (ctx, args) => {
		const brandName = getResendFromName();
		await queueObservedEmail(ctx, {
			email: args.email,
			emailKind: "verification",
			markup: () =>
				VerifyEmailEmail({
					brandName,
					name: args.name ?? undefined,
					verificationUrl: args.verificationUrl,
				}),
			name: args.name ?? undefined,
			subject: `Verify your ${brandName} email`,
		});
	},
});
