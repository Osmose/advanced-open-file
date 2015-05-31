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
