import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Telemetry from "@/components/Telemetry";
import { site } from "@/content/site";
import { themeScript } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const title = `${site.name} | ${site.headline}`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title,
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description: site.description,
    url: "/",
    siteName: site.name,
    locale: "en_US",
    type: "profile",
    firstName: "Carls Dale",
    lastName: "Escalo",
  },
  twitter: { card: "summary_large_image", title, description: site.description, creator: "@daleonigiri" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <Telemetry />
      </body>
    </html>
  );
}
