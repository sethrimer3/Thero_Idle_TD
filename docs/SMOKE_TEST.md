# Smoke Test

Run `npm test` to execute `scripts/smoke-test.cjs`.

The smoke test is intentionally lightweight and does not launch the browser, Electron, or canvas rendering. It verifies that the static entry files exist, `index.html` still loads `./assets/main.js` as a module, startup assets referenced by the shell page exist, and selected entry modules only use local static import paths that resolve on disk.

Use it as a fast guardrail before cleanup work. It does not replace browser/mobile playtesting for gameplay, visuals, saves, or input behavior.
