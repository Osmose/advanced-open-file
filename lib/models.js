/** @babel */

import fs from 'fs';
import stdPath from 'path';

import mkdirp from 'mkdirp';
import touch from 'touch';

import {DEFAULT_ACTIVE_FILE_DIR, DEFAULT_PROJECT_ROOT} from './config';
import {
    absolutify,
    cachedProperty,
    defineImmutable,
    getProjectPath,
    preferredSeparatorFor
} from './utils';


/**
 * Wrapper for dealing with filesystem paths.
 */
export class Path {
    constructor(path='') {
        // The last path segment is the "fragment". Paths that end in a
        // separator have a blank fragment.
        let sep = preferredSeparatorFor(path);
        let parts = path.split(sep);
        let fragment = parts[parts.length - 1];
        let directory = path.substring(0, path.length - fragment.length);

        // Set non-writable properties.
        defineImmutable(this, 'directory', directory);
        defineImmutable(this, 'fragment', fragment);
        defineImmutable(this, 'full', path);
        defineImmutable(this, 'sep', sep);
    }

    @cachedProperty
    get stat() {
        try {
            return fs.statSync(absolutify(this.full));
        } catch (err) {
            if (err.code === 'ENOENT') {
                return null;
            } else {
                throw err;
            }
        }
    }

    isDirectory() {
        return this.stat ? this.stat.isDirectory() : null;
    }

    isFile() {
        return this.stat ? !this.stat.isDirectory() : null;
    }

    isProjectDirectory() {
        return atom.project.getPaths().indexOf(this.full) !== -1;
    }

    isRoot() {
        return stdPath.dirname(this.full) === this.full;
    }

    hasCaseSensitiveFragment() {
        return this.fragment !== '' && this.fragment !== this.fragment.toLowerCase();
    }

    exists() {
        return this.stat !== null;
    }

    asDirectory() {
        return new Path(this.full + (this.fragment ? this.sep : ''));
    }

    parent() {
        if (this.isRoot()) {
            return this;
        } else if (this.fragment) {
            return new Path(this.directory);
        } else {
            return new Path(stdPath.dirname(this.directory) + this.sep);
        }
    }

    /**
     * Return path for the root directory for the drive this path is on.
     */
    root() {
        let last = null;
        let current = this.full;
        while (current !== last) {
            last = current;
            current = stdPath.dirname(current);
        }

        return new Path(current);
    }

    /**
     * Create an empty file at the given path if it doesn't already exist.
     */
    createFile() {
        touch.sync(this.full);
    }

    /**
     * Create directories for the file this path points to, or do nothing
     * if they already exist.
     */
    createDirectories() {
        try {
            mkdirp.sync(this.directory);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }
    }

    matchingPaths(caseSensitive=null) {
        let absoluteDir = absolutify(this.directory);
        let filenames = null;

        try {
            filenames = fs.readdirSync(absoluteDir);
        } catch (err) {
            return []; // TODO: Catch permissions error and display a message.
        }

        if (this.fragment) {
            if (caseSensitive === null) {
                caseSensitive = this.hasCaseSensitiveFragment();
            }

            filenames = filenames.filter(
                (fn) => matchFragment(this.fragment, fn, caseSensitive)
            );
        }

        return filenames.map((fn) => new Path(this.directory + fn));
    }

    equals(otherPath) {
        return this.full === otherPath.full;
    }

    /**
     * Return the path to show initially in the path input.
     */
    static initial() {
        switch (atom.config.get('advanced-open-file.defaultInputValue')) {
            case DEFAULT_ACTIVE_FILE_DIR:
                let editor = atom.workspace.getActiveTextEditor();
                if (editor && editor.getPath()) {
                    return new Path(stdPath.dirname(editor.getPath()) + stdPath.sep);
                }
                break;
            case DEFAULT_PROJECT_ROOT:
                let projectPath = getProjectPath();
                if (projectPath) {
                    return new Path(projectPath + stdPath.sep);
                }
                break;
        }

        return new Path('');
    }

    /**
     * Compare two paths lexicographically.
     */
    static compare(path1, path2) {
        return path1.full.localeCompare(path2.full);
    }

    /**
     * Return a new path instance with the common prefix of all the
     * given paths.
     */
    static commonPrefix(paths, caseSensitive=false) {
        if (paths.length < 2) {
            throw new Error(
                'Cannot find common prefix for lists shorter than two elements.'
            );
        }

        paths = paths.map((path) => path.full).sort();
        let first = paths[0];
        let last = paths[paths.length - 1];

        let prefix = '';
        let prefixMaxLength = Math.max(first.length, last.length);
        for (let k = 0; k < prefixMaxLength - 1; k++) {
            if (first[k] === last[k]) {
                prefix += first[k];
            } else if (!caseSensitive && first[k].toLowerCase() === last[k].toLowerCase()) {
                prefix += first[k].toLowerCase();
            } else {
                break;
            }
        }

        return new Path(prefix);
    }
}

/**
 * Return whether the filename matches the given path fragment.
 */
function matchFragment(fragment, filename, caseSensitive=false) {
    if (!caseSensitive) {
        fragment = fragment.toLowerCase();
        filename = filename.toLowerCase();
    }

    return filename.startsWith(fragment);
}
