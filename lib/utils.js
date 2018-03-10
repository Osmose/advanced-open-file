/** @babel */

import minimatch from 'minimatch';
import stdPath from 'path';
import StringMap from 'stringmap';

import osenv from 'osenv';

import * as config from './config';


/**
 * Generates the return value for the wrapper property on first access
 * and caches it on the object. All future calls return the cached value
 * instead of re-calculating it.
 */
export function cachedProperty(target, key, descriptor) {
    let getter = descriptor.get;
    let cached_key = Symbol(`${key}_cached`);

    descriptor.get = function() {
        if (this[cached_key] === undefined) {
            Object.defineProperty(this, cached_key, {
                value: this::getter(),
                writable: false,
                enumerable: false,
            });
        }
        return this[cached_key];
    };

    return descriptor;
}


/**
 * Get the path to the current project directory. For now this just uses
 * the first directory in the list. Return null if there are no project
 * directories.
 *
 * TODO: Support more than just the first.
 */
export function getProjectPath() {
    let projectPaths = atom.project.getPaths();
    if (projectPaths.length > 0) {
        return projectPaths[0];
    } else {
        return null;
    }
}


/**
 * Get the preferred path separator for the given string based on the
 * first path separator detected.
 */
export function preferredSeparatorFor(path) {
    let forwardIndex = path.indexOf('/');
    let backIndex = path.indexOf('\\');

    if (backIndex === -1 && forwardIndex === -1) {
        return stdPath.sep;
    } else if (forwardIndex === -1) {
        return '\\';
    } else if (backIndex === -1) {
        return '/';
    } else if (forwardIndex < backIndex) {
        return '/';
    } else {
        return '\\';
    }
}


/**
 * Define an immutable property on an object.
 */
export function defineImmutable(obj, name, value) {
    Object.defineProperty(obj, name, {
        value: value,
        writable: false,
        enumerable: true,
    });
}


/**
 * Turn the given path into an absolute path if necessary. Paths are
 * considered relative to the project root.
 */
export function absolutify(path) {
    // If we start with a tilde, just replace it with the home dir.
    let sep = preferredSeparatorFor(path);
    if (path.startsWith('~' + sep)) {
        return osenv.home() + sep + path.slice(2);
    }

    // If the path doesn't start with a separator, it's relative to the
    // project root.
    if (!path.startsWith(sep)) {
        let relativeBases = [];
        let projectPath = getProjectPath();
        if (projectPath) {
            relativeBases.push(projectPath);
        }

        return stdPath.resolve(...relativeBases, path);
    }

    // Otherwise it was absolute already.
    return path;
}


/**
 * Parse the given string as HTML and return DOM nodes. Assumes a root
 * DOM node because, well, that's all I use it for.
 */
export function dom(html) {
    let div = document.createElement('div');
    div.innerHTML = html;
    return div.firstElementChild;
}


/**
 * Starts at the current DOM element and moves upward in the DOM tree
 * until an element matching the given selector is found.
 *
 * Intended to be bound to DOM elements like so:
 * domNode::closest('selector');
 */
export function closest(selector) {
    if (this.matches && this.matches(selector)) {
        return this;
    } else if (this.parentNode) {
        return this.parentNode::closest(selector);
    } else {
        return null;
    }
}


/**
 * Return value from StringMap if exists
 * otherwise generate value with getValue, set the StringMap and return
 */
export function getOrUpdateStringMap(stringMap, key, getValue) {
  if (stringMap.has(key) ) {
    return stringMap.get(key);
  }
  const value = getValue(key);
  stringMap.set(key, value);
  return value;
}

/**
 * Returns an array of Minimatch instances to test whether a filename
 * is ignored. Cache the Minimatch instances instead of re-compiling
 * the regexp.
 */
let _minimatchesCache = StringMap();
export function ignoredPatterns() {
    const ignoredGlobs = config.get('ignoredPatterns')
    return ignoredGlobs.map((glob) => getOrUpdateStringMap(_minimatchesCache, glob, (glob) =>
       new minimatch.Minimatch(glob)))
}
