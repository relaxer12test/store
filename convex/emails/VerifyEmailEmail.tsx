import { Button, Heading, Link, Text } from "@react-email/components";
import { EmailLayout } from "./Layout";

interface VerifyEmailEmailProps {
	brandName?: string;
	name?: string;
	verificationUrl: string;
}

export default function VerifyEmailEmail({
	brandName,
	name,
	verificationUrl,
}: VerifyEmailEmailProps) {
	const greeting = name?.trim() ? name.trim() : "there";

	return (
		<EmailLayout brandName={brandName} previewText="Verify your email address">
			<Heading className="mt-4 mb-0 text-3xl font-bold leading-tight text-gray-900">
				Verify your email
			</Heading>

			<Text className="mt-5 mb-0 text-base leading-7 text-gray-600">Hi {greeting},</Text>

			<Text className="mt-4 mb-0 text-base leading-7 text-gray-600">
				Please confirm your email address by clicking the button below. This helps us keep your
				account secure.
			</Text>

			<Button
				href={verificationUrl}
				className="mt-7 mb-0 inline-block rounded-full bg-gray-900 px-6 py-3.5 text-center text-base font-semibold text-white no-underline box-border"
			>
				Verify email address
			</Button>

			<Text className="mt-6 mb-0 text-sm leading-6 text-gray-500">
				If the button doesn&apos;t work, copy and paste this link into your browser:
			</Text>
			<Link
				href={verificationUrl}
				className="mt-1 mb-0 block text-sm leading-6 text-gray-900 break-all"
			>
				{verificationUrl}
			</Link>

			<Text className="mt-7 mb-0 text-sm leading-6 text-gray-400">
				If you didn&apos;t create an account, you can safely ignore this email.
			</Text>
		</EmailLayout>
	);
}

VerifyEmailEmail.PreviewProps = {
	brandName: "Unicorn",
	name: "Alex",
	verificationUrl: "https://store.ldev.cloud/verify-email?token=abc123",
} satisfies VerifyEmailEmailProps;
