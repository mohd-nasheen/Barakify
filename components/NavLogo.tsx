"use client";

import { useTheme } from "@/components/ThemeProvider";

export function NavLogo() {
  const { theme } = useTheme();

  return (
    <span className="nav-logo-wrap">
      {/* Use /logo-dark.png and /logo-light.png in public/ — see README or place your brand files there */}
      <img
        src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
        alt="Barakify"
        width={30}
        height={30}
        className="nav-logo-img"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
      <span className="nav-logo-text">BARAKIFY</span>
    </span>
  );
}
