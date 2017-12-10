/** @babel */

export const DEFAULT_ACTIVE_FILE_DIR = 'Active file\'s directory';
export const DEFAULT_PROJECT_ROOT = 'Project root';
export const DEFAULT_EMPTY = 'Empty';


export function get(key) {
    return atom.config.get(`advanced-open-file.${key}`);
}


export let config = {
    createDirectories: {
        title: 'Create directories',
        description: `When opening a path to a directory that doesn't
                      exist, create the directory instead of beeping.`,
        type: 'boolean',
        default: false,
    },
    createFileInstantly: {
        title: 'Create files instantly',
        description: `When opening files that don't exist, create them
                      immediately instead of on save.`,
        type: 'boolean',
        default: false,
    },
    helmDirSwitch: {
        title: 'Shortcuts for fast directory switching',
        description: 'See README for details.',
        type: 'boolean',
        default: false,
    },
    defaultInputValue: {
        title: 'Default input value',
        description: `What should the path input default to when the dialog
                      is opened?`,
        type: 'string',
        enum: [DEFAULT_ACTIVE_FILE_DIR, DEFAULT_PROJECT_ROOT, DEFAULT_EMPTY],
        default: DEFAULT_ACTIVE_FILE_DIR,
    },
    fuzzyMatch: {
        title: 'Use fuzzy matching for matching filenames',
        description: `Replaces default prefix-based matching. See README for
                      details.`,
        type: 'boolean',
        default: false,
    },
    ignoredPatterns: {
      title: 'Ignore patterns',
      description: 'Array of glob patterns to hide matching filenames.',
      type: 'array',
      default: ['*.pyc', '*.pyo'],
      items: {
          type: 'string',
      },
    }
};
