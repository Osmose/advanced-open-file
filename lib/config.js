/** @babel */

export const DEFAULT_ACTIVE_FILE_DIR = 'Active file\'s directory';
export const DEFAULT_PROJECT_ROOT = 'Project root';
export const DEFAULT_EMPTY = 'Empty';


export let config = {
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
};
