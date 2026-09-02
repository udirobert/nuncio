import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Instrument_Serif } from "next/font/google";
import { PostHogProvider } from "./providers";
import { MotionProvider } from "@/components/motion-provider";
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
          </MotionProvider>
        </PostHogProvider>
        <footer className="mt-auto px-6 py-6 text-center">
          <a
            href="/studio"
            className="text-label-base text-ink-faint hover:text-accent transition-colors"
          >
            nuncio
          </a>
        </footer>
      </body>
    </html>
  );
}
