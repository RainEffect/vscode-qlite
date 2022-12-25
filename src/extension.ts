import * as vscode from 'vscode';
import * as fs from 'fs';
import { Global } from './global';
import * as client from './client';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "vscode-qlite" is now active!');
	// create work dir
	Global.context = context;
	if (!fs.existsSync(Global.context.globalStorageUri.fsPath)) {
		fs.mkdirSync(Global.context.globalStorageUri.fsPath);
	}
	// link to login command
	context.subscriptions.push(vscode.commands.registerCommand('qlite.login', client.login));
	// auto login
	vscode.commands.executeCommand("qlite.login");
}

// This method is called when your extension is deactivated
export function deactivate() { }
