# Deployment and Viewing Changes

## Live Site

The game is automatically deployed to GitHub Pages at:
**https://sethrimer3.github.io/Thero_Idle_TD/**

## Deployment Process

1. **Make changes** in a feature branch
2. **Create a Pull Request** to merge into `main`
3. **Merge the PR** - GitHub Pages automatically deploys
4. **Wait 1-3 minutes** for GitHub Pages to rebuild
5. **Clear browser cache** to see changes

## Common Issue: Not Seeing Changes After Deployment

If you've merged changes to `main` but don't see them on the live site, the issue is almost always **browser caching**.

### Quick Fix: Hard Refresh

- **Windows/Linux:** Press `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac:** Press `Cmd + Shift + R`

### If Hard Refresh Doesn't Work

#### Option 1: Clear Site Data (Chrome/Edge/Brave)
1. Open DevTools: Press `F12`
2. Right-click the refresh button (while DevTools is open)
3. Select **"Empty Cache and Hard Reload"**

#### Option 2: Clear Cache via DevTools
1. Open DevTools: Press `F12`
2. Go to **Application** tab
3. Click **"Clear storage"** in the left sidebar
4. Check all boxes (especially "Cache storage" and "Local storage")
5. Click **"Clear site data"**
6. Refresh the page

#### Option 3: Force Cache Bypass with URL Parameter
Add a timestamp query parameter to force fresh downloads:
```
https://sethrimer3.github.io/Thero_Idle_TD/?v=YYYYMMDD
```
Replace `YYYYMMDD` with today's date (e.g., `20251104`) and change it each time to bust the cache.

### Verify Changes Loaded

1. Open browser console: Press `F12` → **Console** tab
2. Check Network tab to see file timestamps
3. Look for any JavaScript errors that might prevent loading

## Why Browser Caching Happens

Browsers cache static assets (JS, CSS, images) aggressively to improve performance. Since this is a vanilla JS/HTML/CSS project with no build step or cache-busting hashes in filenames, browsers will keep using cached versions until you explicitly clear them.

## Development Workflow

For local development:
1. Run a local web server (see `SERVER-local_host_readme.txt`)
2. Make changes to files
3. Refresh browser (no build step needed)
4. If changes don't appear, use hard refresh

## Deployment Architecture

- **Platform:** GitHub Pages
- **Source Branch:** `main`
- **Build Process:** None (static site)
- **Deploy Time:** 1-3 minutes after merge
- **CDN:** GitHub's CDN (automatic)

## Troubleshooting

### Changes still not visible after cache clear?

1. **Check GitHub Pages status:**
   - Go to repository Settings → Pages
   - Verify it shows "Your site is live at..."
   - Check the last deployment timestamp

2. **Check if PR actually merged:**
   - Go to the PR page
   - Verify it shows "Merged" with a purple badge
   - Check the commit is in the `main` branch

3. **Check for JavaScript errors:**
   - Open browser console (F12)
   - Look for red error messages
   - These might prevent new code from running

4. **Try a different browser:**
   - Use incognito/private mode
   - Or try a completely different browser

5. **Check specific files updated:**
   - Open Network tab in DevTools
   - Filter for the changed files
   - Check their timestamps and content

## Cache-Busting Strategy (Future)

If this becomes a frequent issue, consider:
- Adding version query params to script tags: `<script src="main.js?v=1.2.3">`
- Using a build tool to add content hashes to filenames
- Setting shorter cache headers (requires server configuration)

Currently, the project intentionally avoids build complexity for simplicity.
