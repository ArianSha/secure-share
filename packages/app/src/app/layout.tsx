import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SharingSessionProvider } from "@/contex/sharing-session";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Secure Share — Your sharing workspace",
  description: "A simple workspace for sharing raw text and files.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-screen flex-col">
        <SharingSessionProvider>{children}</SharingSessionProvider>
      </body>
    </html>
  );
}
