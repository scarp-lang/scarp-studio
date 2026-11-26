# Scarp Studio Settings — development guide

This guide describes the November 26 development integration, not the previously published November 24 installer. The latest integrated browser smoke and Windows build were verified at PR #106; newer commits need their own CI evidence.

## Open and find preferences

Use Settings in the main toolbar or Ctrl+, (the fixed Settings shortcut). Search by preference label, shortcut or common terms. Select a search result or press Enter to reveal its control. The category bar limits the visible sections. Pending recovery stays visible even when filters exclude it. If a control is disabled, search moves focus to its category instead.

## Editor, accessibility and language assistance

The editor group includes basic font, tabs and minimap controls. Expand Advanced editor experience for line height, letter spacing, caret appearance, code folding, bracket matching, rulers, indentation and typing policies. The read-only typography sample approximates the appearance and does not execute code. Applying settings does not rewrite existing source. The accessibility preset is explicitly reviewed.

Appearance offers explicit light/dark or system theme, contrast and motion. Reduced motion temporarily disables caret animation and smooth scrolling. It does not change your saved editor choices. Actual OS integration needs a Windows GUI test.

IntelliSense controls automatic or manual suggestions, catalog categories, local function analysis, matching, hover, signatures, inlay hints and other language features. Local analysis is bounded and conservative; it is not a full compiler or language server. IntelliSense-only profiles remain separate from complete Studio configurations.

## Compiler and file settings

Compiler setup can scan for candidates without approving them. Approve the exact executable path explicitly; the Download action only opens the download destination. Startup scan preference applies on the next launch. No imported portable profile authorizes a compiler.

Auto Save is off by default and only applies to named dirty sources after explicit enablement. Delay is portable; enablement is not. Draft recovery and workspace session metadata have independent controls. Back up actual source files separately.

## Studio preference transfer

Export the JSON and review it before sharing. Portable groups are appearance, editor, IntelliSense, workspace dimensions and Auto Save timing. Import validates exact supported fields and versions, shows a field-level difference and lets you select categories. A stale review is rejected. Session undo is available only when the applied configuration is still current.

Named configurations save up to 12 complete portable snapshots. Switching is explicit and reviewed. Workspace associations store up to 12 local workspace keys and selected portable categories. Opening a workspace does not automatically apply its association; applying it changes the active Studio settings globally. Forgetting an association removes metadata, not files.

Session history records up to 32 changes in memory; it may combine rapid changes to a single field. Review the before or after snapshot and selected groups before restoration. Clearing history leaves active preferences unchanged. The preference audit compares every portable field to its default and supports a copyable report and reviewed individual resets.

Portable transfer does not include source, paths, named profiles, snippets, compiler approval, startup discovery, Auto Save authorization, recovery copies or keyboard bindings. Settings storage is local and not encrypted; do not place secrets in snippet bodies.

## Keyboard shortcuts and snippets

Twenty-three Studio command bindings have a searchable settings interface. Two are fixed: Settings and Stop. Escape remains a fixed dismissal key. Alternative chords use Ctrl+Alt+Shift+letter; some may be intercepted by the OS. Studio bindings do not replace Monaco's native editing shortcuts. Shortcut JSON backup is separate, validates complete bindings and detects conflicts across selected and unselected groups. An applied import can be undone after review if no later binding changes occurred.

The user snippet library stores up to 32 templates. Use an ASCII identifier prefix not reserved by the built-in catalog. Numbered placeholders use `{{1:name}}`, repeated stops use `{{1}}`, and the optional final caret uses `{{0}}`. Prefix conflicts and malformed templates are rejected. Completion inserts only on explicit acceptance and supports tab stops; the command palette inserts expanded default text into a single current selection with editor undo. Neither path runs source. Snippet JSON import adds new prefixes only and preserves existing definitions on conflicts.

## Testing and limitations

Use the exact successful GitHub Actions run for the intended commit, verify candidate artifacts as documented in the Windows acceptance worksheet, and test with disposable sources. The browser suite verifies frontend interactions and reload persistence, not OS key delivery, Tauri dialogs, real filesystem authorization or the entire native Windows GUI. No new release or version change is authorized by this guide.
