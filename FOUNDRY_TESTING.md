# Foundry Production Menu Testing Guide

## Prerequisites
1. Start the game and navigate to the Bet Spire (fluid terrarium)
2. Ensure you have unlocked the sun (costs 10,000 Scintillae)
3. Ensure you have at least 500 Scintillae to purchase the foundry

## Initial Setup
When the sun is unlocked, you automatically receive 1,000 sun resource to start with.

## Testing the Foundry Placement

1. **Open the Terrarium Store**
   - Click the "Store" button in the terrarium controls
   - Scroll down to find the "Foundry" item (⚒️)
   - Cost: 500 Scintillae

2. **Place the Foundry**
   - Click on the foundry item to select it
   - Click on a valid terrain location in the terrarium
   - The foundry should appear as a clickable ⚒️ icon
   - **Valid placement**: On solid ground (not underground or in water)
   - **Invalid placement**: Too high, too low, or on non-walkable terrain

## Testing the Production Menu

1. **Open Production Menu**
   - Click on the placed foundry icon (⚒️)
   - A menu should appear with:
     - Title showing "Foundry I" (Roman numeral for level 1)
     - Sun balance display
     - 5 buttons in a cross pattern:
       - **Top**: Upgrade to II (500 sun)
       - **Left**: Structures I (200 sun)
       - **Right**: Starlings I (200 sun)
       - **Bottom**: Solar Mirror (300 sun)
       - **Center**: Foundry icon (non-clickable)

2. **Test Upgrade Gating**
   - At Foundry Level I:
     - ✅ Can upgrade foundry to Level II
     - ✅ Can upgrade structures to tier 1
     - ✅ Can upgrade starlings to tier 1
     - ❌ Structure tier 2 should be locked
     - ❌ Starling tier 2 should be locked
   
   - At Foundry Level II:
     - ✅ Can upgrade foundry to Level III
     - ✅ Structure tier 2 should unlock
     - ✅ Starling tier 2 should unlock
     - ❌ Structure tier 3 should be locked
     - ❌ Starling tier 3 should be locked
   
   - At Foundry Level III:
     - ❌ Foundry upgrade button should say "Foundry Max Level"
     - ✅ Structure tier 3 should unlock
     - ✅ Starling tier 3 should unlock

3. **Test Individual Upgrades**

   ### Foundry Upgrade
   - Cost: 500 sun (I → II), 1000 sun (II → III)
   - Click "Upgrade to II" button
   - Sun should deduct
   - Title should change to "Foundry II"
   - Buttons should update to show new tier availability

   ### Structure Upgrade
   - Cost: 200 sun (tier 1), 400 sun (tier 2), 800 sun (tier 3)
   - Click "Structures I" button
   - Sun should deduct
   - Button should show "Structures II" after upgrade
   - Once at max tier for foundry level, button should be disabled

   ### Starling Upgrade
   - Cost: 200 sun (tier 1), 400 sun (tier 2), 800 sun (tier 3)
   - Click "Starlings I" button
   - Sun should deduct
   - Button should show "Starlings II" after upgrade
   - **Note**: Starling sprites should change (feature not fully implemented yet)
   - Once at max tier for foundry level, button should be disabled

   ### Solar Mirror Creation
   - Cost: 300 sun (unlimited)
   - Click "Solar Mirror (300 sun)" button
   - Sun should deduct
   - Can create multiple mirrors

4. **Test Insufficient Funds**
   - Try to upgrade when you don't have enough sun
   - Button should be disabled
   - No action should occur on click

## Developer Console Commands

Open the browser console (F12) and use these commands for testing:

```javascript
// Add 1000 sun
window.foundryTest.addSun(1000);

// Check current sun balance
window.foundryTest.getSunBalance();

// View all foundry states
window.foundryTest.getFoundryState();
```

## Expected Visual Behavior

1. **Menu Appearance**
   - Dark overlay behind menu
   - Centered modal dialog
   - Gradient backgrounds on buttons (different colors for each position)
   - Smooth hover effects on buttons
   - Disabled buttons appear faded

2. **Button States**
   - **Enabled**: Bright, hoverable, shows cost in parentheses
   - **Disabled**: Faded (40% opacity), not clickable
   - **Max Level**: Shows level with Roman numeral, disabled

3. **Roman Numerals**
   - Level 1 = I
   - Level 2 = II
   - Level 3 = III

## Known Limitations

1. **Starling Sprites**: The sprite changing system is implemented but starling visual changes are not yet wired to the bird rendering system.

2. **Solar Mirror**: Creates the item but doesn't have gameplay effect yet (placeholder for future mechanics).

3. **Persistence**: Foundry state persists across page reloads via the powderState system.

4. **Multiple Foundries**: Players can place multiple foundries, each with independent state.

## Bug Reporting

If you encounter issues, please report:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser console errors (F12 → Console tab)
- Screenshot if applicable
