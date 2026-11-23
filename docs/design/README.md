# Design language

`DESIGN.md` in this folder is the design reference for the app. It is a third-party, open-source description of a Vercel-inspired design language: black ink on a near-white canvas, thin hairline borders, the Geist typeface and very light shadows.

- **Source:** the `awesome-design-md` collection, https://github.com/VoltAgent/awesome-design-md (MIT licence), file `design-md/vercel/DESIGN.md`, copied unchanged on 24 Nov 2026.
- **Status:** it is an independent interpretation, as the file itself says. This project is not affiliated with Vercel.

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
| Link blue `#0070f3`, error `#ee0000`, warning `#f5a623` | Links, validation errors, the "below peers" flag |

## What is deliberately not used
- **The mesh gradient.** The file says it belongs at hero scale only and must never be shrunk. This app has no hero section, so it does not appear.
- **Pill-shaped buttons.** The file reserves the 100px pill for marketing pages and the 6px radius for in-app controls, and says not to mix them on one screen. This is an in-app surface, so it uses 6px throughout.
- **Marketing components** such as pricing cards, logo strips and showcase bands.
