# New Scarp project wizard

Open a workspace folder, expand New Scarp Project, choose an already
discovered available parent, and enter a new visible child folder name.
Choose a display name, semantic version and fixed starter template.
Optional tests are ordinary Scarp programs, not an invented test syntax.

Review the exact modern manifest and every planned source/test file.
A second explicit confirmation is required to create the project.
The catalog's executable source is fixed; user names appear only in
the manifest's escaped string field. Nothing executes or installs.

Creation walks observed parents through Tauri's user-selected scoped
filesystem, rechecks regular nonlinked directories, and refuses portable
case-insensitive collisions and open editor path conflicts. The project
and subdirectories are created non-recursively. Files use exclusive
createNew handles and handle-bound writes, never truncate or overwrite.
The added fs:allow-write permission enables writing through a native
handle; it does not provide new filesystem path scope.
Every completed file is reread in bounded chunks and compared to its
exact preview bytes. The manifest is written last.

This is a sequential native operation, not an atomic filesystem
transaction. A denied or interrupted step can leave a partial project.
Studio reports confirmed and uncertain relative destinations and does
not delete or roll back anything automatically. Refresh and inspect the
folder before retrying. External filesystem races remain possible.
The existing project selection is retained; select the new project
explicitly before Info, Verify, Run or Test. No release is affected.
