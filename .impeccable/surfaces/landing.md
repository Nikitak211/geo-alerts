---
version: 1
slug: "landing"
primary_target: "landing.html"
related_targets: ["src/components/PlatformLanding", "src/lib/platformLanding"]
---

# Surface: mt-at.net public landing

## Mode

**Persuade** — ungated marketing introduction for gym owners / trainers.

## Audience & job

Gym owners and coaches evaluating MTAT on phone or laptop. They must understand “your gym gets `{slug}.mt-at.net`” and act: Subscribe, Try free, or Account.

## Primary actions

1. **Subscribe** (primary pill) → Stripe Checkout via `/api/platform/billing/checkout`
2. **Try free** → `free.mt-at.net` sandbox
3. **Account** → `/login.html` (platform identity)

## Visual world (Impeccable new-work — B)

Distinct **marketing** world — light canvas, high-contrast ink type, **one** saturated accent for CTAs (shared brand lime `#c6f25a` / accent-ink `#10140a`). Not Liquid Glass dock/stage chrome. No purple-on-white template cliché; no fake testimonials/metrics.

### Locked tokens

| Token | Value |
|-------|--------|
| `--landing-bg` | `#f7f7f4` |
| `--landing-ink` | `#121214` |
| `--landing-muted` | `#5c5c62` |
| `--landing-accent` | `#c6f25a` |
| `--landing-accent-ink` | `#10140a` |
| `--landing-line` | `rgba(18,18,20,0.12)` |
| `--landing-radius-pill` | `999px` |
| `--landing-radius-panel` | `22px` |
| Type | Heebo / IBM Plex Sans / system-ui |

### Comps

- Desktop: `.impeccable/mocks/landing-desktop-comp.webp` (+ `.json`)
- Mobile: `.impeccable/mocks/landing-mobile-comp.webp` (+ `.json`)

## Layout

- Desktop ≥1024: horizontal nav (Logo · Try free · Account · Subscribe); hero dual CTAs; large media panel
- Mobile ≤640: logo + hamburger; Subscribe always visible; single column; ≥44px targets
- Sections: Hero → How it works (3 steps) → Who it’s for → Footer (ToS / privacy / language)

## Anti-goals

- Login wall on apex
- Gym dock / tray chrome
- Blog mega-nav
- Invented pricing or social proof

## Adapt notes (phase 12) — shipped

- Tablet: desktop nav until 768px, then hamburger + sticky Subscribe bar
- RTL: `dir` from locale; logical borders on who-list
- Touch: 44px min targets on nav/CTAs/slug field
- Motion: no decorative loops (static hero panel gradient only)
- A11y: focus-visible rings on links/buttons; subscribe errors via `role="alert"`
- Mobile menu overlays the hero (`position: absolute` under sticky header + light scrim); it does not push page content
- Phone ≤640: hero CTAs and slug form stack full-width so Subscribe is not clipped off the inline-end edge
