import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { logoutAction } from "@/app/actions/auth";
import { getOptionalUser } from "@/lib/auth";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Barakify PWA",
  description: "Multi-user finance tracking PWA",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Barakify" }
};

export const viewport: Viewport = {
  themeColor: "#070b12"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getOptionalUser();

  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        <header className="topnav">
          <div className="topnav-inner">
            <Link href={user ? "/dashboard" : "/login"}>Barakify</Link>
            {user ? (
              <div className="row">
                <Link href="/settings/account" className="muted">
                  Account
                </Link>
                <form action={logoutAction}>
                  <button type="submit" className="button ghost">
                    Logout
                  </button>
                </form>
              </div>
            ) : (
              <div className="row">
                <Link href="/login" className="muted">
                  Login
                </Link>
                <Link href="/signup" className="muted">
                  Signup
                </Link>
              </div>
            )}
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
