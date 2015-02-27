AdvancedFileView = require '../lib/advanced-new-file-view'

describe "AdvancedFileView", ->
  workSpaceElement = null
  beforeEach ->
    workSpaceElement = atom.views.getView(atom.workspace)

    waitsForPromise ->
     atom.packages.activatePackage('keybinding-resolver')

  describe "when the advanced-new-file:toggle event is triggered", ->
      it "attaches and detaches the view", ->
          expect(workSpaceElement.querySelector('.advanced-new-file')).not.toExist();
          
          atom.commands.dispatch workSpaceElement, 'advanced-new-file:toggle'
          expect(workSpaceElement.querySelector('.advanced-new-file')).toExist();

          atom.commands.dispatch workSpaceElement, 'advanced-new-file:toggle'
          expect(workSpaceElement.querySelector('.advanced-new-file')).not.toExist();

          atom.commands.dispatch workSpaceElement, 'key-binding-resolver:toggle'
          expect(workSpaceElement.querySelector('.key-binding-resolver')).toExist()
