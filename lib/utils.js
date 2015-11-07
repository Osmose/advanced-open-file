/** @babel */

import stdPath from 'path';


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
    let relativeBases = [];
    let projectPath = getProjectPath();
    if (projectPath) {
        relativeBases.push(projectPath);
    }

    return stdPath.resolve(...relativeBases, path);
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
