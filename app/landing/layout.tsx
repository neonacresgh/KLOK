import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KLOK",
  description: "Professional student management system with instant search and offline capabilities",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
