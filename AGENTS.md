# Repository Guidelines

## Project Structure & Module Organization

This dependency-free Node.js application serves a wordless slide deck, presenter console, and live Jev camera demo.

- `server.mjs`: HTTP server, session authorization, synchronized state, and model proxy.
- `lib/`: server-side cost tracking and request controls.
- `public/`: browser modules, HTML, CSS, and bundled assets. `deck.js` maps slides; `app.js` implements presentation controls.
- `scripts/sync-talk.mjs`: generates `public/talk-content.js` from the talk in `README.md`.
- `test/`: automated tests. `SETUP.md` documents operation; asset attribution lives in `public/assets/CREDITS.md`.

Edit speaker notes in `README.md`, then regenerate talk content rather than editing the generated file directly.

## Build, Test, and Development Commands

Use Node.js 22 or newer; no dependency installation or build step is required.

- `cp .env.example .env`: create local configuration; set `TYPESAFE_API_KEY` for live inference.
- `npm run dev`: sync talk content and start the server with watch mode.
- `npm start`: sync talk content and run without watch mode.
- `npm run sync-talk`: regenerate speaker notes manually.
- `npm run check`: syntax-check `server.mjs`, `public/app.js`, and `public/deck.js`.
- `npm test`: run `test/*.test.mjs` using Node's built-in test runner.

## Coding Style & Naming Conventions

Use ES modules, `.mjs` for Node modules and tests, and `.js` for browser modules. Follow nearby code: two-space indentation, single-quoted strings, semicolons, camelCase functions and variables, and descriptive kebab-case filenames. No formatter or linter is configured; keep changes consistent with the surrounding code.

## Testing Guidelines

Use `node:test` and `node:assert/strict`, with descriptive behavior-based test names in `test/<feature>.test.mjs`. Mock model responses through the server's injectable `requestModel`; tests should incur no API charges. Cover changed behavior and relevant error paths. No numeric coverage threshold is configured. Run syntax checks and tests before submitting; manually verify both presenter and audience views for UI changes.

## Commit & Pull Request Guidelines

Git history is unavailable in this checkout, so no existing commit convention could be verified. Use concise, imperative subjects, such as `Fix camera retry cooldown`. Describe the change, its purpose, validation, and related issues in pull requests. Include screenshots for visible UI changes.

## Security & Configuration

Keep `.env`, API keys, and presenter control links private. Keep credentials server-side and camera frames out of saved artifacts. Use key-free rehearsal mode for routine UI work.
