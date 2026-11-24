# Design language

`DESIGN.md` in this folder is the design reference for the app. It is a third-party, open-source description of a Vercel-inspired design language: black ink on a near-white canvas, thin hairline borders, the Geist typeface and very light shadows.

- **Source:** the `awesome-design-md` collection, https://github.com/VoltAgent/awesome-design-md (MIT licence), file `design-md/vercel/DESIGN.md`, copied unchanged on 24 Nov 2026.
- **Status:** it is an independent interpretation, as the file itself says. This project is not affiliated with Vercel. The file is kept exactly as received, so it is exempt from this repository's writing rule about dashes and semicolons.

## How it is applied
The app keeps MUI as its component library. The design is applied in one place, `web/src/theme.ts`, which turns the tokens in `DESIGN.md` into an MUI theme. Every screen picks it up from there.

| From DESIGN.md | In this app |
|---|---|
| Ink `#171717` as the single primary colour | Primary buttons, headings, body text, the share bars |
| Canvas soft `#fafafa` page, white cards, hairline `#ebebeb` | Page background, panels, table rows, inputs |
| Geist for text, Geist Mono for technical labels | All text. Table headings and small labels are mono capitals |
| 6px radius for in-app controls, 8px cards, 12px dialogs | Buttons and inputs, panels, dialogs |
| Display weight 600 with negative letter spacing, never capitals | Page and section headings. Buttons are no longer in capitals |
| Stacked soft shadows with a hairline ring, never one heavy shadow | Dialogs and dropdown menus. Panels are flat with a hairline |
| Link blue, error red, warning amber | Links, validation errors, the "below peers" flag. The deeper variants from the same file are used for text (see below) |

## What is deliberately not used
- **The mesh gradient.** The file says it belongs at hero scale only and must never be shrunk. This app has no hero section, so it does not appear.
- **Pill-shaped buttons.** The file reserves the 100px pill for marketing pages and the 6px radius for in-app controls, and says not to mix them on one screen. This is an in-app surface, so it uses 6px throughout.
- **Marketing components** such as pricing cards, logo strips and showcase bands.

## Where the reference was strengthened for accessibility
The look is the reference's. Only values that fail WCAG AA contrast were changed, and each is checked by `web/src/theme.test.ts`. The reasoning is in decision D-025.

| Reference value | Used instead | Why |
|---|---|---|
| Muted text `#888888` (3.5 to 1 on white) | `#666666` (5.7 to 1) | Small text needs 4.5 to 1 |
| Link blue `#0070f3` (4.4 to 1 on the page) | The reference's `link-deep` `#0761d1` (5.5 to 1) | Same |
| Error red `#ee0000` (4.3 to 1 on the page) | The reference's `error-deep` `#c50000` (6.0 to 1) | Same |
| Input border `#ebebeb` (1.2 to 1) | `#8a8a8a` (3.4 to 1) | The edge of a control needs 3 to 1 |
| Focus shown only by a colour change | A 2px ink ring on whatever has keyboard focus | A colour change alone is easy to miss |
| Fixed pixel text sizes | rem, so the browser's font size setting is respected | Text must scale |

