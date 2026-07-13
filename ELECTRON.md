# Electron Local Runner

Thero Idle TD remains a browser-first static game. The Electron setup only wraps
the same HTML, JavaScript, and assets for local desktop testing.

## Install

```powershell
npm install
```

## Browser Version Locally

Use any static file server from the repository root, then open its local URL.
For example:

```powershell
python -m http.server 8080
```

Then open `http://127.0.0.1:8080/`.

## Electron Version

Build the static `dist/` folder and launch Electron:

```powershell
npm run desktop
```

To launch without rebuilding, run:

```powershell
npm run electron
```

You can also use the root batch files:

- `Rebuild and Run Thero Idle TD.bat`
- `Run Thero Idle TD.bat`

## GitHub Pages Build

GitHub Pages currently deploys the repository root as static content. This is
unchanged; `index.html`, `assets/`, and `scripts/` still use relative paths that
work under `https://sethrimer3.github.io/TheroMathTD/`.

## Troubleshooting

- Black screen: run `npm run build` before `npm run electron`, then confirm
  `dist/index.html`, `dist/assets/`, and `dist/scripts/` exist.
- Missing assets: check that new asset references are relative, such as
  `./assets/...` or `assets/...`, not absolute local Windows paths.
- Missing module scripts: confirm any new imports use relative module paths and
  that the imported files live under `assets/` or `scripts/`.
- Save issues: the game still uses browser storage APIs such as `localStorage`;
  Electron keeps those saves separate from normal browser saves for the local
  file origin.
