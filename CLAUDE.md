# Barakify PWA — Claude Code Instructions

## DO NOT scan the codebase at session start

Memory files contain the complete architecture, file map, CSS structure, and recent work history.
Read memory files FIRST (`file_map.md` has every component, class name, and JSX structure).
Only read specific source files when you need to make edits to them.

## Project

Personal finance PWA. Next.js App Router + Supabase + Framer Motion. Premium fintech aesthetic.

## Key files

- `app/globals.css` — ALL styling (~1830 lines, plain CSS with variables, no Tailwind)
- `components/dashboard-client.tsx` — Main dashboard (~1030 lines, client component)
- `app/layout.tsx` — Root layout with navbar (server component)
- `components/MobileNav.tsx` — Hamburger menu (Framer Motion animated)
- `components/ExportModal.tsx` — PDF export drawer/bottom-sheet
- `components/parity-ui.tsx` — GlassCard, AnimatedCurrency, ProgressRing
- `lib/month-engine.ts` — Clone month logic (server)
- `lib/pdf-engine.ts` — Browser-side PDF generation (jsPDF)

## Rules

- Use CSS variables (--bg, --surface, --text, --accent, etc.) for all colors. NEVER hardcode.
- Both `[data-theme="dark"]` and `[data-theme="light"]` must be styled for any new UI.
- Server components by default. Add "use client" only when needed.
- Framer Motion for all animations.
- Responsive breakpoints: desktop >=1024, tablet 768-1023, mobile <=767.
- Touch targets minimum 44px on mobile.
- No horizontal overflow on mobile.

## Responsive architecture

- Desktop nav: `.nav-desktop-items` (Account, Export, Theme, Logout)
- Mobile nav: `.nav-mobile-items` (Theme toggle + hamburger menu)
- Mobile FAB replaces inline add buttons (`.add-inline` hidden on mobile)
- Export modal: right drawer on desktop, bottom sheet on mobile
- Custom events: `open-export-modal`, `open-logout-modal`
