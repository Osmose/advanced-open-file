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

    stat(absoluteFilename) {
        return new Promise(resolve => {
            if (!(absoluteFilename in this.statCache)) {
                fs.stat(absoluteFilename, (err, stat) => {
                    if (err) {
                        stat = null;
                    }

                    this.statCache[absoluteFilename] = stat;
                    resolve(stat);
                });
            } else {
                resolve(this.statCache[absoluteFilename]);
            }
        });
    },

    /**
     * Create an empty file at the given path if it doesn't already exist.
     */
    createFile(path) {
        return new Promise((resolve, reject) => {
            touch(path.absolute, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },

    /**
     * Create directories for the file the path points to, or do nothing
     * if they already exist.
     */
    createDirectories(path) {
        return new Promise((resolve, reject) => {
            mkdirp(absolutify(path.directory), err => {
                if (err && err.code !== 'ENOENT') {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },

    readdir(absoluteDir) {
        return new Promise(resolve => {
            if (absoluteDir in this.readdirCache) {
                resolve(this.readdirCache[absoluteDir]);
            } else {
                fs.readdir(absoluteDir, (err, filenames) => {
                    if (err) {
                        filenames = [];
                    }

                    this.readdirCache[absoluteDir] = filenames;
                    resolve(filenames);
                });
            }
        });
    },

    async pathFor(absoluteFilename) {
        let stat = await this.stat(absoluteFilename);
        return new Path(absoluteFilename, stat);
    },

    async getMatchingPaths(path) {
        if (path.absolute in this.matchingPathCache) {
            return this.matchingPathCache[path.absolute];
        }

        let absoluteDir = absolutify(path.directory);
        let filenames = await this.readdir(absoluteDir);
        if (path.fragment) {
            if (config.get('fuzzyMatch')) {
                filenames = fuzzaldrin.filter(filenames, path.fragment);
            } else {
                let caseSensitive = path.hasCaseSensitiveFragment();
                filenames = filenames.filter(
                    fn => this.matchFragment(path.fragment, fn, caseSensitive)
                );
            }
        }

        filenames = filenames.map(fn => path.directory + fn);

        let matchingPaths = [];
        let start = Date.now();
        for (let filename of filenames) {
            matchingPaths.push(await this.pathFor(filename));
        }
        let end = Date.now();
        console.log(`Duration: ${end - start}`);

        // Cache matched paths.
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
