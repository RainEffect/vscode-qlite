import * as vscode from 'vscode';
import Global from './global';
import * as setting from './contact/setting';
import * as chat from './chat';

// 扩展启动
export function activate(context: vscode.ExtensionContext) {
  // qlite.isOnline = false
  vscode.commands.executeCommand('setContext', 'qlite.isOnline', false);
  new Global(context);
  // 注册扩展命令
  context.subscriptions.push(
    vscode.commands.registerCommand('qlite.setting', setting.setting)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('qlite.chat', chat.openChatView)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('qlite.search', chat.search)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'qlite.removeMsg',
      Global.contactViewProvider.removeMsg.bind(Global.contactViewProvider)
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'qlite.profile',
      Global.contactViewProvider.showProfile
    )
  );
}

// 扩展关闭
export function deactivate() {}
