/** @babel */
import fs from 'fs';

import fuzzaldrin from 'fuzzaldrin-plus';
import mkdirp from 'mkdirp';
import touch from 'touch';

import * as config from './config';
import {Path} from './models';
import {absolutify} from './utils';


export default {
    stat(path) {
        try {
            return fs.statSync(path.absolute);
        } catch (err) {
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

    getMatchingPaths(path, caseSensitive=null) {
        let absoluteDir = absolutify(path.directory);
        let filenames = null;

        try {
            filenames = fs.readdirSync(absoluteDir);
        } catch (err) {
            return [path.parent()]; // TODO: Catch permissions error and display a message.
        }

        if (path.fragment) {
            if (config.get('fuzzyMatch')) {
                filenames = fuzzaldrin.filter(filenames, path.fragment);
            } else {
                if (caseSensitive === null) {
                    caseSensitive = path.hasCaseSensitiveFragment();
                }

                filenames = filenames.filter(
                    (fn) => this.matchFragment(path.fragment, fn, caseSensitive)
                );
            }
        }

        return filenames.map((fn) => new Path(path.directory + fn));
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
