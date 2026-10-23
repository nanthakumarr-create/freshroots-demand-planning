import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Freshroots Demand Planning", template: "%s · Freshroots" },
  description: "Rules-based demand planning with planner approval and Zoho draft purchase orders.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
