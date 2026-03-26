"use node";

import { render } from "@react-email/components";
import { v } from "convex/values";
import { internalAction } from "@convex/_generated/server";
import PasswordResetEmail from "@convex/emails/PasswordResetEmail";
import VerifyEmailEmail from "@convex/emails/VerifyEmailEmail";
import {
  getResendFromAddress,
  getResendFromName,
  hasResendApiKey,
  resend,
} from "@convex/mail";

const LOG_PREFIX = "[email]";

export const sendPasswordReset = internalAction({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    resetUrl: v.string(),
  },
  handler: async (ctx, args) => {
    if (!hasResendApiKey()) {
      console.warn(
        `${LOG_PREFIX} RESEND_API_KEY not configured; falling back to console log.`,
      );
      console.log(
        `${LOG_PREFIX} Password reset for ${args.email}: ${args.resetUrl}`,
      );
      return;
    }

    const brandName = getResendFromName();
    const html = await render(
      PasswordResetEmail({
        brandName,
        name: args.name ?? undefined,
        resetUrl: args.resetUrl,
      }),
    );
    const text = await render(
      PasswordResetEmail({
        brandName,
        name: args.name ?? undefined,
        resetUrl: args.resetUrl,
      }),
      { plainText: true },
    );

    await resend.sendEmail(ctx, {
      from: getResendFromAddress(),
      html,
      subject: `Reset your ${brandName} password`,
      text,
      to: args.email,
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
    if (!hasResendApiKey()) {
      console.warn(
        `${LOG_PREFIX} RESEND_API_KEY not configured; falling back to console log.`,
      );
      console.log(
        `${LOG_PREFIX} Email verification for ${args.email}: ${args.verificationUrl}`,
      );
      return;
    }

    const brandName = getResendFromName();
    const html = await render(
      VerifyEmailEmail({
        brandName,
        name: args.name ?? undefined,
        verificationUrl: args.verificationUrl,
      }),
    );
    const text = await render(
      VerifyEmailEmail({
        brandName,
        name: args.name ?? undefined,
        verificationUrl: args.verificationUrl,
      }),
      { plainText: true },
    );

    await resend.sendEmail(ctx, {
      from: getResendFromAddress(),
      html,
      subject: `Verify your ${brandName} email`,
      text,
      to: args.email,
    });
  },
});
