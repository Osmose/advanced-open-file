/** @babel */
import fs from 'fs';

import fuzzaldrin from 'fuzzaldrin-plus';
import mkdirp from 'mkdirp';
import touch from 'touch';

import * as config from './config';
import {Path} from './models';
import {absolutify} from './utils';


export default {
    statCache: {},
    readdirCache: {},
    matchingPathCache: {},
    clearCache() {
        this.statCache = {};
        this.readdirCache = {};
        this.matchingPathCache = {};
    },

    stat(path) {
        try {
            if (!(path.absolute in this.statCache)) {
                this.statCache[path.absolute] = fs.statSync(path.absolute);
            }

            return this.statCache[path.absolute];
        } catch (err) {
            this.statCache[path.absolute] = null;
            return null;
        }
    },

    isDirectory(path) {
        let stat = this.stat(path);
        return stat ? stat.isDirectory() : null;
    },

    isFile(path) {
        let stat = this.stat(path);
        return stat ? !stat.isDirectory() : null;
    },

    exists(path) {
        return this.stat(path) !== null;
    },

    /**
     * Create an empty file at the given path if it doesn't already exist.
     */
    createFile(path) {
        touch.sync(path.absolute);
    },

    /**
     * Create directories for the file the path points to, or do nothing
     * if they already exist.
     */
    createDirectories(path) {
        try {
            mkdirp.sync(absolutify(path.directory));
        } catch (err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }
    },

    getMatchingPaths(path) {
        if (path.absolute in this.matchingPathCache) {
            return this.matchingPathCache[path.absolute];
        }

        let absoluteDir = absolutify(path.directory);
        let filenames = null;

        if (absoluteDir in this.readdirCache) {
            filenames = this.readdirCache[absoluteDir];
        } else {
            try {
                filenames = fs.readdirSync(absoluteDir);
            } catch (err) {
                filenames = [];
            }
            this.readdirCache[absoluteDir] = filenames;
        }

        if (path.fragment) {
            if (config.get('fuzzyMatch')) {
                filenames = fuzzaldrin.filter(filenames, path.fragment);
            } else {
                let caseSensitive = path.hasCaseSensitiveFragment();
                filenames = filenames.filter(
                    (fn) => this.matchFragment(path.fragment, fn, caseSensitive)
                );
            }
        }

        let matchingPaths = filenames.map((fn) => new Path(path.directory + fn));
        this.matchingPathCache[path.absolute] = matchingPaths;
        return matchingPaths;
    },

    /**
     * Return whether the filename matches the given path fragment.
     */
    matchFragment(fragment, filename, caseSensitive=false) {
        if (!caseSensitive) {
            fragment = fragment.toLowerCase();
            filename = filename.toLowerCase();
        }

        return filename.startsWith(fragment);
    }
};
