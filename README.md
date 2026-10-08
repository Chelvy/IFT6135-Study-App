# IFT6135 — Representation Learning Study App

An interactive single-page web app for studying the IFT6135 Representation Learning final exam. Pure HTML / CSS / JavaScript — no backend.

## Sections

- **True / False** — 110 questions
- **Multiple Choice** — 25 questions
- **Math Formulation** — 29 questions
- **Contextual / Situational** — 24 questions

All questions are drawn from the IFT6135 past final exams (2015, 2017, 2018, 2019, 2022, 2023, 2024, 2025).

## Features

- Per-question navigation (Prev / Check / Next) with instant feedback
- Scorecard per section
- Dashboard showing progress across all sections
- Progress persisted in `localStorage`
- LaTeX rendering via MathJax
- Reset per section or reset all

## Run locally

Because the app loads JSON via `fetch`, it needs an HTTP server (not `file://`):

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy on GitHub Pages

Push to `main`, then in **Settings → Pages** select `main` as the source. The app will be served at `https://<user>.github.io/IFT6135-Study-App/`.
