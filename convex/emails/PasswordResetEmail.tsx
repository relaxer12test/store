import { Button, Heading, Link, Text } from "@react-email/components";
import { EmailLayout } from "./Layout";

interface PasswordResetEmailProps {
  brandName?: string;
  name?: string;
  resetUrl: string;
}

export default function PasswordResetEmail({
  brandName,
  name,
  resetUrl,
}: PasswordResetEmailProps) {
  const greeting = name?.trim() ? name.trim() : "there";

  return (
    <EmailLayout brandName={brandName} previewText="Reset your password">
      <Heading className="mt-4 mb-0 text-3xl font-bold leading-tight text-gray-900">
        Reset your password
      </Heading>

      <Text className="mt-5 mb-0 text-base leading-7 text-gray-600">
        Hi {greeting},
      </Text>

      <Text className="mt-4 mb-0 text-base leading-7 text-gray-600">
        We received a request to reset the password for your account. Click the
        button below to choose a new password.
      </Text>

      <Button
        href={resetUrl}
        className="mt-7 mb-0 inline-block rounded-full bg-gray-900 px-6 py-3.5 text-center text-base font-semibold text-white no-underline box-border"
      >
        Reset password
      </Button>

      <Text className="mt-6 mb-0 text-sm leading-6 text-gray-500">
        If the button doesn&apos;t work, copy and paste this link into your
        browser:
      </Text>
      <Link
        href={resetUrl}
        className="mt-1 mb-0 block text-sm leading-6 text-gray-900 break-all"
      >
        {resetUrl}
      </Link>

      <Text className="mt-7 mb-0 text-sm leading-6 text-gray-400">
        If you didn&apos;t request this, you can safely ignore this email. Your
        password will not be changed.
      </Text>
    </EmailLayout>
  );
}

PasswordResetEmail.PreviewProps = {
  brandName: "Unicorn",
  name: "Alex",
  resetUrl: "https://store.ldev.cloud/internal-reset-password?token=abc123",
} satisfies PasswordResetEmailProps;
