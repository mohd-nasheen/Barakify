import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getOptionalUser } from "@/lib/auth";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NavThemeToggle } from "@/components/NavThemeToggle";
import { NavLogo } from "@/components/NavLogo";
import { NavExportButton } from "@/components/NavExportButton";
import { NavLogout } from "@/components/NavLogout";
import { MobileNav } from "@/components/MobileNav";

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
    <html lang="en" data-theme="dark">
      <head>
        {/* Prevent flash of wrong theme before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}`
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <ServiceWorkerRegister />
          <header className="topnav">
            <div className={`topnav-inner ${user ? "" : "solo"}`.trim()}>
              <Link href={user ? "/dashboard" : "/login"} className="nav-logo-link">
                <NavLogo />
              </Link>
              {user ? (
                <>
                  <div className="row nav-desktop-items">
                    <Link href="/settings/account" className="muted nav-account-link">
                      Account
                    </Link>
                    <NavExportButton />
                    <NavThemeToggle />
                    <NavLogout />
                  </div>
                  <div className="nav-mobile-items">
                    <NavThemeToggle />
                    <MobileNav />
                  </div>
                </>
              ) : (
                <NavThemeToggle />
              )}
            </div>
          </header>
          <main className="container">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
