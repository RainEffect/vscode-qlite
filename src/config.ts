import * as vscode from 'vscode';
import * as oicq from 'oicq';
import { Global } from './global';

function genClientConfig() {
    const clientConfig: oicq.Config = {
        data_dir: Global.context.globalStorageUri.fsPath,
        ignore_self: false,
        log_level: "off",
        reconn_interval: 0,
        platform: 5
    };
    return clientConfig;
}

export { genClientConfig };
