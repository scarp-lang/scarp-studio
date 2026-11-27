# Command palette collections

The command palette supports All commands, Pinned, Recently selected,
Files, Search, Navigation, Compiler, Workspace, Templates and Snippets.
The selected collection narrows the existing keyboard-driven results.
Search still uses the same bounded deterministic ranking.

Pin the selected built-in command from the palette, or manage pinned
order in Settings → Keyboard shortcuts → Command palette collections.
Up to 12 pinned built-in IDs and 12 distinct recent selections are
retained during the current Studio session only. Templates, user snippets,
file paths, queries and arbitrary command arguments are never retained.
Recency means the command was selected, not that it completed successfully.

The settings view does not execute commands. Clearing either collection
requires a review against the current library state. Closing Studio drops
both collections; they are not part of preference export or persistence.

The palette still requires explicit Enter or click to select a command.
Pinning and collection changes do not execute anything. Dialog Tab and
Shift+Tab cycle through actual enabled controls while listbox navigation
remains on the search input.
