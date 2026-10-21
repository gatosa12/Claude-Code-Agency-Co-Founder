# Tempo — Pomodoro Focus Timer

A single-file, dependency-free Pomodoro timer with a task list. Everything lives in `index.html`.

## Run / deploy

- **Locally:** open `index.html` in a browser.
- **Hosting:** upload `index.html` to any static host (GitHub Pages, Netlify, Vercel, S3). No build step.

Desktop notifications need the page served over `https://` or `localhost`; everything else also works from `file://`.

## Features

- Focus / Short Break / Long Break modes with an animated progress ring
- Auto-start breaks (and optionally focus), long break every N sessions
- Custom durations, daily goal, sound volume — in Settings
- Web Audio chime + desktop notifications on session end
- Task list: add, complete, delete, double-click to edit, set **Current Focus** (focus sessions are credited to it)
- Daily session counter and focused-minutes total, reset each day
- Light / dark mode (follows the OS until toggled)
- Keyboard: `Space` start/pause · `R` reset · `N` skip · `1` `2` `3` modes · `T` theme

## Data

All data is stored in the browser's `localStorage` under keys prefixed `tempo:`. Nothing is sent anywhere, and the app holds no API keys or secrets.

To rename the app, change `APP_NAME` in the script and the `<title>`.
