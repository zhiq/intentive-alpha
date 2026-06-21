import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Intentive — Tell us what you need",
  description:
    "AI-native intent-to-capacity marketplace. Messy intent in, reasoned offers out.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Intentive <span className="text-primary">alpha</span>
            </Link>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              <Link href="/intents" className="hover:text-foreground">
                My Requests
              </Link>
              <Link href="/inbox" className="hover:text-foreground">
                Offer Inbox
              </Link>
              <Link href="/provider" className="hover:text-foreground">
                Provider
              </Link>
              <Link href="/passport" className="hover:text-foreground">
                Passport
              </Link>
              <Link href="/admin" className="hover:text-foreground">
                Admin
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
