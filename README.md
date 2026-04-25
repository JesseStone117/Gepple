# Gepple

Gepple is a browser-first couch co-op prototype inspired by Peggle.

## What is in the prototype

- Randomly generated peg boards every round
- Two-player turn-based couch co-op flow
- Gamepad detection with clear controller cards
- A menu button to swap which controller belongs to which player
- Three playable characters with different green-peg powers
- Synthesized sound effects plus looping gameplay soundtrack files
- A moving bonus bucket, score tracking, and a round winner screen
- Manifest-driven auto updates while the game is open

## How to run it

This is a static site. Open it through any simple web server so browser gamepad support works reliably.

Examples:

- `python -m http.server 8080`
- `npx serve .`

Then open the served page in a browser.

## Updating a running game

Gepple checks `manifest.json` while it is open. When you ship a change, bump the manifest `version`.
Open clients will notice the new version, clear old Gepple-managed caches, and reload through cache-busted assets.

## Controls

- `Left stick / D-pad`: aim and move menu focus
- `A / Space / Enter`: confirm and launch
- `X / Right Bumper / Left Shift`: use the charged character ability
- `Y / Tab`: swap controller assignments in the menu

## File layout

- `index.html`: app shell and UI markup
- `styles.css`: couch-friendly presentation layer
- `src/characters.js`: character roster and ability metadata
- `src/randomMap.js`: random board generation
- `src/controllerManager.js`: gamepad and keyboard input handling
- `src/audioManager.js`: lightweight synthesized sound effects
- `src/game.js`: physics, scoring, turns, rendering, and abilities
- `src/main.js`: UI wiring and app boot
- `src/updateManager.js`: manifest loading, cache-busting, and auto-update checks
- `manifest.json`: current app version and load order
