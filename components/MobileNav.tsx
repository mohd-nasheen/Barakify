"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";

const topLine = {
  closed: { rotate: 0, y: 0 },
  open: { rotate: 45, y: 6 },
};
const midLine = {
  closed: { opacity: 1 },
  open: { opacity: 0 },
};
const botLine = {
  closed: { rotate: 0, y: 0 },
  open: { rotate: -45, y: -6 },
};

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 767) setOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function handleExport() {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("open-export-modal"));
  }

  function handleLogout() {
    setOpen(false);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("open-logout-modal"));
    }, 200);
  }

  return (
    <>
      <button
        type="button"
        className="mobile-hamburger"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close menu" : "Open menu"}
      >
        <motion.span
          className="hamburger-line"
          variants={topLine}
          animate={open ? "open" : "closed"}
          transition={{ duration: 0.25, ease: "easeInOut" }}
        />
        <motion.span
          className="hamburger-line"
          variants={midLine}
          animate={open ? "open" : "closed"}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        />
        <motion.span
          className="hamburger-line"
          variants={botLine}
          animate={open ? "open" : "closed"}
          transition={{ duration: 0.25, ease: "easeInOut" }}
        />
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {open ? (
            <>
              <motion.div
                className="mobile-menu-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={() => setOpen(false)}
              />
              <motion.nav
                className="mobile-menu"
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <div className="mobile-menu-header">
                  <div className="mobile-menu-brand">
                    <div className="mobile-menu-brand-logo">
                      <img
                        src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
                        alt="Barakify"
                        width={32}
                        height={32}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                      <span className="mobile-menu-brand-name">BARAKIFY</span>
                    </div>
                    <p className="mobile-menu-tagline">Personal Finance Simplified</p>
                  </div>
                  <motion.button
                    type="button"
                    className="mobile-menu-close"
                    onClick={() => setOpen(false)}
                    aria-label="Close menu"
                    whileTap={{ scale: 0.92 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 4l10 10M14 4L4 14" />
                    </svg>
                  </motion.button>
                </div>

                <div className="mobile-menu-items">
                  <Link href="/dashboard" className="mobile-menu-item" onClick={() => setOpen(false)}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="7" height="7" rx="1.5"/>
                      <rect x="11" y="2" width="7" height="7" rx="1.5"/>
                      <rect x="2" y="11" width="7" height="7" rx="1.5"/>
                      <rect x="11" y="11" width="7" height="7" rx="1.5"/>
                    </svg>
                    Dashboard
                  </Link>
                  <button type="button" className="mobile-menu-item" onClick={handleExport}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 2v11m0 0l-4-4m4 4l4-4M3 17h14"/>
                    </svg>
                    Export PDF
                  </button>
                  <Link href="/settings/account" className="mobile-menu-item" onClick={() => setOpen(false)}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="10" cy="7" r="4"/>
                      <path d="M3 18c0-3.31 3.13-6 7-6s7 2.69 7 6"/>
                    </svg>
                    Account
                  </Link>
                </div>

                <div className="mobile-menu-footer">
                  <button type="button" className="mobile-menu-item mobile-menu-logout" onClick={handleLogout}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 10h9m0 0l-3-3m3 3l-3 3"/>
                      <path d="M12 4h3a2 2 0 012 2v8a2 2 0 01-2 2h-3"/>
                      <path d="M3 6V5a2 2 0 012-2h2"/>
                      <path d="M3 14v1a2 2 0 002 2h2"/>
                    </svg>
                    Logout
                  </button>
                </div>
              </motion.nav>
            </>
          ) : null}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
