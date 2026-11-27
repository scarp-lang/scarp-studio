# Browser smoke startup reliability

Windows CI occasionally fails before the settings assertions run because
the isolated Chromium profile does not produce DevToolsActivePort, or
the local DevTools transport is not ready.

The harness now makes at most two startup attempts with separate temporary
profiles. It checks the transport on about:blank before navigation, logs
bounded startup stderr, validates the port and makes cleanup idempotent.
A cleanup failure blocks another launch. No application assertion or
completed test scenario is retried; a real regression remains a failure.

The node harness tests cover bounded retries, cleanup failures, failed
application assertions, path containment and serving the production build.
This is CI browser infrastructure, not native Tauri GUI acceptance.
