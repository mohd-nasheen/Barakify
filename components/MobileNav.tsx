"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect } from "react";
import Link from "next/link";

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

      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              className="mobile-menu-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
            />
            <motion.nav
              className="mobile-menu"
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >
              <div className="mobile-menu-items">
                <Link href="/dashboard" className="mobile-menu-item" onClick={() => setOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="6" height="6" rx="1.5"/>
                    <rect x="10" y="2" width="6" height="6" rx="1.5"/>
                    <rect x="2" y="10" width="6" height="6" rx="1.5"/>
                    <rect x="10" y="10" width="6" height="6" rx="1.5"/>
                  </svg>
                  Dashboard
                </Link>
                <button type="button" className="mobile-menu-item" onClick={handleExport}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 2v10m0 0l-3.5-3.5M9 12l3.5-3.5M3 15h12"/>
                  </svg>
                  Export PDF
                </button>
                <Link href="/settings/account" className="mobile-menu-item" onClick={() => setOpen(false)}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="6" r="3.5"/>
                    <path d="M2.5 16c0-3.04 2.91-5.5 6.5-5.5s6.5 2.46 6.5 5.5"/>
                  </svg>
                  Account
                </Link>
                <button type="button" className="mobile-menu-item mobile-menu-logout" onClick={handleLogout}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6.5 9h8m0 0l-2.5-2.5M14.5 9l-2.5 2.5"/>
                    <path d="M11 3.5h2.5a1.5 1.5 0 011.5 1.5v8a1.5 1.5 0 01-1.5 1.5H11"/>
                    <path d="M3 5.5V5a1.5 1.5 0 011.5-1.5H6"/>
                    <path d="M3 12.5V13a1.5 1.5 0 001.5 1.5H6"/>
                  </svg>
                  Logout
                </button>
              </div>
            </motion.nav>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
