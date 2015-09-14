/** @babel */
import 'babel-polyfill';

import {AdvancedOpenFileController, emitter} from './controller';


// Instance of the controller, constructed on activation.
let controller = null

export {config} from './config';

export function activate(state) {
    controller = new AdvancedOpenFileController();
}

export function deactivate() {
    controller.detach();
}

export function onDidOpenPath(callback) {
    return emitter.on('did-open-path', callback);
}

export function onDidCreatePath(callback) {
    return emitter.on('did-create-path', callback);
}
