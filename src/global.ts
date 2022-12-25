import * as vscode from 'vscode';
import * as oicq from 'oicq';

class Global {
    public static context: vscode.ExtensionContext;
    public static client: oicq.Client;
}

// no operation
const NOOP = () => { };

export { Global, NOOP };
