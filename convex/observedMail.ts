import { Resend } from "@convex-dev/resend";
import { components, internal } from "@convex/_generated/api";

export const resendWithEvents: Resend = new Resend(components.resend, {
	onEmailEvent: internal.emailEvents.handleResendEvent,
	testMode: false,
});
