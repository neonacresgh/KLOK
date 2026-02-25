import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard - KLOK Student Management",
  description: "Complete student management dashboard with CRUD operations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
