# Scrolling Issue Fix Documentation

## Problem Statement

On Android mobile, users are unable to scroll up and down on any of the game's
tab pages. Scrolling only works when the user's finger contacts the very edges
of the screen where there are no page elements. Moving a finger over any
interactive element (button, card, text, etc.) does nothing—the panel does not
scroll.

---

## Investigation Summary

### Symptoms
| Behavior | Works? |
|---|---|
| Scroll by touching the panel padding / edges | ✅ Yes |
| Scroll by touching child elements (buttons, cards, text) | ❌ No |
| Desktop scrolling (mouse wheel / trackpad) | ✅ Yes |

### Root Cause Analysis

The scrolling failure on Android is caused by **multiple interacting factors**,
not a single bug. Each factor alone might not block scrolling, but together they
create a cascade that prevents the browser's compositor from recognizing a
vertical scroll gesture when the touch originates on a child element.

#### Factor 1 – `dragScroll.js` captures touch pointers

`assets/dragScroll.js` attaches **capture-phase** pointer event listeners to
containers like `.field-notes-page` and `.upgrade-matrix-grid`. When a touch
starts inside these containers, the handler:

1. Calls `element.setPointerCapture(event.pointerId)` — which redirects **all**
   subsequent pointer events to that element, preventing the browser from
   recognizing the gesture as a native scroll.
2. Calls `event.preventDefault()` inside `handlePointerMove` — which explicitly
   tells the browser not to perform its default scroll action.

This completely blocks native touch scrolling on any element inside a drag-scroll
container.

#### Factor 2 – CSS `.panel * { touch-action: pan-y }` specificity conflicts

The wildcard rule `.panel * { touch-action: pan-y; }` (styles.css line 1089) was
added to propagate touch-action to all children for Android Chrome
compatibility. However this rule has **specificity (0,1,0)** — the same as any
single-class selector. Later rules like `.tower-loadout-item { touch-action: none; }`
override it silently, and the sheer breadth of the wildcard creates subtle
specificity wars across the stylesheet.

More importantly, explicitly setting `touch-action: pan-y` on every child tells
the browser to **only** handle vertical pan natively and forward all other
gestures to JavaScript via pointer events. This makes the compositor thread
dependent on the main thread's event processing, introducing the very coupling
that causes scroll jank and failures on Android.

#### Factor 3 – Non-passive document-level pointer handlers

`assets/cardinalWardenUI.js` registers three document-level pointer event
listeners **without the `{ passive: true }` flag**:

```js
document.addEventListener('pointerdown', handleGlobalPointerDown);
document.addEventListener('pointermove', handleGlobalPointerMove);
document.addEventListener('pointerup', handleGlobalPointerUp);
```

On Android Chrome, non-passive listeners force the compositor to wait for the
main thread before deciding whether to scroll. Even though these handlers never
call `preventDefault()`, the browser cannot know that ahead of time.

#### Factor 4 – Carousel `touchmove` calls `preventDefault()`

The cardinal warden carousel in `cardinalWardenUI.js` attaches a `touchmove`
listener that unconditionally calls `e.preventDefault()`. While this only
affects the carousel track element, it blocks scroll for any touch that starts
on or passes through the carousel.

#### Factor 5 – Android-specific panel fixes only apply to two panels

The high-specificity scroll fixes at styles.css lines 11226-11256 only target
`#panel-towers` and `#panel-options`. The remaining eight panels lack these
overrides, leaving their children vulnerable to specificity conflicts from the
wildcard rule.

---

## Fix Attempts

### Attempt 1 — Current Codebase (pre-fix)

**Approach:** Added `.panel * { touch-action: pan-y; }` wildcard rule plus
targeted `#panel-towers` / `#panel-options` overrides.

**Result:** ❌ Scrolling still broken on Android for all panels.

**Analysis:** The wildcard rule has too-low specificity and the per-panel
overrides only cover two of ten panels. JavaScript event handlers (`dragScroll`,
global pointer listeners) continue to interfere with touch gesture detection.

### Attempt 2 — Multi-factor fix (this PR)

**Approach:** Address all five root-cause factors simultaneously:

1. **`dragScroll.js` — skip touch pointers.** Added an early return in
   `handlePointerDown` when `event.pointerType === 'touch'`. Native touch
   scroll now handles all touch interactions; only mouse pointers use the
   custom drag-scroll mechanism. Removed `setPointerCapture` and
   `preventDefault` for touch gestures.

2. **CSS — remove `.panel *` wildcard, use targeted rules.** Replaced the
   overly broad `.panel * { touch-action: pan-y; }` with a scoped rule on
   `.panel` itself using `touch-action: pan-y`. Children now default to
   `touch-action: auto`, and the effective touch-action (intersection of parent
   and child values) is `pan-y` — which correctly allows vertical scroll. A new
   universal panel rule applies the Android-specific overrides to all panels.

3. **Passive document-level handlers.** Added `{ passive: true }` to the three
   `document.addEventListener` calls in `cardinalWardenUI.js`.

4. **Carousel `touchmove` made passive-safe.** The carousel `touchmove` handler
   now uses `{ passive: true }` and performs the scroll positioning without
   calling `preventDefault()`.

5. **Android panel fixes extended to all panels.** The `overscroll-behavior-y`,
   `-webkit-overflow-scrolling`, and `touch-action` overrides previously limited
   to `#panel-towers` and `#panel-options` now apply to every `.panel` element.

**Result:** Pending testing on Android device.

---

## Agent Instructions for Future Debugging

If the scrolling issue resurfaces or the above fix is insufficient, follow this
checklist:

### 1. Verify CSS `touch-action` chain

Open Chrome DevTools on the Android device (or via `chrome://inspect`). Select
the problem element and check:

- The element's **computed** `touch-action` value.
- Every ancestor's computed `touch-action` up to the `.panel` scroll container.
- The **effective touch-action** is the *intersection* of all these values. If
  any ancestor is `none`, the effective value is `none` and scroll is blocked.

### 2. Check for `setPointerCapture` calls

Search the codebase for `setPointerCapture`. Any call on a touch pointer inside
a `.panel` will hijack all subsequent pointer events and prevent the browser
from recognizing a scroll gesture. Ensure all `setPointerCapture` calls either:
- Are gated behind `event.pointerType !== 'touch'`, or
- Only apply to elements with `touch-action: none` (canvases, maps).

### 3. Check for `preventDefault()` on touch/pointer events

Search for `preventDefault` in all JS files. Any call inside a `touchstart`,
`touchmove`, `pointerdown`, or `pointermove` handler can block scroll. Ensure:
- `touchstart` / `pointerdown` handlers **never** call `preventDefault()` for
  touch pointers inside panels.
- `touchmove` / `pointermove` handlers only call `preventDefault()` on elements
  with `touch-action: none`.

### 4. Verify event listener passivity

Non-passive `touchstart` and `touchmove` listeners force the compositor to
wait for the main thread. Run this in the console to list non-passive touch
listeners:

```js
// Chrome-only: check EventListenerOptions
getEventListeners(document).touchstart?.filter(l => !l.passive);
getEventListeners(document).touchmove?.filter(l => !l.passive);
```

### 5. Use the built-in element debugger

The Towers tab includes a "Scroll-Blocking Element Debugger" (hidden inside a
`<details>` block). Uncheck elements one at a time to isolate which element
prevents scrolling. If scrolling resumes after hiding an element, that element's
CSS or JS is the culprit.

### 6. Test with touch-action: auto on children

As a diagnostic step, add this rule temporarily:

```css
.panel * { touch-action: auto !important; }
```

If scrolling works with this rule, the issue is a specificity conflict somewhere
in the stylesheet overriding `pan-y` with `none`.

### 7. Android-specific quirks

- Android Chrome computes effective `touch-action` per-element. Unlike iOS
  Safari, it does **not** inherit `touch-action` from ancestors.
- `overscroll-behavior-y: contain` prevents scroll chaining to the viewport.
- `-webkit-overflow-scrolling: touch` enables momentum scrolling on older
  WebKit-based Android browsers.

---

## Files Modified

| File | Change |
|---|---|
| `assets/dragScroll.js` | Skip touch pointers in `handlePointerDown` |
| `assets/styles.css` | Remove `.panel *` wildcard; extend Android fixes to all panels |
| `assets/cardinalWardenUI.js` | Passive global pointer handlers; passive carousel touchmove |
| `docs/SCROLLING_ISSUE_FIX_DOCUMENTATION.md` | This document |
