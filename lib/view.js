/** @babel */
import classNames from 'classnames';
import {Emitter} from 'event-kit';
import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import Infinite from '../vendor/react-infinite';

import * as config from './config';
import fileService from './file-service';
import {Path} from './models';
import {cachedProperty, closest, padding, splitByTest} from './utils';


/**
 * Interface used by the controller to interact with the UI. Internally uses
 * React to render the UI and store the UI state.
 */
export default class AdvancedOpenFileView {
    constructor() {
        this.emitter = new Emitter();

        this.contentContainer = document.createElement('div');
        this.content = ReactDOM.render(
            <AdvancedOpenFileContent emitter={this.emitter} />,
            this.contentContainer
        );

        // Keep focus on the text input.
        this.contentContainer.addEventListener('click', ev => {
            this.content.focusPathInput();
        });
    }

    get selectedPath() {
        let {path, selectedIndex} = this.content.state;
        if (selectedIndex === null) {
            return null;
        } else {
            return this.content.matchingPaths[selectedIndex];
        }
    }

    get firstPath() {
        let matchingPaths = this.content.matchingPaths;
        if (matchingPaths.length > 0) {
            return matchingPaths[0];
        } else {
            return null;
        }
    }

    onDidClickPath(callback) {
        this.emitter.on('did-click-path', callback);
    }

    onDidClickAddProjectFolder(callback) {
        this.emitter.on('did-click-add-project-folder', callback);
    }

    onDidClickOutside(callback) {
        this.emitter.on('did-click-outside', callback);
    }

    onDidPathChange(callback) {
        this.emitter.on('did-path-change', callback);
    }

    setPath(path) {
        this.content.setState({path: path, selectedIndex: null});
    }

    moveCursorDown() {
        this.content.setState((state, props) => {
            let index = state.selectedIndex;
            if (index === null || index === this.content.matchingPaths.length - 1) {
                index = 0;
            } else {
                index++;
            }

            return {selectedIndex: index};
        });
    }

    moveCursorUp() {
        this.content.setState((state, props) => {
            let index = state.selectedIndex;
            if (index === null || index === 0) {
                index = this.content.matchingPaths.length - 1;
            } else {
                index--;
            }

            return {selectedIndex: index};
        });
    }

    createModalPanel(visible=true) {
        let panel = atom.workspace.addModalPanel({
            item: this.contentContainer,
            visible: visible
        });

        // Bind the outside click handler and destroy it when the panel is
        // destroyed.
        let outsideClickHandler = ev => {
            if (ev.target::closest('.advanced-open-file') === null) {
                this.emitter.emit('did-click-outside');
            }
        };

        document.documentElement.addEventListener('click', outsideClickHandler);
        panel.onDidDestroy(() => {
            document.documentElement.removeEventListener('click', outsideClickHandler);
        });

        let modal = this.contentContainer.parentNode;
        modal.style.maxHeight = `${document.body.clientHeight - modal.offsetTop}px`;
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';

        this.content.focusPathInput();
        this.content.movePathInputToEndOfLine();

        return panel;
    }
}


export class AdvancedOpenFileContent extends Component {
    constructor(props) {
        super(props);

        this.itemHeight = null;
        this.maxListHeight = null;
        this.state = {
            path: Path.initial(),
            selectedIndex: null,
        };

        // Cache matching paths in an attribute.
        this.matchingPaths = fileService.getMatchingPaths(this.state.path);
    }

    componentWillUpdate(props, state) {
        this.updateMatchingPaths(state.path);
    }

    updateMatchingPaths(path) {
        let matchingPaths = fileService.getMatchingPaths(path).slice();

        if (!config.get('fuzzyMatch')) {
            matchingPaths = matchingPaths.sort(Path.compare);
            let [directories, files] = splitByTest(
                matchingPaths,
                p => fileService.isDirectory(p)
            );
            matchingPaths = directories.concat(files);
        }

        let hideParent = (
            !path.full
            || (path.fragment && matchingPaths.length > 0)
            || path.isRoot()
        );
        if (!hideParent) {
            let parent = path.parent();
            parent.displayAsParent = true;
            matchingPaths.unshift(parent);
        }

        this.matchingPaths = matchingPaths;
    }

    componentDidUpdate() {
        if (this.itemHeight > 0 && this.maxListHeight > 0) {
            return;
        } else {
            this.calculateListHeights();
        }
    }

    calculateListHeights() {
        let el = ReactDOM.findDOMNode(this);
        let panel = el::closest('.modal');
        let list = el.querySelector('.list-group');
        let listItem = el.querySelector('.list-item');
        if (panel && list && listItem) {
            // The maximum list height is from where it starts to the bottom of
            // the screen, _minus_ the padding from the modal panel around it.
            let panelBottomPadding = (
                panel.getBoundingClientRect().bottom
                - list.getBoundingClientRect().bottom
                + panel::padding('bottom')
            );
            this.maxListHeight = (
                document.body.clientHeight - list.offsetTop - panelBottomPadding
            );
            this.itemHeight = listItem.offsetHeight;
        }
    }

    render() {
        let {path, selectedIndex} = this.state;

        return (
            <div className="advanced-open-file">
                <p className="info-message icon icon-file-add">
                    Enter the path for the file to open or create.
                </p>
                <PathInput
                    ref="pathInput"
                    path={path}
                    onChange={::this.handlePathInputChange}
                />
                <MatchingPathList
                    ref="pathList"
                    path={path}
                    selectedIndex={selectedIndex}
                    matchingPaths={this.matchingPaths}
                    itemHeight={this.itemHeight}
                    maxListHeight={this.maxListHeight}
                    onClickPath={::this.handleClickPath}
                    onClickAddProjectFolder={::this.handleClickAddProjectFolder}
                />
            </div>
        );
    }

    handlePathInputChange(newText) {
        let newPath = new Path(newText);
        this.setState({path: newPath, selectedIndex: null});
        this.props.emitter.emit('did-path-change', newPath);
    }

    handleClickPath(path) {
        this.props.emitter.emit('did-click-path', path);
    }

    handleClickAddProjectFolder(path) {
        this.props.emitter.emit('did-click-add-project-folder', path);
    }

    focusPathInput() {
        this.refs.pathInput.focus();
    }

    movePathInputToEndOfLine() {
        this.refs.pathInput.moveToEndOfLine();
    }
}


export class PathInput extends Component {
    constructor(props) {
        super(props);

        // Used to disable the onChange callback when reacting to prop
        // changes, which aren't user-initiated and shouldn't trigger it.
        this.disableOnChange = false;
    }

    componentDidMount() {
        this.textEditor = this.refs.textEditor.getModel();
        this.textEditor.onDidChange(::this.handleChange);
    }

    componentDidUpdate() {
        this.disableOnChange = true;

        // Preserve cursor position adding the difference between the old and
        // new text to the current position and moving it there.
        let oldLength = this.textEditor.getText().length;
        let oldCoords = this.textEditor.getCursorBufferPosition();
        let newLength = this.props.path.full.length;
        let newColumn = Math.max(0, oldCoords.column + (newLength - oldLength))

        this.textEditor.setText(this.props.path.full);
        this.textEditor.setCursorBufferPosition([oldCoords.row, newColumn]);

        this.disableOnChange = false;
    }

    render() {
        let {path} = this.props;

        // We use class instead of className due to
        // https://github.com/facebook/react/issues/4933
        return (
            <div className="path-input-container">
                <atom-text-editor
                    ref="textEditor"
                    class="path-input"
                    placeholder-text="/path/to/file.txt"
                    mini
                />
            </div>
        );
    }

    handleChange() {
        if (!this.disableOnChange) {
            this.props.onChange(this.textEditor.getText());
        }
    }

    focus() {
        this.refs.textEditor.focus();
    }

    moveToEndOfLine() {
        this.textEditor.moveToEndOfLine();
    }
}


export class MatchingPathList extends Component {
    componentDidUpdate() {
        // Remove existing highlights
        let listGroup = ReactDOM.findDOMNode(this.refs.listGroup);
        let items = Array.from(listGroup.querySelectorAll('.selected'));
        for (let item of items) {
            item.classList.remove('selected');
        }

        // Highlight the selected list item.
        let {selectedIndex, matchingPaths} = this.props;
        if (selectedIndex !== null) {
            let selectedPath = matchingPaths[selectedIndex];
            let listItem = listGroup.querySelector(`[data-file-name="${selectedPath.full}"]`);
            if (listItem) {
                listItem.classList.add('selected');
            }
        }
    }

    render() {
        let {
            path,
            matchingPaths,
            onClickPath,
            onClickAddProjectFolder,
            itemHeight,
            maxListHeight
        } = this.props;

        let listItems = matchingPaths.map(path => (
            <PathListItem
                key={path.full}
                path={path}
                onClick={onClickPath}
                onClickAddProjectFolder={onClickAddProjectFolder}
            />
        ));

        // Wrap the list in an Infinite container if we have the heights needed.
        if (itemHeight > 0 && maxListHeight > 0) {
            let containerHeight = Math.min(itemHeight * listItems.length, maxListHeight);
            listItems = (
                <Infinite containerHeight={containerHeight} elementHeight={itemHeight}>
                    {listItems}
                </Infinite>
            );
        }

        return (
            <div className="list-group" ref="listGroup">
                {listItems}
            </div>
        );
    }
}


export class PathListItem extends Component {
    render() {
        let {path, onClickAddProjectFolder} = this.props;
        let className = classNames('list-item', {
            directory: fileService.isDirectory(path),
            parent: path.displayAsParent
        });

        return (
            <div className={className} onClick={::this.handleClick} data-file-name={path.full}>
                <PathListItemLabel path={path} />
                <AddProjectFolderButton
                    path={path}
                    onClick={::this.handleClickAddProjectFolder}
                />
            </div>
        );
    }

    handleClick() {
        this.props.onClick(this.props.path);
    }

    handleClickAddProjectFolder(event) {
        event.stopPropagation();
        this.props.onClickAddProjectFolder(this.props.path);

        // Currently the path's status as a project folder isn't a prop or
        // state, so React doesn't know to re-render due to this.
        this.forceUpdate();
    }
}


export function PathListItemLabel({path}) {
    let icon = fileService.isDirectory(path) ? 'icon-file-directory' : 'icon-file-text';
    let className = classNames('filename', 'icon', icon);

    return (
        <span className={className} data-name={path.fragment}>
            {path.displayAsParent ? '..' : path.fragment}
        </span>
    )
}


export function AddProjectFolderButton({path, onClick}) {
    if (!fileService.isDirectory(path) || path.isProjectDirectory() || path.displayAsParent) {
        return null;
    }

    return (
        <span
            className="add-project-folder icon icon-plus"
            title="Open as project folder"
            onClick={onClick}
        />
    );
}
