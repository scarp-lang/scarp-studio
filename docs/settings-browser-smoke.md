# Browser Settings smoke checks

Run `npm ci`, `npm run build`, then `npm run test:settings-browser` with Node 22 or newer. The harness launches an installed Chromium-based browser with a disposable user profile and serves the built application on a random loopback port. Use SCARP_BROWSER_EXECUTABLE to select an installed browser explicitly. No browser package or downloaded driver is required.

The checks exercise the real React Settings controls, search reveal and focus, appearance persistence, keybinding labels, strict import rejection, reviewed import and undo, named configurations, history and reload behavior. Native Tauri dialogs, filesystem authorization, compiler execution and operating-system keyboard delivery are not covered by this browser test. Continue using Windows native acceptance cases for those features.
