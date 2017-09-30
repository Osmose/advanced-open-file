/** @babel */

import stdPath from 'path';

import {CompositeDisposable} from 'atom';

import {Emitter} from 'event-kit';
import osenv from 'osenv';

import * as config from './config';
import {Path} from './models';
import {getProjectPath} from './utils';
import AdvancedOpenFileView from './view';


// Emitter for outside packages to subscribe to. Subscription functions
// are exponsed in ./advanced-open-file
export let emitter = new Emitter();


export class AdvancedOpenFileController {
    constructor() {
        this.view = new AdvancedOpenFileView();
        this.panel = null;

        this.currentPath = null;
        this.pathHistory = [];
        this.disposables = new CompositeDisposable();

        this.disposables.add(atom.commands.add('atom-workspace', {
            'advanced-open-file:toggle': ::this.toggle
        }));
        this.disposables.add(atom.commands.add('.advanced-open-file', {
            'core:confirm': ::this.confirm,
            'core:cancel': ::this.detach,
            'application:add-project-folder': ::this.addSelectedProjectFolder,
            'advanced-open-file:autocomplete': ::this.autocomplete,
            'advanced-open-file:undo': ::this.undo,
            'advanced-open-file:move-cursor-down': ::this.moveCursorDown,
            'advanced-open-file:move-cursor-up': ::this.moveCursorUp,
            'advanced-open-file:move-cursor-bottom': ::this.moveCursorBottom,
            'advanced-open-file:move-cursor-top': ::this.moveCursorTop,
            'advanced-open-file:confirm-selected-or-first': ::this.confirmSelectedOrFirst,
            'advanced-open-file:delete-path-component': ::this.deletePathComponent,

            'pane:split-left': this.splitConfirm((pane) => pane.splitLeft()),
            'pane:split-right': this.splitConfirm((pane) => pane.splitRight()),
            'pane:split-up': this.splitConfirm((pane) => pane.splitUp()),
            'pane:split-down': this.splitConfirm((pane) => pane.splitDown()),
        }));

        this.view.onDidClickFile(::this.clickFile);
        this.view.onDidClickAddProjectFolder(::this.addProjectFolder);
        this.view.onDidClickOutside(::this.detach);
        this.view.onDidPathChange(::this.pathChange);
    }

    destroy() {
        this.disposables.dispose();
    }

    clickFile(fileName) {
        this.selectPath(new Path(fileName));
    }

    pathChange(newPath)  {
        this.currentPath = newPath;

        let replace = false;

        // Since the user typed this, apply fast-dir-switch
        // shortcuts.
        if (config.get('helmDirSwitch')) {
            if (newPath.hasShortcut('')) {  // Empty shortcut == '//'
                newPath = newPath.root();
                replace = true;
            } else if (newPath.hasShortcut('~')) {
                newPath = new Path(osenv.home() + stdPath.sep);
                replace = true;
            } else if (newPath.hasShortcut(':')) {
                let projectPath = getProjectPath();
                if (projectPath) {
                    newPath = new Path(projectPath + newPath.sep);
                    replace = true;
                }
            }
        }

        // If we're replacing the path, save it in the history and set the path.
        // If we aren't, the user is just typing and we don't need the history
        // and want to avoid setting the path which resets the cursor.
        if (replace) {
            this.updatePath(newPath);
        }
    }

    selectPath(newPath, split=false) {
        if (newPath.isDirectory()) {
            if (split !== false) {
                atom.beep();
            } else {
                this.updatePath(newPath.asDirectory());
            }
        } else if (split !== false) {
            this.splitOpenPath(newPath, split);
        } else {
            this.openPath(newPath);
        }
    }

    updatePath(newPath, {saveHistory=true}={}) {
        if (saveHistory) {
            this.pathHistory.push(this.currentPath);
        }

        this.currentPath = newPath;
        this.view.setPath(newPath);
    }

    splitOpenPath(path, split) {
        split(atom.workspace.getActivePane());
        this.openPath(path);
    }

    openPath(path) {
        if (path.exists()) {
            if (path.isFile()) {
                atom.workspace.open(path.absolute);
                emitter.emit('did-open-path', path.absolute);
                this.detach();
            } else {
                atom.beep();
            }
        } else if (path.fragment) {
            try {
                path.createDirectories();
                if (config.get('createFileInstantly')) {
                    path.createFile();
                    emitter.emit('did-create-path', path.absolute);
                }
                atom.workspace.open(path.absolute);
                emitter.emit('did-open-path', path.absolute);
            } catch (err) {
                atom.notifications.addError('Could not open file', {
                    detail: err,
                    icon: 'alert',
                });
            } finally {
                this.detach();
            }
        } else if (config.get('createDirectories')) {
            try {
                path.createDirectories();
                atom.notifications.addSuccess('Directory created', {
                    detail: `Created directory "${path.full}".`,
                    icon: 'file-directory',
                });
                emitter.emit('did-create-path', path.absolute);
                this.detach();
            } catch (err) {
                atom.notifications.addError('Could not create directory', {
                    detail: err,
                    icon: 'file-directory',
                });
            } finally {
                this.detach();
            }
        } else {
            atom.beep();
        }
    }

    deletePathComponent() {
        if (this.currentPath.isRoot()) {
            atom.beep();
        } else {
            this.updatePath(this.currentPath.parent());
        }
    }

    addProjectFolder(fileName) {
        let folderPath = new Path(fileName);
        if (folderPath.isDirectory() && !folderPath.isProjectDirectory()) {
            atom.project.addPath(folderPath.absolute);
            atom.notifications.addSuccess('Added project folder', {
                detail: `Added "${folderPath.full}" as a project folder.`,
                icon: 'file-directory',
            });
            this.view.refreshPathListItem(folderPath);
        } else {
            atom.beep();
        }
    }

    addSelectedProjectFolder(event) {
        event.stopPropagation();

        let selectedPath = this.view.selectedPath();
        if (selectedPath == null && this.currentPath.isDirectory()) {
            this.addProjectFolder(this.currentPath.full);
        }
        else if (selectedPath !== null && !selectedPath.equals(this.currentPath.parent())) {
            this.addProjectFolder(selectedPath.full);
        } else {
            atom.beep();
        }
    }

    /**
     * Autocomplete the current input to the longest common prefix among
     * paths matching the current input. If no change is made to the
     * current path, beep.
     */
    autocomplete() {
        let matchingPaths = this.currentPath.matchingPaths();
        if (matchingPaths.length === 0) {
            atom.beep();
        } else if (matchingPaths.length === 1 || config.get('fuzzyMatch')) {
            let newPath = matchingPaths[0];
            if (newPath.isDirectory()) {
                this.updatePath(newPath.asDirectory());
            } else {
                this.updatePath(newPath);
            }
        } else {
            let newPath = Path.commonPrefix(matchingPaths);
            if (newPath.equals(this.currentPath)) {
                atom.beep();
            } else {
                this.updatePath(newPath);
            }
        }
    }

    toggle() {
        if (this.panel) {
            this.detach();
        } else {
            this.attach();
        }
    }

    splitConfirm(split) {
        return this.confirm.bind(this, undefined, split);
    }

    confirm(event, split=false) {
        let selectedPath = this.view.selectedPath();
        if (selectedPath !== null) {
            this.selectPath(selectedPath, split);
        } else {
            this.selectPath(this.currentPath, split);
        }
    }

    confirmSelectedOrFirst() {
        let selectedPath = this.view.selectedPath();
        if (selectedPath !== null) {
            this.selectPath(selectedPath);
        } else {
            let firstPath = this.view.firstPath();
            if (firstPath !== null) {
                this.selectPath(firstPath);
            } else {
                this.selectPath(this.currentPath)
            }
        }
    }

    undo() {
        if (this.pathHistory.length > 0) {
            this.updatePath(this.pathHistory.pop(), {saveHistory: false});
        } else {
            let initialPath = Path.initial();
            if (!this.currentPath.equals(initialPath)) {
                this.updatePath(initialPath, {saveHistory: false});
            } else {
                atom.beep();
            }
        }
    }

    moveCursorDown() {
        let index = this.view.cursorIndex;
        if (index === null || index === this.view.pathListLength() - 1) {
            index = 0;
        } else {
            index++;
        }

        this.view.setCursorIndex(index);
    }

    moveCursorUp() {
        let index = this.view.cursorIndex;
        if (index === null || index === 0) {
            index = this.view.pathListLength() - 1;
        } else {
            index--;
        }

        this.view.setCursorIndex(index);
    }

    moveCursorTop() {
        this.view.setCursorIndex(0);
    }

    moveCursorBottom() {
        this.view.setCursorIndex(this.view.pathListLength() - 1);
    }

    detach() {
        if (this.panel === null) {
            return;
        }

        this.panel.destroy();
        this.panel = null;
        atom.workspace.getActivePane().activate();
    }

    attach() {
        if (this.panel !== null) {
            return;
        }

        let initialPath = Path.initial();
        this.pathHistory = [];
        this.currentPath = initialPath;
        this.updatePath(Path.initial(), {saveHistory: false});
        this.panel = this.view.createModalPanel();
    }
}
