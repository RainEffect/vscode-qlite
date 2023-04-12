import * as vscode from 'vscode';
import * as fs from 'fs';
import { Global } from './global';
import * as client from './client';
import * as view from './view';
import * as chat from './chat';

// 扩展启动
export function activate(context: vscode.ExtensionContext) {
	// 创建账号目录
	Global.context = context;
	if (!fs.existsSync(Global.context.globalStorageUri.fsPath)) {
		fs.mkdirSync(Global.context.globalStorageUri.fsPath);
	}
	vscode.commands.executeCommand("setContext", "qlite.isOnline", false);
	const loginView = new QLiteViewProvider(context.extensionUri);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider("loginView", loginView));
	// 注册命令
	context.subscriptions.push(vscode.commands.registerCommand("qlite.login", client.inputAccount));
	context.subscriptions.push(vscode.commands.registerCommand("qlite.setting", client.setting));
	context.subscriptions.push(vscode.commands.registerCommand("qlite.chat", chat.openChatView));
	context.subscriptions.push(vscode.commands.registerCommand("qlite.search", chat.search));
	context.subscriptions.push(vscode.commands.registerCommand("qlite.removeContact", view.removeContact));
	context.subscriptions.push(vscode.commands.registerCommand("qlite.profile", view.showProfile));

}

// 扩展关闭
export function deactivate() { }

class QLiteViewProvider implements vscode.WebviewViewProvider {
	private _view?: vscode.WebviewView;

	constructor(private readonly _extensionUri: vscode.Uri) { }

	public resolveWebviewView(webviewView: vscode.WebviewView) {
		this._view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri]
		};
		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const loginUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "out/webview/login/login.js"));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "out/webview/login/style.css"));
		return /*html*/ `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<link rel="stylesheet" href="${styleUri}" />
				<script type="module" src="${loginUri}"></script>
				<title>QLITE</title>
			</head>
			<body>
				<div class="form">
					<vscode-text-field type="tel">账号</vscode-text-field>
					<vscode-text-field type="password">密码</vscode-text-field>
					<vscode-button>登录</vscode-button>
				</div>
			</body>
			</html>
		`;
	}
}