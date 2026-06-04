"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        // Check for updates every 60 seconds
        const interval = setInterval(() => reg.update().catch(() => {}), 60_000);

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            // New SW installed and waiting (or already activated via skipWaiting)
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        });

        return () => clearInterval(interval);
      })
      .catch(() => undefined);

    // When the new SW calls clients.claim(), this fires.
    // Reload to pick up the fresh assets.
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  }, []);

  return (
    <AnimatePresence>
      {updateReady ? (
        <motion.div
          className="sw-toast"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
        >
          New version available. Refreshing...
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
