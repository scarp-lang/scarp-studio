# Browser Settings smoke checks

Run `npm ci`, `npm run build`, then `npm run test:settings-browser` with Node 22 or newer. The harness launches an installed Chromium-based browser with a disposable user profile and serves the built application on a random loopback port. Use SCARP_BROWSER_EXECUTABLE to select an installed browser explicitly. No browser package or downloaded driver is required.

The checks exercise the real React Settings controls, search reveal and focus, appearance persistence, keybinding labels, strict import rejection, reviewed import and undo, named configurations, history and reload behavior. Native Tauri dialogs, filesystem authorization, compiler execution and operating-system keyboard delivery are not covered by this browser test. Continue using Windows native acceptance cases for those features.

The extended suite adds shortcut transfer and undo, fixed-key protection, snippet editing and merge conflicts, selective preference reset and command-palette snippet insertion and editor undo. On the exact November 26 PR #106 head `0d31750eef007093956b2cf3fb51fdceac4c0937`, all 15 checks passed in [Windows CI 45844126179](https://github.com/scarp-lang/scarp-studio/actions/runs/45844126179). Subsequent commits require their own checks.
