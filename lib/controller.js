/** @babel */

import stdPath from 'path';

import {Emitter} from 'event-kit';
import osenv from 'osenv';

import AdvancedOpenFileView from './view';
import {Path} from './models';
import {getProjectPath} from './utils';


// Emitter for outside packages to subscribe to. Subscription functions
// are exponsed in ./advanced-open-file
export let emitter = new Emitter();


export class AdvancedOpenFileController {
    constructor() {
        this.view = new AdvancedOpenFileView();
        this.panel = null;

        this.currentPath = null;
        this.pathHistory = [];

        atom.commands.add('atom-workspace', {
            'advanced-open-file:toggle': ::this.toggle
        });
        atom.commands.add('.advanced-open-file', {
            'core:confirm': ::this.confirm,
            'core:cancel': ::this.detach,
            'advanced-open-file:autocomplete': ::this.autocomplete,
            'advanced-open-file:undo': ::this.undo,
            'advanced-open-file:move-cursor-down': ::this.moveCursorDown,
            'advanced-open-file:move-cursor-up': ::this.moveCursorUp,
            'advanced-open-file:confirm-selected-or-first': ::this.confirmSelectedOrFirst,
            'advanced-open-file:delete-path-component': ::this.deletePathComponent,
        });

        this.view.onDidClickFile(::this.clickFile);
        this.view.onDidClickAddProjectFolder(::this.addProjectFolder);
        this.view.onDidClickOutside(::this.detach);
        this.view.onDidPathChange(::this.pathChange);
    }

    clickFile(fileName) {
        this.selectPath(new Path(fileName));
    }

    pathChange(newPath)  {
        let saveHistory = false;

        // Since the user typed this, apply fast-dir-switch
        // shortcuts.
        if (atom.config.get('advanced-open-file.helmDirSwitch')) {
            if (newPath.directory.endsWith(newPath.sep + newPath.sep)) {
                newPath = newPath.root();
                saveHistory = true;
            } else if (newPath.directory.endsWith('~' + newPath.sep)) {
                newPath = new Path(osenv.home() + stdPath.sep);
                saveHistory = true;
            } else if (newPath.directory.endsWith(':' + newPath.sep)) {
                let projectPath = getProjectPath();
                if (projectPath) {
                    newPath = new Path(projectPath + newPath.sep);
                    saveHistory = true;
                }
            }
        }

        this.updatePath(newPath, {saveHistory: saveHistory});
    }

    selectPath(newPath) {
        if (newPath.isDirectory()) {
            this.updatePath(newPath.asDirectory());
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

        // Hide parent if fragment isn't empty.
        let hideParent = newPath.fragment !== '';
        this.view.setPathList(newPath.matchingPaths(), hideParent);
    }

    openPath(path) {
        if (path.exists()) {
            if (path.isFile()) {
                atom.workspace.open(path.full);
                emitter.emit('did-open-path', path.full);
                this.detach();
            } else {
                atom.beep();
            }
        } else if (path.fragment) {
            path.createDirectories();
            if (atom.config.get('advanced-open-file.createFileInstantly')) {
                path.createFile();
                emitter.emit('did-create-path', path.full);
            }
            atom.workspace.open(path.full);
            emitter.emit('did-open-path', path.full);
            this.detach();
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
        if (folderPath.isDirectory()) {
            atom.project.addPath(folderPath.full);
            this.detach();
        }
    }

    /**
     * Autocomplete the current input to the longest common prefix among
     * paths matching the current input. If no change is made to the
     * current path, beep.
     */
    autocomplete() {
        let matchingPaths = this.currentPath.matchingPaths(true);
        if (matchingPaths.length === 0) {
            atom.beep();
        } else if (matchingPaths.length === 1) {
            let newPath = matchingPaths[0];
            if (newPath.isDirectory()) {
                this.updatePath(newPath.asDirectory());
            } else {
                this.updatePath(newPath);
            }
        } else {
            let newPath = Path.commonPrefix(matchingPaths, true);
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

    confirm() {
        let selectedPath = this.view.selectedPath();
        if (selectedPath !== null) {
            this.selectPath(selectedPath);
        } else {
            this.selectPath(this.currentPath);
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

        this.pathHistory = [];
        this.updatePath(Path.initial(), {saveHistory: false});
        this.panel = this.view.createModalPanel();
    }
}
