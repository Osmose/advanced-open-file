/** @babel */

import fs from 'fs';
import stdPath from 'path';

import fuzzaldrin from 'fuzzaldrin-plus';
import mkdirp from 'mkdirp';
import touch from 'touch';

import * as config from './config';
import {
    absolutify,
    cachedProperty,
    defineImmutable,
    getProjectPath,
    ignoredPatterns,
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
    get absolute() {
        return absolutify(this.full);
    }

    @cachedProperty
    get stat() {
        try {
            return fs.statSync(this.absolute);
        } catch (err) {
            return null;
        }
    }

    isDirectory() {
        return this.stat ? this.stat.isDirectory() : null;
    }

    isFile() {
        return this.stat ? !this.stat.isDirectory() : null;
    }

    isProjectDirectory() {
        return atom.project.getPaths().indexOf(this.absolute) !== -1;
    }

    isRoot() {
        return stdPath.dirname(this.absolute) === this.absolute;
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
        let current = this.absolute;
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
        touch.sync(this.absolute);
    }

    /**
     * Create directories for the file this path points to, or do nothing
     * if they already exist.
     */
    createDirectories() {
        try {
            mkdirp.sync(absolutify(this.directory));
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
            if (config.get('fuzzyMatch')) {
                filenames = fuzzaldrin.filter(filenames, this.fragment);
            } else {
                if (caseSensitive === null) {
                    caseSensitive = this.hasCaseSensitiveFragment();
                }

                filenames = filenames.filter(
                    (fn) => matchFragment(this.fragment, fn, caseSensitive)
                );
            }
        }

        filenames = filenames.filter(isVisible)
        return filenames.map((fn) => new Path(this.directory + fn));
    }

    /**
     * Check if the last path fragment in this path is equal to the given
     * shortcut string, and the path ends in a separator.
     *
     * For example, ':/' and '/foo/bar/:/' have the ':' shortcut, but
     * '/foo/bar:/' and '/blah/:' do not.
     */
    hasShortcut(shortcut) {
        shortcut = shortcut + this.sep;
        return !this.fragment && (
            this.directory.endsWith(this.sep + shortcut)
            || this.directory === shortcut
        )
    }

    equals(otherPath) {
        return this.full === otherPath.full;
    }

    /**
     * Return the path to show initially in the path input.
     */
    static initial() {
        switch (config.get('defaultInputValue')) {
            case config.DEFAULT_ACTIVE_FILE_DIR:
                let editor = atom.workspace.getActiveTextEditor();
                if (editor && editor.getPath()) {
                    return new Path(stdPath.dirname(editor.getPath()) + stdPath.sep);
                }
                // No break so that we fall back to project root.
            case config.DEFAULT_PROJECT_ROOT:
                let projectPath = getProjectPath();
                if (projectPath) {
                    return new Path(projectPath + stdPath.sep);
                }
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
        let prefixMaxLength = Math.min(first.length, last.length);
        for (let k = 0; k < prefixMaxLength; k++) {
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

/**
 * Return whether the filename is not hidden by the ignoredPatterns config.
 */
function isVisible(filename) {
    for (const ignoredPattern of ignoredPatterns()) {
        if (ignoredPattern.match(filename)) return false;
    }
    return true;
}
