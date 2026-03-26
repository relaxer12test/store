import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "@react-email/components";
import type { ReactNode } from "react";

interface EmailLayoutProps {
  brandName?: string;
  children: ReactNode;
  previewText: string;
}

const DEFAULT_BRAND_NAME = "StoreAI";

export function EmailLayout({
  brandName = DEFAULT_BRAND_NAME,
  children,
  previewText,
}: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                brand: {
                  DEFAULT: "#0f172a",
                  muted: "#64748b",
                },
              },
            },
          },
        }}
      >
        <Head />
        <Preview>{previewText}</Preview>
        <Body className="bg-gray-100 font-sans py-10">
          <Container className="mx-auto max-w-xl bg-white border border-solid border-gray-200 rounded-3xl px-8 py-10">
            <Text className="m-0 text-xs font-bold uppercase tracking-widest text-brand-muted">
              {brandName}
            </Text>

            {children}

            <Hr className="border-solid border-gray-200 my-7" />

            <Text className="m-0 text-sm leading-6 text-brand-muted">
              &copy; {new Date().getFullYear()} {brandName}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
