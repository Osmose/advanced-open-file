/** @babel */

import {Emitter} from 'event-kit';

import {Path} from './models';
import {cachedProperty, closest, dom} from './utils';


export default class AdvancedOpenFileView {
    constructor() {
        this.emitter = new Emitter();
        this.cursorIndex = null;
        this._updatingPath = false;

        // Element references
        this.pathInput = this.content.querySelector('.path-input');
        this.pathList = this.content.querySelector('.list-group');
        this.parentDirectoryListItem = this.content.querySelector('.parent-directory');

        // Initialize text editor
        this.pathEditor = this.pathInput.getModel();
        this.pathEditor.setPlaceholderText('/path/to/file.txt');
        this.pathEditor.setSoftWrapped(false);

        this.content.addEventListener('click', (ev) => {
            // Keep focus on the text input and do not propagate so that the
            // outside click handler doesn't pick up the event.
            ev.stopPropagation();
            this.pathInput.focus();
        });
        this.content.addEventListener('click', (ev) => {
            let listItem = ev.target::closest('.list-item');
            if (listItem !== null) {
                this.emitter.emit('did-click-file', listItem.dataset.fileName);
            }
        });
        this.content.addEventListener('click', (ev) => {
            if (ev.target::closest('.add-project-folder') !== null) {
                let listItem = ev.target::closest('.list-item');
                this.emitter.emit('did-click-add-project-folder', listItem.dataset.fileName);
            }
        });
    }

    @cachedProperty
    get content() {
        return dom(`
            <div class="advanced-open-file">
                <p class="info-message icon icon-file-add">
                    Enter the path for the file to open or create.
                </p>
                <atom-text-editor class="path-input" mini></atom-text-editor>
                <ul class="list-group">
                    <li class="list-item parent-directory">
                        <span class="icon icon-file-directory">..</span>
                    </li>
                </ul>
            </div>
        `);
    }

    createPathListItem(path) {
        let icon = path.isDirectory() ? 'icon-file-directory' : 'icon-file-text';
        return `
            <li class="list-item ${path.isDirectory() ? 'directory' : ''}"
                data-file-name="${path.full}">
                <span class="filename icon ${icon}"
                      data-name="${path.fragment}">
                    ${path.fragment}
                </span>
                ${path.isDirectory() && !path.isProjectDirectory()
                    ? this.addProjectButton()
                    : ''}
            </li>
        `;
    }

    addProjectButton() {
        return `
            <span class="add-project-folder icon icon-plus"
                title="Open as project folder">
            </span>
        `;
    }

    createModalPanel() {
        let panel = atom.workspace.addModalPanel({
            item: this.content,
        });

        // Bind the outside click handler and destroy it when the panel is
        // destroyed.
        let outsideClickHandler = (ev) => {
            if (ev.target::closest('.advanced-open-file') === null) {
                this.emitter.emit('did-click-outside');
            }
        };

        document.documentElement.addEventListener('click', outsideClickHandler);
        panel.onDidDestroy(() => {
            document.documentElement.removeEventListener('click', outsideClickHandler);
        });

        let modal = this.content.parentNode;
        modal.style.maxHeight = '100%';
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';

        this.pathInput.focus();

        return panel;
    }

    onDidClickFile(callback) {
        this.emitter.on('did-click-file', callback);
    }

    onDidClickAddProjectFolder(callback) {
        this.emitter.on('did-click-add-project-folder', callback);
    }

    onDidClickOutside(callback) {
        this.emitter.on('did-click-outside', callback);
    }

    /**
     * Subscribe to user-initiated changes in the path.
     */
    onDidPathChange(callback) {
        this.pathEditor.onDidChange(() => {
            if (!this._updatingPath) {
                callback(new Path(this.pathEditor.getText()));
            }
        });
    }

    selectedPath() {
        if (this.cursorIndex !== null) {
            let selected = this.pathList.querySelector('.list-item.selected');
            if (selected !== null) {
                return new Path(selected.dataset.fileName);
            }
        }

        return null;
    }

    firstPath() {
        let pathItems = this.pathList.querySelectorAll('.list-item:not(.parent-directory)');
        if (pathItems.length > 0) {
            return new Path(pathItems[0].dataset.fileName);
        } else {
            return null;
        }
    }

    pathListLength() {
        return this.pathList.querySelectorAll('.list-item:not(.hidden)').length;
    }

    setPath(path) {
        this._updatingPath = true;

        this.pathEditor.setText(path.full);
        this.pathEditor.scrollToCursorPosition();

        this.parentDirectoryListItem.dataset.fileName = path.parent().full;

        this._updatingPath = false;
    }

    forEachListItem(selector, callback) {
        Array.from(this.pathList.querySelectorAll(selector)).forEach(callback);
    }

    setPathList(paths, hideParent=false) {
        this.cursorIndex = null;

        this.forEachListItem('.list-item.selected', (listItem) => {
            listItem.classList.remove('selected');
        });

        this.forEachListItem('.list-item:not(.parent-directory)', (listItem) => {
            listItem.remove();
        });

        if (paths.length === 0 || hideParent) {
            this.parentDirectoryListItem.classList.add('hidden');
        } else {
            this.parentDirectoryListItem.classList.remove('hidden');
        }

        if (paths.length > 0) {
            // Split list into directories and files and sort them.
            paths = paths.sort(Path.compare);
            let directoryPaths = paths.filter((path) => path.isDirectory());
            let filePaths = paths.filter((path) => path.isFile());

            for (path of directoryPaths) {
                if (path.exists()) {
                    this.pathList.appendChild(dom(this.createPathListItem(path)));
                }
            }

            for (path of filePaths) {
                if (path.exists()) {
                    this.pathList.appendChild(dom(this.createPathListItem(path)));
                }
            }
        }
    }

    setCursorIndex(index) {
        if (index < 0 || index >= this.pathListLength()) {
            index = null;
        }

        this.cursorIndex = index;
        this.forEachListItem('.list-item.selected', (listItem) => {
            listItem.classList.remove('selected');
        });

        if (this.cursorIndex !== null) {
            let listItems = this.pathList.querySelectorAll('.list-item:not(.hidden)');
            if (listItems.length > index) {
                listItems[index].classList.add('selected');
            }
        }
    }
}
