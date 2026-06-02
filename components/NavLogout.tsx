"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";

export function NavLogout() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  return (
    <>
      <button
        type="button"
        className="nav-action-btn"
        onClick={() => setOpen(true)}
      >
        Logout
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="logout-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => { if (e.target === e.currentTarget && !pending) setOpen(false); }}
          >
            <motion.div
              className="logout-card"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
            >
              <div className="logout-icon-wrap">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M8 11h8m0 0l-3-3m3 3l-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 4h3a2 2 0 012 2v10a2 2 0 01-2 2h-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M4 7v-1a2 2 0 012-2h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M4 15v1a2 2 0 002 2h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </div>

              <h3 className="logout-title">Log out?</h3>
              <p className="logout-desc">You will need to sign in again to access your financial data.</p>

              <div className="logout-actions">
                <motion.button
                  type="button"
                  className="logout-cancel-btn"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="button"
                  className="logout-confirm-btn"
                  onClick={confirm}
                  disabled={pending}
                  whileHover={pending ? {} : { scale: 1.02, y: -1, boxShadow: "0 8px 24px rgba(239,68,68,0.35)" }}
                  whileTap={pending ? {} : { scale: 0.97 }}
                >
                  {pending ? (
                    <span className="logout-loading">
                      <span className="logout-spinner" />
                      Logging out...
                    </span>
                  ) : (
                    "Logout"
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
