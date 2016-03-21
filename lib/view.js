/** @babel */
import classNames from 'classnames';
import {Emitter} from 'event-kit';
import {React, ReactDOM} from 'react-for-atom';

import * as config from './config';
import {Path} from './models';
import {cachedProperty, closest, splitByTest} from './utils';

const {Component} = React;


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

    createModalPanel() {
        let panel = atom.workspace.addModalPanel({
            item: this.contentContainer,
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

        this.state = {
            path: Path.initial(),
            selectedIndex: null,
        };

        // Cache matching paths in an attribute.
        this.matchingPaths = this.state.path.matchingPaths();
    }

    componentWillUpdate(props, state) {
        let {path} = state;
        let matchingPaths = path.matchingPaths();

        if (!config.get('fuzzyMatch')) {
            matchingPaths = matchingPaths.sort(Path.compare);
            let [directories, files] = splitByTest(matchingPaths, p => p.isDirectory());
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
                    onClickPath={::this.handleClickPath}
                    onClickAddProjectFolder={::this.handleClickAddProjectFolder}
                />
            </div>
        );
    }

    handlePathInputChange(newText) {
        let newPath = new Path(newText);
        this.setState({path: newPath});
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
        let items = Array.from(this.refs.listGroup.querySelectorAll('.selected'));
        for (let item of items) {
            item.classList.remove('selected');
        }

        // Highlight the selected list item.
        let {selectedIndex} = this.props;
        if (selectedIndex !== null) {
            this.refs.listGroup.children[selectedIndex].classList.add('selected');
        }
    }

    render() {
        let {path, matchingPaths, onClickPath, onClickAddProjectFolder} = this.props;
        let listItems = matchingPaths.map(path => (
            <PathListItem
                key={path.full}
                path={path}
                onClick={onClickPath}
                onClickAddProjectFolder={onClickAddProjectFolder}
            />
        ));

        return (
            <ul className="list-group" ref="listGroup">
                {listItems}
            </ul>
        );
    }
}


export class PathListItem extends Component {
    render() {
        let {path, onClickAddProjectFolder} = this.props;
        let icon = path.isDirectory() ? 'icon-file-directory' : 'icon-file-text';

        let addProjectFolderButton = '';
        if (path.isDirectory() && !path.isProjectDirectory() && !path.displayAsParent) {
            addProjectFolderButton = <AddProjectFolderButton onClick={::this.handleClickAddProjectFolder} />;
        }

        let liClassName = classNames('list-item', {
            directory: path.isDirectory(),
            parent: path.displayAsParent
        });
        let spanClassName = classNames('filename', 'icon', icon);

        return (
            <li className={liClassName} onClick={::this.handleClick} data-file-name={path.full}>
                <span className={spanClassName} data-name={path.fragment}>
                    {path.displayAsParent ? '..' : path.fragment}
                </span>
                {addProjectFolderButton}
            </li>
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


export function AddProjectFolderButton({onClick}) {
    return (
        <span
            className="add-project-folder icon icon-plus"
            title="Open as project folder"
            onClick={onClick}
        />
    );
}
