# Design system ↔ Figma

How AIGS Online Education keeps **code tokens** and **Figma** aligned. Code is the source of truth for shipped UI; Figma mirrors the same names.

Related: [`app/globals.css`](../app/globals.css) · [`tailwind.config.ts`](../tailwind.config.ts) · [`components/public/`](../components/public/) · [`rules.md`](../rules.md) (Design tokens)

---

## Live Figma file

| | |
| --- | --- |
| File | [AIGS Design System](https://www.figma.com/design/BYMx1tH24u1qmXBDYJKraP) |
| File key | `BYMx1tH24u1qmXBDYJKraP` |
| Variables | Collection **AIGS Foundations** (21 colors: `aigs/*`, `brand/*`, `surface/*`, `border/*`, `text/*`, `accent/gold`) |
| Pages | **Foundations** (tokens + verify-page capture) · **Components** (`Brand/Logo`, `Button`, `Chrome/Header`, `Chrome/Footer`) |
| Verify capture | [Certificate verification frame](https://www.figma.com/design/BYMx1tH24u1qmXBDYJKraP?node-id=1-2) |

Re-capture localhost into the same file with Cursor Figma MCP (`generate_figma_design`) or the in-app capture toolbar (script already loaded from `app/layout.tsx`).

---

## Principles

1. **One palette** — Figma Variables must use the same names/values as CSS. No one-off hex in public frames.
2. **Semantic tokens for UI** — Prefer `--brand-primary`, `--surface`, `--text-primary` over raw `--aigs-*` in components.
3. **Components map 1:1** — Figma components should match React files under `components/public/` (and shared UI primitives where useful).
4. **No dump-and-ship** — Do not paste Figma-exported HTML wholesale. Implement with existing tokens and components.

---

## Token table (Figma Variables ↔ code)

### Brand scale (`--aigs-*` / Tailwind `brand.*`)

| Figma variable | CSS | Tailwind | Hex |
| --- | --- | --- | --- |
| `aigs/50` | `--aigs-50` | `brand-50` | `#fff5f3` |
| `aigs/100` | `--aigs-100` | `brand-100` | `#ffe3dd` |
| `aigs/200` | `--aigs-200` | `brand-200` | `#f5bcb3` |
| `aigs/300` | `--aigs-300` | `brand-300` | `#ed968b` |
| `aigs/400` | `--aigs-400` | `brand-400` | `#da7064` |
| `aigs/500` | `--aigs-500` | `brand-500` | `#be473c` |
| `aigs/600` | `--aigs-600` | `brand-600` | `#a01f23` |
| `aigs/700` | `--aigs-700` | `brand-700` | `#8a1b1e` |
| `aigs/800` | `--aigs-800` | `brand-800` | `#6f171a` |
| `aigs/900` | `--aigs-900` | `brand-900` | `#4a1214` |

### Semantic (public site)

| Figma variable | CSS | Typical use |
| --- | --- | --- |
| `brand/primary` | `--brand-primary` → `aigs/600` | Primary buttons, links |
| `brand/primary-hover` | `--brand-primary-hover` | Hover states |
| `brand/primary-muted` | `--brand-primary-muted` | Soft backgrounds |
| `brand/dark` | `--brand-dark` | Dark overlays / hero scrims (`#4a1214`) |
| `brand/chrome` | `--brand-chrome` | Public header + footer (`#980e10`) |
| `surface/default` | `--surface` | Page background (`#fffcf9`) |
| `surface/muted` | `--surface-muted` | Secondary panels (`#f5f1ec`) |
| `border/default` | `--border` | Dividers |
| `border/strong` | `--border-strong` | Emphasized borders |
| `text/primary` | `--text-primary` | Body / headings |
| `text/secondary` | `--text-secondary` | Muted copy |
| `accent/gold` | `--accent-gold` | Accent only (`#b8956c`) |

### Typography

| Figma style / variable | Code |
| --- | --- |
| `font/sans` | Source Sans 3 → `--font-aigs-sans` / `font-sans` |
| `font/display` | Source Serif 4 → `--font-aigs-display` / `font-display` |

### Spacing & radius

Prefer Tailwind’s default spacing scale (`4`, `6`, `8`, …). In Figma, use the same steps (4px base). Avoid arbitrary gaps that don’t exist in the codebase.

---

## Suggested Figma library structure

```
AIGS Design System (library file)
├── Foundations
│   ├── Color (Variables collections above)
│   ├── Typography
│   └── Spacing / Radius
├── Components
│   ├── Brand / Logo          → components/public/brand-logo.tsx
│   ├── Button / Primary      → components/public/public-button.tsx
│   ├── Button / Secondary
│   ├── Header                → components/public/header/public-header.tsx
│   ├── Footer                → components/public/footer/public-footer.tsx
│   └── …match other public primitives as they exist
└── Patterns
    ├── Auth layout
    ├── Course card
    └── Certificate verify (status + details)
```

Publish as a **Team library** and enable it in product files (marketing, LMS screens, certificates).

---

## Code Connect conventions

Use [Figma Code Connect](https://www.figma.com/developers/code-connect) (or Cursor Figma MCP: `get_code_connect_suggestions`, `add_code_connect_map`, `get_code_connect_map`) so designers and agents resolve Figma nodes to real files.

**Seat requirement:** Code Connect write APIs need a **Dev or Full** seat on an Organization/Enterprise plan. On View/Starter, keep the table below as the source of truth and apply mappings in Figma after upgrading.

### Naming (live file nodes)

| Figma component | Node | Code path | Export |
| --- | --- | --- | --- |
| `Brand/Logo` | [`3:4`](https://www.figma.com/design/BYMx1tH24u1qmXBDYJKraP?node-id=3-4) | `components/public/brand-logo.tsx` | `BrandLogo` |
| `Button` (`Variant=Primary\|Secondary\|Tertiary`) | [`3:14`](https://www.figma.com/design/BYMx1tH24u1qmXBDYJKraP?node-id=3-14) | `components/public/public-button.tsx` | `PublicLinkButton` |
| `Chrome/Header` | [`3:16`](https://www.figma.com/design/BYMx1tH24u1qmXBDYJKraP?node-id=3-16) | `components/public/header/public-header.tsx` | `PublicHeader` |
| `Chrome/Footer` | [`3:25`](https://www.figma.com/design/BYMx1tH24u1qmXBDYJKraP?node-id=3-25) | `components/public/footer/public-footer.tsx` | `PublicFooter` |

### Rules

- Map **components**, not every frame instance.
- Prefer `components/public/*` for marketing/public pages; portal/admin may use `components/ui/*`.
- Document variants in Figma that match props (`variant`, logo `variant`).
- After renaming a React file, update the Code Connect mapping in the same PR when possible.

### Cursor / MCP quick flow

1. Open the Figma component (or paste a Figma URL with `node-id`).
2. Ask Cursor to suggest Code Connect mappings for that node (needs Dev/Full seat).
3. Review paths against this doc, then apply mappings.
4. For design → code: use design context and implement with **existing tokens only**.
5. For code → Figma QA: run the app and capture a live URL into Figma (`generate_figma_design` / HTML-to-design capture). The app loads Figma’s capture script from `app/layout.tsx`.

---

## Day-to-day process

1. Designer updates screens using **Variables** + library components only.
2. Dev implements with `brand-*` / semantic CSS vars / `PublicLinkButton` etc.
3. Optional: push localhost (or staging) into Figma for visual QA.
4. PR check: no new raw hex on public pages; no new one-off Figma colors without updating this table + `globals.css`.

### Changing a token

1. Update hex in `app/globals.css` (and this table).
2. Update the matching Figma Variable.
3. Re-publish the Figma library.
4. No component churn if everything references Variables / CSS vars.

---

## Out of scope

- Auto-sync pipelines (Tokens Studio / Style Dictionary) — optional later if the team wants Figma-owned tokens.
- Regenerating the whole site from Figma HTML.
- Portal/admin dark themes — not defined yet; extend tokens when needed.
