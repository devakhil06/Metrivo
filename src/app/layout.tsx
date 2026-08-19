import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "Metrivo — See the story inside your numbers",
  description: "Turn financial transactions into evidence-backed business decisions with Metrivo.",
  icons: {
    icon: "/metrivo-logo.png",
    apple: "/metrivo-logo.png",
  },
  openGraph: {
    title: "Metrivo — See the story inside your numbers",
    description: "Turn financial transactions into evidence-backed business decisions with Metrivo.",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "Metrivo financial intelligence dashboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Metrivo — See the story inside your numbers",
    description: "Turn financial transactions into evidence-backed business decisions with Metrivo.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
