# Session Program Input presets

Expand Manage input presets below the existing Program Input field in the
compiler controls. Capture an explicit named copy of the current preloaded
replies and prompt-mode setting. Review the byte count and mode before
confirming. This does not launch Run, Verify or a project command.

Presets are session memory only, not source files, local storage or durable
configuration. Avoid passwords and secrets. The raw replies are shown only
when you choose Inspect stored replies; label search does not inspect replies.

Select a saved preset, review applying it and confirm. Applying replaces the
entire current Program Input field and prompt mode, then increments the
existing input generation. This invalidates old Run input assumptions and
cannot bypass native input validation or compiler trust. The prior field is
available for one guarded undo while the exact applied generation is current.
Typing, changing prompt mode, or another apply invalidates that undo.

Capture may replace a selected preset only after explicit review. Labels
must be nonempty, unique ignoring case, and no longer than 60 UTF-16 units.
The store supports up to 16 presets and 96 KiB of retained UTF-8 input. The
existing per-input 16 KiB, 4096-byte line and 256-line limits still apply.
There is no automatic eviction. Review removal of one or all presets to
discard session copies without changing the current Program Input field.
