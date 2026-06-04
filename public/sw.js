// Bump this on every deploy (or let CI do it).
const CACHE_VERSION = 2;
const CACHE_NAME = `barakify-v${CACHE_VERSION}`;

// Only pre-cache the app shell — lightweight, rarely changes.
const SHELL_ASSETS = ["/manifest.webmanifest"];

// ── Install ─────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  // Activate immediately — don't wait for old tabs to close.
  self.skipWaiting();
});

// ── Activate ────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all open tabs immediately.
  self.clients.claim();
});

// ── Fetch ───────────────────────────────────────────────────────────────────

function isNavigationRequest(request) {
  return request.mode === "navigate";
}

function isBuildAsset(url) {
  // Next.js build chunks, CSS, and static assets
  return url.pathname.startsWith("/_next/");
}

function isStaticAsset(url) {
  return /\.(png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|eot)$/i.test(url.pathname);
}

function shouldSkipCache(url) {
  // Never cache Supabase, API, or auth requests
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.hostname.includes("supabase")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache API / Supabase / auth calls.
  if (shouldSkipCache(url)) return;

  // Network-first for navigation and build assets (JS/CSS).
  // This prevents stale chunks from being served after a deploy.
  if (isNavigationRequest(request) || isBuildAsset(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a clone for offline fallback.
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Cache-first for static assets (images, fonts, manifest).
  if (isStaticAsset(url) || SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
    return;
  }

  // Everything else: network only, no caching.
});
