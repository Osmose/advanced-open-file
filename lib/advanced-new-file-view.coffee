{$, $$, View, TextEditorView} = require 'atom-space-pen-views'
fs = require 'fs'
path = require 'path'
mkdirp = require 'mkdirp'

module.exports =
class AdvancedFileView extends View
  PATH_SEPARATOR: ","
  advancedFileView: null

  @configDefaults:
    suggestCurrentFilePath: false
    showFilesInAutoComplete: false
    caseSensitiveAutoCompletion: false

  @activate: (state) ->
    @advancedFileView = new AdvancedFileView(state.advancedFileViewState)

  @deactivate: ->
    @advancedFileView.detach()

  @content: (params)->
    @div class: 'advanced-new-file overlay from-top', =>
      @p outlet:'message', class:'icon icon-file-add', "Enter the path for the new file/directory. Directories end with a '" + path.sep + "'."
      @subview 'miniEditor', new TextEditorView({mini:true})
      @ul class: 'list-group', outlet: 'directoryList'

  @detaching: false,

  initialize: (serializeState) ->
    atom.commands.add 'atom-workspace', 'advanced-new-file:toggle', => @toggle()
    @miniEditor.getModel().setPlaceholderText(path.join('path','to','file.txt'));

  # Retrieves the reference directory for the relative paths
  referenceDir: () ->
    homeDir = process.env.HOME or process.env.HOMEPATH or process.env.USERPROFILE
    atom.project.getPath() or homeDir

  # Resolves the path being inputted in the dialog, up to the last slash
  inputPath: () ->
    input = @getLastSearchedFile()
    path.join @referenceDir(), input.substr(0, input.lastIndexOf(path.sep))

  inputFullPath: () ->
    input = @getLastSearchedFile()
    path.join @referenceDir(), input

  getLastSearchedFile: () ->
    input = @miniEditor.getEditor().getText()
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
          caseSensitive = atom.config.get 'advanced-new-file.caseSensitiveAutoCompletion'

          if not caseSensitive
            fragment = fragment.toLowerCase()

          matches =
            caseSensitive and filename.indexOf(fragment) is 0 or
            not caseSensitive and filename.toLowerCase().indexOf(fragment) is 0

          if matches
            isDir = fs.statSync(path.join(@inputPath(), filename)).isDirectory()
            (if isDir then dirList else fileList).push name:filename, isDir:isDir

        if atom.config.get 'advanced-new-file.showFilesInAutoComplete'
          callback.apply @, [dirList.concat fileList]
        else
          callback.apply @, [dirList]

  # Called only when pressing Tab to trigger auto-completion
  autocomplete: (str) ->
    @getFileList (files) ->
      newString = str
      oldInputText = @miniEditor.getEditor().getText()
      indexOfString = oldInputText.lastIndexOf(str)
      textWithoutSuggestion = oldInputText.substring(0, indexOfString)
      if files?.length is 1
        newPath = path.join(@inputPath(), files[0].name)

        suffix = if files[0].isDir then '/' else ''

        @updatePath(newPath + suffix, textWithoutSuggestion)

      else if files?.length > 1
        longestPrefix = @longestCommonPrefix((file.name for file in files))
        newPath = path.join(@inputPath(), longestPrefix)

        if (newPath.length > @inputFullPath().length)
          @updatePath(newPath, textWithoutSuggestion)
        else
          atom.beep()
      else
        atom.beep()

  updatePath: (newPath, oldPath) ->
    relativePath = oldPath + atom.project.relativize(newPath)
    @miniEditor.getEditor().setText relativePath


  update: ->
    @getFileList (files) ->
      @renderAutocompleteList files

    if /\/$/.test @miniEditor.getEditor().getText()
      @setMessage 'file-directory-create'
    else
      @setMessage 'file-add'

  setMessage: (icon, str) ->
    @message.removeClass 'icon'\
      + ' icon-file-add'\
      + ' icon-file-directory-create'\
      + ' icon-alert'
    if icon? then @message.addClass 'icon icon-' + icon
    @message.text str or "Enter the path for the new file/directory. Directories end with a '" + path.sep + "'."

  # Renders the list of directories
  renderAutocompleteList: (files) ->
    @directoryList.empty()
    files?.forEach (file) =>
      icon = if file.isDir then 'icon-file-directory' else 'icon-file-text'
      @directoryList.append $$ ->
        @li class: 'list-item', =>
          @span class: "icon #{icon}", file.name

  confirm: ->
    relativePaths = @miniEditor.getEditor().getText().split(@PATH_SEPARATOR)

    for relativePath in relativePaths
      pathToCreate = path.join(@referenceDir(), relativePath)
      try
        if /\/$/.test(pathToCreate)
          mkdirp pathToCreate
        else
          atom.open pathsToOpen: [pathToCreate], newWindow: false
      catch error
        @setMessage 'alert', error.message

    @detach()

  detach: ->
    return unless @hasParent()
    @detaching = true
    @miniEditor.getEditor().setText ''
    @setMessage()
    @directoryList.empty()
    miniEditorFocused = @miniEditor.isFocused

    super

    @restoreFocus() if miniEditorFocused
    @detaching = false

  attach: ->
    @suggestPath()
    @previouslyFocusedElement = $(':focus')
    atom.workspaceView.append(this)

    @on 'core:confirm', => @confirm()
    @on 'core:cancel', => @detach()
    @miniEditor.hiddenInput.on 'focusout', => @detach() unless @detaching

    consumeKeypress = (ev) => ev.preventDefault(); ev.stopPropagation()

    # Populate the directory listing live
    @miniEditor.getEditor().getBuffer().on 'changed', (ev) => @update()

    # Consume the keydown event from holding down the Tab key
    @miniEditor.on 'keydown', (ev) => if ev.keyCode is 9 then consumeKeypress ev

    # Handle the Tab completion
    @miniEditor.on 'keyup', (ev) =>
      if ev.keyCode is 9
        consumeKeypress ev
        pathToComplete = @getLastSearchedFile()
        @autocomplete pathToComplete
    @miniEditor.focus()
    @getFileList (files) -> @renderAutocompleteList files

  suggestPath: ->
    if atom.config.get 'advanced-new-file.suggestCurrentFilePath'
      activePath = atom.workspace.getActiveEditor()?.getPath()
      if activePath
        activeDir = path.dirname(activePath) + '/'
        suggestedPath = path.relative @referenceDir(), activeDir
        @miniEditor.getEditor().setText suggestedPath + '/'

  toggle: ->
    if @hasParent()
      @detach()
    else
      @attach()

  restoreFocus: ->
    if @previouslyFocusedElement?.isOnDom()
      @previouslyFocusedElement.focus()
    else
      atom.workspaceView.focus()

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
