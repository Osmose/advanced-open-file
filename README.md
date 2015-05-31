# Advanced Open File

Advanced Open File is fork of
[Advanced New File](https://github.com/Trudko/advanced-new-file), itself a fork
of [Fancy New File](https://github.com/rev087/fancy-new-file). Thanks to both
rev087 and Trudko for their work.

Advanced Open File is a package for helping Atom users to open files and folders
easily. It can also create new files and folders if they don't exist.

## Usage

Hit `Cmd-Alt-O`/`Ctrl-Alt-O` to open the file list to the directory of the
current file. As you edit the path the file list will automatically show
matching files and directories. Hit `Tab` to autocomplete the path.

Hit `Enter` to open the file at the given path. If the file doesn't exist, a tab
will be opened that will save to that file. Any directories in the path that
don't exist will be created immediately upon hitting `Enter`.

You can also click on any entry in the file list to add it to the current path
(in the case of a directory) or to open it immediately (in the case of a file).
You can also use the `Up` and `Down` arrow keys to scroll through the list, and
`Enter` to select the currently-highlighted item.

You can also remap the command to any key you want. For example, add the
following to your keymap to map `Ctrl-x Ctrl-f` to open the dialog:

```cson
'atom-workspace':
  'ctrl-x ctrl-f': 'advanced-open-file:toggle'
```

## Settings:

<dl>
  <dt>Case-sensitive auto-completion</dt>
  <dd>Control whether auto-completion is case-sensitive. Defaults to false.</dd>

  <dt>Create file instantly</dt>
  <dd>
    If checked, files are created immediately instead of on save if they don't
    exist.
  </dd>
</dl>

## License

Licensed under the MIT License. See `LICENSE` for details.
