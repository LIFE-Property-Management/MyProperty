import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { Providers } from "@/components/Providers";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MyProperty — Property Management",
  description: "Track leases, collect rent, and manage your real estate portfolio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-[#275D2C] focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:outline-none focus:shadow-lg"
        >
          Skip to main content
        </a>
        <WebVitalsReporter />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
