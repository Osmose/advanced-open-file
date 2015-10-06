0.11.0 (October 5, 2015)
========================

* Add `advanced-open-file:delete-path-component` command for easily navigating
  directory hierarchies. (artagnon)
* Add `advanced-open-file:confirm-selected-or-first` command for easier opening
  of files; selects first item when nothing is selected. (artagnon)


0.10.0 (September 19, 2015)
===========================

* Disabled soft-word-wrap on the path input to avoid scrolling/wrapping issues
  on long paths.
* Improve directory detection for adding the project folder button. Fixes an
  issue with Windows directories starting with a drive letter missing the
  button.
* Rename Helm-style shortcuts to fast directory-switch shortcuts and add a new
  shortcut `:/` for switching to the project root directory.
* Only show the parent directory in the listing if the file list is not being
  filtered.
* Show "Add as project folder" button for all folders that are not project
  folders. Previously all folders within project folders were missing the
  button.
* Scroll cursor in input to the end of the text when triggering autocomplete.


0.9.2 (September 7, 2015)
=========================

* Improved dialog layout. (JesseLeite)
* Added event emitter, `onDidOpenFile`, and `onDidCreateFile` for other packages
  to detect when files are opened.


0.9.1 (September 4 2015)
========================

* Update description and README and publish to update the registry.


0.9.0 (September 4 2015)
========================

* Fix handling of Windows paths by replace all forward-slash instances
  with path.sep, and detecting the root directory for a path better.
* Removed support for creating multiple paths at once, as it doesn't
  really fit with what advanced-open-file is about and made the code
  harder to understand.
* Add `Ctrl-p`/`Ctrl-n` and `Ctrl-i`/`Ctrl-k` as alternative keybindings
  for moving through the file list, and use commands for all keybindings
  to make customization easier.
* Fix bug where clearing the input and entering "~/" with Helm-style
  shortcuts enabled did not automatically fill in the user's home
  directory.
* Added option for the default input value on toggle.
* When scrolling with the keyboard, the list of matching files now
  scrolls to show the selected file when it is out of view.
* Paths entered in the input that are not absolute are now considered
  relative to the first project root. When relative paths are being used, the
  directory listing will not show a parent entry past the project root.


0.8.2 (August 3 2015)
=====================

* Make icons in dropdown compatible with the file-icons package. SUCH FANCY
* Add icon to directories entries that, when clicked, adds them as project
  directories.


0.8.1 (July 14 2015)
====================

* Scroll to the end of the search box on attach in case the path is super long.


0.8.0 (July 11 2015)
====================

* Add option for Helm-style fast directory switching.
* Add ability to undo changes to the autocomplete field using Ctrl/Cmd-Z.
* Fix bug where clicking the icon or path in a list item would beep and
  fail instead of selecting the clicked list item.
* Fix bug where entering a directory named ~ was impossible with fast directory
  switching enabled.


0.7.2 (June 17 2015)
====================

* Default to project root when showing dialog while no tab is active.


0.7.1 (May 30 2015)
===================

* Add a GIF to the README (and publish a new release so atom.io picks it
  up).


0.7.0 (May 30 2015)
===================

* Add ability to hover and click on entries in the file/folder listing.
  Directories are added to the current path, while files are immediately
  opened.
* Add scrollbar when file/folder listing is taller than the window.
* Add ability to move through the file/folder listing with the keyboard.
  Up and down arrow keys will select list items and Enter will select
  them in the same way a mouse click does.
* Add entry at the top of the file/folder listing for the parent
  directory.
* Fix bug with appending a path separator to the filesystem root.


0.6.0 (May 24 2015)
===================

* Remove `suggestCurrentFilePath` setting, making it default behavior.
* Remove `addTextFromSelection` setting.
* Fix issue with dialog not being closed properly.
* Correctly focus currently-active editor when dialog is closed.


0.5.0 (May 24 2015)
===================

* Forked from Trudko/advanced-new-file to Osmose/advanced-open-file.
* Removed `removeWholeFolder` and `showFilesInAutocomplete` settings,
  making the latter the default behavior.
* Change shortcut to `ctrl-alt-o`.
* Change behavior to open existing files and create new files only for
  paths that don't exist.


0.4.3 (May 22 2015)
===================

* Removed deprecated API for calling listening for core:confirm and core:cancel


0.4.2 (May 15 2015)
===================

* Updated Context menu and use activationCommands intead of actiovationEvents(thanks to zimme)
* Removed deprecated configDefaults (thanks to olmokramer)


0.4.1 (Apr 27 2015)
==================
* Resolved problem with creating folder if create file instantly was set to true (thanks to phyllisstein)


0.4.0 (Apr 14 2015)
==================
* Added option for creating file immediately (thanks to silentvick)
* Fixed problem with overlay in Atom One theme (thanks to silentvick)


0.3.3 (Feb 15 2015)
===================

* Uncaught TypeError: undefined is not a function #9


0.3.2 (Feb 14 2015)
===================

* Focus editor on the start of the package


0.3.1 (Feb 14 2015)
===================

* Add text from selection only if there is active text editor


0.3.0 (Feb 14 2015)
===================

* Removed deprecation calls  #6
* New setting for inserting selection to the input field #7


0.2.2 (Feb 7 2015)
===================

* Opens new window with new file  #5
* Can't install v0.2.0  #4


0.2.1 (Feb 1 2015)
===================

* Added Remove Whole folder setting
* Resolved few issues brought by last release


0.2.0 (Jan 31 2015)
===================

* Simplify navigating up directory structure #2
* Remove deprecated code. #1


0.1.0 (Jan 18 2015)
===================

* Initial release
