{$, $$, View, TextEditorView, ScrollView} = require 'atom-space-pen-views'
fs = require 'fs'
os = require 'os'
path = require 'path'
mkdirp = require 'mkdirp'
touch = require 'touch'


class DirectoryListView extends ScrollView
  @content: ->
    @ul class: 'list-group', outlet: 'directoryList'

  renderFiles: (files, hasParent) ->
    @empty()

    # Parent directory
    if hasParent
      @append $$ ->
        @li class: 'list-item parent-directory', =>
          @span class: 'icon icon-file-directory', '..'

    files?.forEach (file) =>
      icon = if file.isDir then 'icon-file-directory' else 'icon-file-text'
      @append $$ ->
        @li class: "list-item #{'directory' if file.isDir}", =>
          @span class: "icon #{icon}", file.name


module.exports =
class AdvancedFileView extends View
  PATH_SEPARATOR: ","
  FS_ROOT: if os.platform == "win32" then process.cwd().split(path.sep)[0] else "/"
  advancedFileView: null
  keyUpListener: null

  @config:
    caseSensitiveAutoCompletion:
      type: 'boolean'
      default: false
    createFileInstantly:
      type: 'boolean'
      default: false

  @activate: (state) ->
    @advancedFileView = new AdvancedFileView(state.advancedFileViewState)

  @deactivate: ->
    @advancedFileView.detach()

  @content: (params) ->
    @div class: 'advanced-open-file', =>
      @p outlet:'message', class:'icon icon-file-add', "Enter the path for the file/directory. Directories end with a '" + path.sep + "'."
      @subview 'miniEditor', new TextEditorView({mini:true})
      @subview 'directoryListView', new DirectoryListView()

  @detaching: false,

  initialize: (serializeState) ->
    atom.commands.add 'atom-workspace', 'advanced-open-file:toggle', => @toggle()
    @miniEditor.getModel().setPlaceholderText(path.join('path','to','file.txt'));
    atom.commands.add @element,
      'core:confirm': => @confirm()
      'core:cancel': => @detach()
    @directoryListView.on 'click', '.list-item', (ev) => @clickItem(ev)

  clickItem: (ev) ->
    listItem = $(ev.target)

    if listItem.hasClass 'parent-directory'
      @updatePath path.dirname(@inputPath()) + path.sep
    else
      newPath = path.join @inputPath(), listItem.text()
      if not listItem.hasClass 'directory'
        @confirm newPath
      else
        @updatePath newPath + path.sep

    @miniEditor.focus()

  # Retrieves the reference directory for the relative paths
  referenceDir: () ->
    homeDir = process.env.HOME or process.env.HOMEPATH or process.env.USERPROFILE
    atom.project.getPaths()[0] or homeDir
    '/'

  # Resolves the path being inputted in the dialog, up to the last slash
  inputPath: () ->
    input = @getLastSearchedFile()
    path.join @referenceDir(), input.substr(0, input.lastIndexOf(path.sep))

  inputFullPath: () ->
    input = @getLastSearchedFile()
    path.join @referenceDir(), input

  getLastSearchedFile: () ->
    input = @miniEditor.getText()
    commanIndex = input.lastIndexOf(@PATH_SEPARATOR) + 1
    input.substring(commanIndex, input.length)


  # Returns the list of directories matching the current input (path and autocomplete fragment)
  getFileList: (callback) ->
    input = @getLastSearchedFile()
    fs.stat @inputPath(), (err, stat) =>

      if err?.code is 'ENOENT'
        return []

      fs.readdir @inputPath(), (err, files) =>
        fileList = []
        dirList = []

        files.forEach (filename) =>
          fragment = input.substr(input.lastIndexOf(path.sep) + 1, input.length)
          caseSensitive = atom.config.get 'advanced-open-file.caseSensitiveAutoCompletion'

          if not caseSensitive
            fragment = fragment.toLowerCase()

          matches =
            caseSensitive and filename.indexOf(fragment) is 0 or
            not caseSensitive and filename.toLowerCase().indexOf(fragment) is 0

          if matches
            try
              isDir = fs.statSync(path.join(@inputPath(), filename)).isDirectory()
            catch
              ## TODO fix error which is thrown when you hold backspace

            (if isDir then dirList else fileList).push name:filename, isDir:isDir

        callback.apply @, [dirList.concat fileList]


  # Called only when pressing Tab to trigger auto-completion
  autocomplete: (str) ->
    @getFileList (files) ->
      newString = str
      oldInputText = @miniEditor.getText()
      indexOfString = oldInputText.lastIndexOf(str)
      textWithoutSuggestion = oldInputText.substring(0, indexOfString)
      if files?.length is 1
        newPath = path.join(@inputPath(), files[0].name)

        suffix = if files[0].isDir then path.sep else ''
        @updatePath(newPath + suffix)

      else if files?.length > 1
        longestPrefix = @longestCommonPrefix((file.name for file in files))
        newPath = path.join(@inputPath(), longestPrefix)

        if (newPath.length > @inputFullPath().length)
          @updatePath(newPath)
        else
          atom.beep()
      else
        atom.beep()

  updatePath: (newPath) ->
    @miniEditor.setText newPath

  update: ->
    @getFileList (files) ->
      @renderAutocompleteList files

    if /\/$/.test @miniEditor.getText()
      @setMessage 'file-directory-create'
    else
      @setMessage 'file-add'

  setMessage: (icon, str) ->
    @message.removeClass 'icon'\
      + ' icon-file-add'\
      + ' icon-file-directory-create'\
      + ' icon-alert'
    if icon? then @message.addClass 'icon icon-' + icon
    @message.text str or "Enter the path for the file/directory. Directories end with a '" + path.sep + "'."

  # Renders the list of directories
  renderAutocompleteList: (files) ->
    input = @getLastSearchedFile()
    @directoryListView.renderFiles files, input and input != @FS_ROOT

  confirm: (pathToConfirm) ->
    inputPath = pathToConfirm or @miniEditor.getText()
    if fs.existsSync(inputPath)
      if fs.statSync(inputPath).isFile()
        atom.workspace.open inputPath
        @detach()
      else
        atom.beep()
    else
      relativePaths = inputPath.split(@PATH_SEPARATOR)

      for relativePath in relativePaths
        pathToCreate = path.join(@referenceDir(), relativePath)
        createWithin = path.dirname(pathToCreate)
        try
          if /\/$/.test(pathToCreate)
            mkdirp pathToCreate
          else
            if atom.config.get 'advanced-open-file.createFileInstantly'
              mkdirp createWithin unless fs.existsSync(createWithin) and fs.statSync(createWithin)
              touch pathToCreate
            atom.workspace.open pathToCreate
        catch error
          @setMessage 'alert', error.message

      @detach()

  detach: ->
    $('html').off('click', @outsideClickHandler) unless not @outsideClickHandler
    @outsideClickHandler = null
    return unless @hasParent()
    @detaching = true
    @miniEditor.setText ''
    @setMessage()
    @directoryListView.empty()
    miniEditorFocused = @miniEditor.hasFocus()
    @keyUpListener.off()
    super
    @panel?.destroy()
    @restoreFocus() if miniEditorFocused
    @detaching = false

  attach: ->
    @suggestPath()
    @previouslyFocusedElement = $(':focus')
    @panel = atom.workspace.addModalPanel(item: this)

    @parent('.modal').css({
      'max-height': '100%',
      display: 'flex',
      'flex-direction': 'column',
    })

    # Detach when clicked outside.
    @outsideClickHandler = (ev) =>
      if not $(ev.target).closest('.advanced-open-file').length
        @detach()
    $('html').on 'click', @outsideClickHandler

    @miniEditor.focus()

    consumeKeypress = (ev) => ev.preventDefault(); ev.stopPropagation()

    # Populate the directory listing live
    @miniEditor.getModel().onDidChange => @update()

    # Consume the keydown event from holding down the Tab key
    @miniEditor.on 'keydown', (ev) => if ev.keyCode is 9 then consumeKeypress ev

    # Handle the Tab completion
    @keyUpListener = @miniEditor.on 'keyup', (ev) =>
      if ev.keyCode is 9
        consumeKeypress ev
        pathToComplete = @getLastSearchedFile()
        @autocomplete pathToComplete

    @miniEditor.focus()
    @getFileList (files) -> @renderAutocompleteList files

  suggestPath: ->
    activePath = atom.workspace.getActiveTextEditor()?.getPath()
    if activePath
      activeDir = path.dirname(activePath) + path.sep
      suggestedPath = path.relative @referenceDir(), activeDir
      @miniEditor.setText activeDir

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
