import * as vscode from 'vscode';
import { LoginViewProvider } from './view';
import { Global } from '../global';

/**
 * 初始化登陆界面
 */
export function loginInit() {
  Global.context.subscriptions.push(
    // 注册webviewView
    vscode.window.registerWebviewViewProvider(
      'loginView',
      new LoginViewProvider(Global.context.extensionUri)
    )
  );
}
