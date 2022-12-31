import * as vscode from 'vscode';
import * as fs from 'fs';
import { Global } from './global';
import * as client from './client';
import * as chat from './chat';

// 扩展启动
export function activate(context: vscode.ExtensionContext) {
	// 创建账号目录
	Global.context = context;
	if (!fs.existsSync(Global.context.globalStorageUri.fsPath)) {
		fs.mkdirSync(Global.context.globalStorageUri.fsPath);
	}
	// 注册登录命令
	context.subscriptions.push(vscode.commands.registerCommand("qlite.login", client.login));
	context.subscriptions.push(vscode.commands.registerCommand("qlite.chat", chat.openChatView));
}

// 扩展关闭
export function deactivate() { }
