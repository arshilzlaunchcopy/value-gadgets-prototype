import type { Metadata } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import { DemoBanner } from "@/components/demo/demo-banner";
import { DemoLauncher } from "@/components/demo/demo-launcher";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Bengali face is declared but NOT preloaded (PART2 §16.2): the browser fetches it
// only when Bangla glyphs are actually rendered, so English pages pay nothing.
const notoBengali = Noto_Sans_Bengali({
  variable: "--font-noto-bengali",
  subsets: ["bengali"],
  weight: ["400", "600"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Store",
  description: "Tech accessories, delivered across Bangladesh.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${notoBengali.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <DemoBanner />
        {children}
        <DemoLauncher />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
