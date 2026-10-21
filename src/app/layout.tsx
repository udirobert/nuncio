import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Instrument_Serif } from "next/font/google";
import { PostHogProvider } from "./providers";
import { MotionProvider } from "@/components/motion-provider";
import { OnboardingModal } from "@/components/onboarding-modal";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // Opt into the full screen so env(safe-area-inset-*) is meaningful on
  // notched iPhones and iPads with a home indicator.
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "nuncio — your intelligent emissary",
  description:
    "Drop a name or any social URL. Your AI twin takes the first meeting — live, disclosed, on your playbook.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "nuncio — your intelligent emissary",
    description:
      "Drop a name or any social URL. Your AI twin takes the first meeting — live, disclosed, on your playbook.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "nuncio — your intelligent emissary",
    description:
      "Drop a name or any social URL. Your AI twin takes the first meeting — live, disclosed, on your playbook.",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink">
        <PostHogProvider>
          <MotionProvider>
            {children}
            {/* One tour for the whole app — so "Show tips" works from anywhere. */}
            <OnboardingModal />
          </MotionProvider>
        </PostHogProvider>
        <footer className="mt-auto px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center space-x-4">
          <Link
            href="/"
            className="text-label-base text-ink-faint hover:text-accent transition-colors inline-flex items-center min-h-[44px]"
          >
            nuncio
          </Link>
          <Link
            href="/examples"
            className="text-label-base text-ink-faint hover:text-accent transition-colors inline-flex items-center min-h-[44px]"
          >
            Examples
          </Link>
          <Link
            href="/pricing"
            className="text-label-base text-ink-faint hover:text-accent transition-colors inline-flex items-center min-h-[44px]"
          >
            Pricing
          </Link>
          <Link
            href="/privacy"
            className="text-label-base text-ink-faint hover:text-accent transition-colors inline-flex items-center min-h-[44px]"
          >
            Privacy
          </Link>
          <Link
            href="/support"
            className="text-label-base text-ink-faint hover:text-accent transition-colors inline-flex items-center min-h-[44px]"
          >
            Support
          </Link>
        </footer>
      </body>
    </html>
  );
}
