{$, $$, View, TextEditorView, ScrollView} = require "atom-space-pen-views"
fs = require "fs"
os = require "os"
osenv = require "osenv"
path = require "path"
mkdirp = require "mkdirp"
touch = require "touch"
{Emitter} = require 'event-kit'


DEFAULT_ACTIVE_FILE_DIR = "Active file's directory"
DEFAULT_PROJECT_ROOT = "Project root"
DEFAULT_EMPTY = "Empty"


# Shared emitter for outside packages to subscribe to.
emitter = new Emitter()


# Find filesystem root for the given path by calling path.dirname
# until it returns the same value as its input.
getRoot = (inputPath) ->
  lastPath = null
  while inputPath != lastPath
    lastPath = inputPath
    inputPath = path.dirname(inputPath)
  return inputPath

isRoot = (inputPath) ->
  return path.dirname(inputPath) is inputPath


absolutify = (inputPath) ->
  ###
  Ensure that the given path is absolute. Relative paths are treated as
  relative to the current project root.
  ###
  if getRoot(inputPath) == "."
    projectPaths = atom.project.getPaths()
    if projectPaths.length > 0
      return path.join(projectPaths[0], inputPath)

  absolutePath = path.resolve(inputPath)
  if inputPath.endsWith(path.sep)
    return absolutePath + path.sep
  else
    return absolutePath


class DirectoryListView extends ScrollView
  @content: ->
    @ul class: "list-group", outlet: "directoryList"

  renderFiles: (files, showParent) ->
    @empty()

    # Parent directory
    if showParent
      @append $$ ->
        @li class: "list-item parent-directory", =>
          @span class: "icon icon-file-directory", ".."

    files?.forEach (file) =>
      icon = if file.isDir then "icon-file-directory" else "icon-file-text"
      @append $$ ->
        @li class: "list-item #{'directory' if file.isDir}", =>
          @span class: "filename icon #{icon}", "data-name": path.basename(file.name), file.name
          if file.isDir and not file.isProjectDir then @span
            class: "add-project-folder icon icon-plus",
            title: "Open as project folder"


module.exports =
class AdvancedFileView extends View
  advancedFileView: null

  @config:
    caseSensitiveAutoCompletion:
      title: "Case-sensitive auto-completion"
      type: "boolean"
      default: false
    createFileInstantly:
      title: "Create files instantly"
      description: "When opening files that don't exist, create them
                    immediately instead of on save."
      type: "boolean"
      default: false
    helmDirSwitch:
      title: "Shortcuts for fast directory switching"
      description: "See README for details."
      type: "boolean"
      default: false
    defaultInputValue:
      title: "Default input value"
      description: "What should the path input default to when the dialog
                    is opened?"
      type: "string"
      enum: [DEFAULT_ACTIVE_FILE_DIR, DEFAULT_PROJECT_ROOT, DEFAULT_EMPTY]
      default: DEFAULT_ACTIVE_FILE_DIR

  @onDidOpenPath: (callback) ->
    emitter.on("did-open-path", callback)

  @onDidCreatePath: (callback) ->
    emitter.on("did-create-path", callback)

  @activate: (state) ->
    @advancedFileView = new AdvancedFileView(state.advancedFileViewState)

  @deactivate: ->
    @advancedFileView.detach()

  @content: (params) ->
    @div class: "advanced-open-file", =>
      @p
        outlet: "message",
        class: "info-message icon icon-file-add",
        "Enter the path for the file/directory. Directories end with a "#{path.sep}"."
      @subview "miniEditor", new TextEditorView({mini:true})
      @subview "directoryListView", new DirectoryListView()

  @detaching: false,

  initialize: (serializeState) ->
    atom.commands.add "atom-workspace",
      "advanced-open-file:toggle": => @toggle()
    atom.commands.add @element,
      "core:confirm": => @confirm()
      "core:cancel": => @detach()
      "advanced-open-file:autocomplete": => @autocomplete()
      "advanced-open-file:undo": => @undo()
      "advanced-open-file:move-cursor-down": => @moveCursorDown()
      "advanced-open-file:move-cursor-up": => @moveCursorUp()
      "advanced-open-file:delete-path-component": => @deletePathComponent()
      "advanced-open-file:confirm-selected-or-first": => @confirmSelectedOrFirst()
    @directoryListView.on "click", ".list-item", (ev) => @clickItem(ev)
    @directoryListView.on "click", ".add-project-folder", (ev) => @addProjectFolder(ev)

    editor = @miniEditor.getModel()
    editor.setPlaceholderText(path.join("path","to","file.txt"));
    editor.setSoftWrapped(false);

  clickItem: (ev) ->
    listItem = $(ev.currentTarget)
    @selectItem listItem
    @miniEditor.focus()

  selectItem: (listItem) ->
    if listItem.hasClass "parent-directory"
      newPath = path.dirname(@inputPath()) + path.sep
      @updatePath newPath
    else
      newPath = path.join @inputPath(), listItem.text()
      if not listItem.hasClass "directory"
        @openOrCreate(newPath)
      else
        @updatePath newPath + path.sep

  addProjectFolder: (ev) ->
    listItem = $(ev.currentTarget).parent(".list-item")
    folderPath = path.join @inputPath(), listItem.text()
    atom.project.addPath(folderPath)
    @detach()

  # Resolves the path being inputted in the dialog, up to the last slash
  inputPath: () ->
    input = @miniEditor.getText()
    if input.endsWith(path.sep)
      return input
    else
      return path.dirname(input)


  # Returns the list of directories matching the current input (path and autocomplete fragment)
  getFileList: (callback) ->
    input = @miniEditor.getText()
    inputPath = absolutify(@inputPath())

    fs.stat inputPath, (err, stat) =>
      if err?.code is "ENOENT"
        return []

      fs.readdir inputPath, (err, files) =>
        fileList = []
        dirList = []

        files.forEach (filename) =>
          fragment = input.substr(input.lastIndexOf(path.sep) + 1, input.length)
          caseSensitive = atom.config.get "advanced-open-file.caseSensitiveAutoCompletion"

          if not caseSensitive
            fragment = fragment.toLowerCase()

          matches =
            caseSensitive and filename.indexOf(fragment) is 0 or
            not caseSensitive and filename.toLowerCase().indexOf(fragment) is 0

          if matches
            filePath = path.join(inputPath, filename)

            try
              isDir = fs.statSync(filePath).isDirectory()
            catch
              ## TODO fix error which is thrown when you hold backspace

            (if isDir then dirList else fileList).push({
              name: filename,
              isDir: isDir,
              isProjectDir: isDir and filePath in atom.project.getPaths(),
            })

        callback.apply @, [dirList.concat fileList]


  # Called only when pressing Tab to trigger auto-completion
  autocomplete: ->
    pathToComplete = @inputPath()
    @getFileList (files) ->
      newString = pathToComplete
      oldInputText = @miniEditor.getText()
      indexOfString = oldInputText.lastIndexOf(pathToComplete)
      textWithoutSuggestion = oldInputText.substring(0, indexOfString)
      if files?.length is 1
        newPath = path.join(@inputPath(), files[0].name)

        suffix = if files[0].isDir then path.sep else ""
        @updatePath(newPath + suffix)
        @scrollToCursor()

      else if files?.length > 1
        longestPrefix = @longestCommonPrefix((file.name for file in files))
        newPath = path.join(@inputPath(), longestPrefix)

        if (newPath.length > @inputPath().length)
          @updatePath(newPath)
          @scrollToCursor()
        else
          atom.beep()
      else
        atom.beep()

  updatePath: (newPath, oldPath=null) ->
    @pathHistory.push oldPath or @miniEditor.getText()
    newPath = path.normalize(newPath)

    # If the new path is ./, just leave it blank.
    if newPath == ".#{path.sep}"
      newPath = ''

    @miniEditor.setText(newPath)
    @scrollToCursor()

  update: ->
    if @detaching
      return

    if atom.config.get "advanced-open-file.helmDirSwitch"
      text = @miniEditor.getText()
      if text.endsWith path.sep + path.sep
        @updatePath getRoot(text), text[...-1]
      else if text.endsWith("#{path.sep}~#{path.sep}") or text == "~#{path.sep}"
        try # Make sure ~ doesn't exist in the current directory.
          fs.statSync @inputPath()
        catch # It doesn't, do the shortcut!
          @updatePath osenv.home() + path.sep, text[...-2]
      else if text.endsWith("#{path.sep}:#{path.sep}") or text == ":#{path.sep}"
        projectPaths = atom.project.getPaths()
        if projectPaths.length > 0
          @updatePath projectPaths[0] + path.sep, text[...-2]

    @getFileList (files) ->
      @renderAutocompleteList files

    if @miniEditor.getText().endsWith(path.sep)
      @setMessage "file-directory-create"
    else
      @setMessage "file-add"

  setMessage: (icon, str) ->
    @message.removeClass "icon"\
      + " icon-file-add"\
      + " icon-file-directory-create"\
      + " icon-alert"
    if icon? then @message.addClass "icon icon-" + icon
    @message.text str or "
      Enter the path for the file/directory. Directories end with a '#{path.sep}'.
    "

  # Renders the list of directories
  renderAutocompleteList: (files) ->
    inputPath = absolutify(@inputPath())
    showParent = inputPath and inputPath.endsWith(path.sep) and not isRoot(inputPath)
    @directoryListView.renderFiles files, showParent

  confirm: ->
    selected = @find(".list-item.selected")
    if selected.length > 0
      @selectItem(selected)
    else
      @openOrCreate(@miniEditor.getText())

  confirmSelectedOrFirst: ->
    ###
    Select the currently selected item. If nothing is selected, and there are
    non-zero items in the list, select the first. Else, create a new file with
    the given name.
    ###
    all = @find(".list-item:not(.parent-directory)")
    selected = all.filter(".selected")
    if selected.length > 0
      @selectItem(selected)
    else if all.length > 0
      @selectItem(all.filter(":first"))
    else
      @openOrCreate(@miniEditor.getText())

  openOrCreate: (inputPath) ->
    inputPath = absolutify(inputPath)

    if fs.existsSync(inputPath)
      if fs.statSync(inputPath).isFile()
        atom.workspace.open inputPath
        emitter.emit("did-open-path", inputPath)
        @detach()
      else
        atom.beep()
    else
      createWithin = path.dirname(inputPath)
      try
        if inputPath.endsWith(path.sep)
          mkdirp inputPath
        else
          if atom.config.get "advanced-open-file.createFileInstantly"
            mkdirp createWithin unless fs.existsSync(createWithin) and fs.statSync(createWithin)
            touch inputPath
            emitter.emit("did-create-path", inputPath)
          atom.workspace.open inputPath
          emitter.emit("did-open-path", inputPath)
        @detach()
      catch error
        @setMessage "alert", error.message

  undo: ->
    if @pathHistory.length > 0
      @miniEditor.setText @pathHistory.pop()
      @scrollToCursor()
    else
      atom.beep()

  deletePathComponent: ->
    fullPath = @miniEditor.getText()
    upOneLevel = path.dirname(fullPath)
    @updatePath(upOneLevel + path.sep)

  moveCursorDown: ->
    selected = @find(".list-item.selected").next()
    if selected.length < 1
      selected = @find(".list-item:first")
    @moveCursorTo(selected)

  moveCursorUp: ->
    selected = @find(".list-item.selected").prev()
    if selected.length < 1
      selected = @find(".list-item:last")
    @moveCursorTo(selected)

  moveCursorTo: (selectedElement) ->
    @find(".list-item").removeClass("selected")
    selectedElement.addClass("selected")

    # If the selected element is out of view, scroll it into view.
    parent = selectedElement.parent()
    parentHeight = parent.height()
    selectedPos = selectedElement.position()
    selectedHeight = selectedElement.height()
    if selectedPos.top < 0
      # scrollPos.top is exactly the difference between the current
      # scrollTop and the top of the selected element, so just add it.
      parent.scrollTop(selectedPos.top + parent.scrollTop())
    else if selectedPos.top + selectedHeight > parentHeight
      # Find how far below the bottom the selectedElement is, and scroll
      # down that amount plus the height to show it.
      distanceBelow = selectedPos.top - parentHeight
      parent.scrollTop(distanceBelow + selectedHeight + parent.scrollTop())

  scrollToCursor: ->
    @miniEditor.getModel().scrollToCursorPosition()

  detach: ->
    $("html").off("click", @outsideClickHandler) unless not @outsideClickHandler
    @outsideClickHandler = null
    return unless @hasParent()
    @detaching = true
    @miniEditor.setText ""
    @setMessage()
    @directoryListView.empty()
    miniEditorFocused = @miniEditor.hasFocus()
    super
    @panel?.destroy()
    @restoreFocus() if miniEditorFocused
    @detaching = false

  attach: ->
    @suggestPath()
    @previouslyFocusedElement = $(":focus")
    @pathHistory = []
    @panel = atom.workspace.addModalPanel(item: this)

    @parent(".modal").css({
      "max-height": "100%",
      display: "flex",
      "flex-direction": "column",
    })

    # Detach when clicked outside.
    @outsideClickHandler = (ev) =>
      if not $(ev.target).closest(".advanced-open-file").length
        @detach()
    $("html").on "click", @outsideClickHandler

    @miniEditor.focus()
    @scrollToCursor()

    # Populate the directory listing live
    @miniEditor.getModel().onDidChange => @update()

    @miniEditor.focus()
    @getFileList (files) -> @renderAutocompleteList files

  suggestPath: ->
    suggestedPath = ''
    switch atom.config.get("advanced-open-file.defaultInputValue")
      when DEFAULT_ACTIVE_FILE_DIR
        activePath = atom.workspace.getActiveTextEditor()?.getPath()
        if activePath
          suggestedPath = path.dirname(activePath) + path.sep
      when DEFAULT_PROJECT_ROOT
        projectPaths = atom.project.getPaths()
        if projectPaths.length > 0
          suggestedPath = projectPaths[0] + path.sep

    @miniEditor.setText suggestedPath

  toggle: ->
    if @hasParent()
      @detach()
    else
      @attach()

  restoreFocus: ->
    if @previouslyFocusedElement?.isOnDom()
      @previouslyFocusedElement.focus()
    else
      atom.views.getView(atom.workspace).focus()

  longestCommonPrefix: (fileNames) ->
    if (fileNames?.length == 0)
      return ""

    longestCommonPrefix = ""
    for prefixIndex in [0..fileNames[0].length - 1]
      nextCharacter = fileNames[0][prefixIndex]
      for fileIndex in [0..fileNames.length - 1]
        fileName = fileNames[fileIndex]
        if (fileName.length < prefixIndex || fileName[prefixIndex] != nextCharacter)
          # The first thing that doesn't share the common prefix!
          return longestCommonPrefix
      longestCommonPrefix += nextCharacter

    return longestCommonPrefix
