import * as vscode from 'vscode';
import Global from './global';
import setting from './contact/setting';
import search from './contact/search';

/** 扩展启动 */
export function activate(context: vscode.ExtensionContext) {
  vscode.commands.executeCommand('setContext', 'qlite.isOnline', false);
  new Global(context);
  // 注册扩展命令
  context.subscriptions.push(
    vscode.commands.registerCommand('qlite.setting', setting)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'qlite.chat',
      Global.chatViewManager.newChat,
      Global.chatViewManager
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('qlite.search', search)
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

/** 扩展关闭 */
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {}
