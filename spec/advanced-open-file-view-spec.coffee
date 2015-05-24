AdvancedFileView = require '../lib/advanced-open-file-view'

describe "AdvancedFileView", ->
  workSpaceElement = null
  beforeEach ->
    workSpaceElement = atom.views.getView(atom.workspace)

    waitsForPromise ->
     atom.packages.activatePackage('keybinding-resolver')

  describe "when the advanced-open-file:toggle event is triggered", ->
      it "attaches and detaches the view", ->
          expect(workSpaceElement.querySelector('.advanced-open-file')).not.toExist();

          atom.commands.dispatch workSpaceElement, 'advanced-open-file:toggle'
          expect(workSpaceElement.querySelector('.advanced-open-file')).toExist();

          atom.commands.dispatch workSpaceElement, 'advanced-open-file:toggle'
          expect(workSpaceElement.querySelector('.advanced-open-file')).not.toExist();

          atom.commands.dispatch workSpaceElement, 'key-binding-resolver:toggle'
          expect(workSpaceElement.querySelector('.key-binding-resolver')).toExist()
