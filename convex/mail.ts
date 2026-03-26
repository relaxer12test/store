import { Resend } from "@convex-dev/resend";
import { components } from "@convex/_generated/api";

const DEFAULT_FROM_NAME = "StoreAI";

export const resend = new Resend(components.resend, {
  testMode: false,
});

export function getResendFromAddress() {
  const fromName = getResendFromName();
  const fromEmail = getOptionalEnv("RESEND_FROM_EMAIL");

  if (!fromEmail) {
    throw new Error("RESEND_FROM_EMAIL must be configured.");
  }

  return `${fromName} <${fromEmail}>`;
}

export function getResendFromName() {
  return getOptionalEnv("RESEND_FROM_NAME") ?? DEFAULT_FROM_NAME;
}

export function hasResendApiKey() {
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
