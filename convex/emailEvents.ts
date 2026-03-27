import { vEmailId, vOnEmailEventArgs } from "@convex-dev/resend";
import { internalMutation } from "@convex/_generated/server";
import { resend } from "@convex/mail";
import { v } from "convex/values";

const LOG_PREFIX = "[email]";

export const handleResendEvent = internalMutation({
	args: vOnEmailEventArgs,
	handler: async (ctx, args) => {
		const email = await resend.get(ctx, args.id);
		const logPayload = {
			emailId: args.id,
			errorMessage: email?.errorMessage ?? null,
			eventType: args.event.type,
			resendId: email?.resendId ?? null,
			status: email?.status ?? null,
		};

		if (
			args.event.type === "email.failed" ||
			args.event.type === "email.bounced" ||
			args.event.type === "email.complained"
		) {
			console.error(`${LOG_PREFIX} resend event`, logPayload);
			return;
		}

		if (args.event.type === "email.delivery_delayed") {
			console.warn(`${LOG_PREFIX} resend event`, logPayload);
			return;
		}

		console.info(`${LOG_PREFIX} resend event`, logPayload);
	},
});

export const logQueuedEmailStatus = internalMutation({
	args: {
		emailId: vEmailId,
		emailKind: v.string(),
	},
	handler: async (ctx, args) => {
		const status = await resend.status(ctx, args.emailId);

		if (!status) {
			console.warn(`${LOG_PREFIX} queued email status missing`, {
				emailId: args.emailId,
				emailKind: args.emailKind,
			});
			return;
		}

		const logPayload = {
			emailId: args.emailId,
			emailKind: args.emailKind,
			errorMessage: status.errorMessage ?? null,
			failed: status.failed,
			status: status.status,
		};

		if (status.failed || status.status === "failed" || status.status === "bounced") {
			console.error(`${LOG_PREFIX} queued email status`, logPayload);
			return;
		}

		if (status.status === "waiting" || status.status === "queued") {
			console.warn(`${LOG_PREFIX} queued email still pending`, logPayload);
			return;
		}

		console.info(`${LOG_PREFIX} queued email status`, logPayload);
	},
});
