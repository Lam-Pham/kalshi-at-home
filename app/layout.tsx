import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { InlineScript } from "@/components/inline-script";
import { ThemeToggle } from "@/components/theme-toggle";

// Runs before paint so the right theme is on <html> immediately — no flash of
// the wrong mode on load. Mirrors the logic in <ThemeToggle>.
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||((t==='system'||!t)&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "kalshi-friends · make the bet",
    template: "%s · kalshi-friends",
  },
  description:
    "Create a friendly one-off bet on live Kalshi odds, share one link, and track the IOU through the official result.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <InlineScript html={themeScript} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
