import { ExtensionContext, commands } from 'vscode';
import search from './contact/search';
import setting from './contact/setting';
import Global from './global';

/** 扩展启动 */
export function activate(context: ExtensionContext) {
  // qlite.isOnline = false
  commands.executeCommand('setContext', 'qlite.isOnline', false);
  new Global(context);
  // 注册扩展命令
  context.subscriptions.push(
    commands.registerCommand('qlite.setting', setting),
    commands.registerCommand('qlite.search', search),
    commands.registerCommand(
      'qlite.chat',
      Global.chatViewManager.newChat.bind(Global.chatViewManager)
    ),
    commands.registerCommand(
      'qlite.removeMsg',
      Global.contactViewProvider.removeMsg.bind(Global.contactViewProvider)
    ),
    commands.registerCommand(
      'qlite.profile',
      Global.contactViewProvider.showProfile
    )
  );
}

/** 扩展关闭 */
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {}
