import * as vscode from 'vscode';
import { Global } from './global';
import * as client from './client';
import * as view from './view';
import * as chat from './chat';
import { loginInit } from './login/login';

// 扩展启动
export function activate(context: vscode.ExtensionContext) {
  Global.context = context;
  vscode.commands.executeCommand('setContext', 'qlite.isOnline', false);
  loginInit();
  // 注册命令
  context.subscriptions.push(
    vscode.commands.registerCommand('qlite.setting', client.setting)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('qlite.chat', chat.openChatView)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('qlite.search', chat.search)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('qlite.removeContact', view.removeContact)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('qlite.profile', view.showProfile)
  );
}

// 扩展关闭
export function deactivate() {}
