/** @babel */
import {Disposable} from 'atom';
import {Emitter} from 'event-kit';

import * as config from './config';
import {Path} from './models';
import {cachedProperty, closest, dom} from './utils';

let addIconToElement = null;

/**
 * Consumer for file-icons
 * https://github.com/DanBrooker/file-icons
 */
export function consumeElementIcons(cb) {
    addIconToElement = cb;
    return new Disposable(() => {
        addIconToElement = null;
    });
}

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

        // Update the path list whenever the path changes.
        this.pathEditor.onDidChange(() => {
            let newPath = new Path(this.pathEditor.getText());

            this.parentDirectoryListItem.dataset.fileName = newPath.parent().full;

            this.setPathList(newPath.matchingPaths(), {
                hideParent: newPath.fragment !== '' || newPath.isRoot(),
                sort: !(config.get('fuzzyMatch') && newPath.fragment !== ''),
            });
        });

        this.content.addEventListener('click', (ev) => {
            // Keep focus on the text input and do not propagate so that the
            // outside click handler doesn't pick up the event.
            ev.stopPropagation();
            this.pathInput.focus();
        });

        this.content.addEventListener('click', (ev) => {
            if (ev.target::closest('.add-project-folder') !== null) {
                let listItem = ev.target::closest('.list-item');
                this.emitter.emit('did-click-add-project-folder', listItem.dataset.fileName);
                return; // Don't try to enter the folder too!
            }

            let listItem = ev.target::closest('.list-item');
            if (listItem !== null) {
                this.emitter.emit('did-click-file', listItem.dataset.fileName);
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
                <div class="path-input-container">
                    <atom-text-editor class="path-input" mini></atom-text-editor>
                </div>
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
        modal.style.maxHeight = `${document.body.clientHeight - modal.offsetTop}px`;
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';

        this.pathInput.focus();

        return panel;
    }

    /**
     * Re-render list item for the given path, if it exists.
     */
    refreshPathListItem(path) {
        let listItem = this.content.querySelector(`.list-item[data-file-name="${path.full}"]`);
        if (listItem) {
            let newListItem = dom(this.createPathListItem(path));
            listItem.parentNode.replaceChild(newListItem, listItem);
        }
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

        this._updatingPath = false;
    }

    forEachListItem(selector, callback) {
        let listItems = this.pathList.querySelectorAll(selector);
        for (let k = 0; k < listItems.length; k++) {
            callback(listItems[k]);
        }
    }

    setPathList(paths, {hideParent=false, sort=true}={}) {
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
            if (sort) {
                // Split list into directories and files and sort them.
                paths = paths.sort(Path.compare);
                let directoryPaths = paths.filter((path) => path.isDirectory());
                let filePaths = paths.filter((path) => path.isFile());
                this._appendToPathList(directoryPaths);
                this._appendToPathList(filePaths);
            } else {
                this._appendToPathList(paths);
            }
        }
    }

    _appendToPathList(paths) {
        for (let path of paths) {
            if (path.exists()) {
                let listItem = dom(this.createPathListItem(path));
                if (addIconToElement) {
                    let filenameElement = listItem.querySelector('.filename.icon');
                    filenameElement.classList.remove('icon-file-text', 'icon-file-directory');
                    addIconToElement(filenameElement, path.absolute);
                }
                this.pathList.appendChild(listItem);
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
                let selected = listItems[index];
                selected.classList.add('selected');

                // If the selected element is out of view, scroll it into view.
                let parentElement = selected.parentElement;
                let selectedTop = selected.offsetTop;
                let parentScrollBottom = parentElement.scrollTop + parentElement.clientHeight;
                if (selectedTop < parentElement.scrollTop) {
                    parentElement.scrollTop = selectedTop;
                } else if (selectedTop >= parentScrollBottom) {
                    let selectedBottom = selectedTop + selected.clientHeight;
                    parentElement.scrollTop += selectedBottom - parentScrollBottom;
                }
            }
        }
    }
}
