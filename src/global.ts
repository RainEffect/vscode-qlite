import * as vscode from 'vscode';
import * as icqq from 'icqq';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { createTreeView } from './view';

/** 全局变量类 */
export class Global {
  /** 扩展菜单 */
  static context: vscode.ExtensionContext;
  /** 客户端信息 */
  static client: icqq.Client;
  /** 侧边栏视图 */
  static qliteTreeView: vscode.TreeView<vscode.TreeItem>;

  /**
   * 获取扩展存储的根目录
   * @returns 目录路径
   */
  static getRootDir(): string {
    const rootPath = path.join(os.homedir(), '.qlite');
    if (!fs.existsSync(rootPath)) {
      // 目录不存在则手动创建
      fs.mkdirSync(rootPath);
    }
    return rootPath;
  }

  /**
   * 设置通用的client.on事件
   * @params client 要进行默认设置的client实例
   * @returns 返回设置好的client实例，便于后接个性化client.on事件
   */
  static onDefaultSetting(client: icqq.Client): icqq.Client {
    Global.client = client;
    return client
      .on('system.login.error', ({ code, message }) => {
        // 登录失败
        vscode.window.showErrorMessage(`${message}\nError Code: ${code}`);
      })
      .on('system.online', () => {
        // 上线
        vscode.commands.executeCommand('setContext', 'qlite.isOnline', true);
        createTreeView();
        console.log('client online');
      })
      .on('system.offline', ({ message }) => {
        // 离线
        vscode.commands.executeCommand('setContext', 'qlite.isOnline', false);
        console.log('client offline because ' + message);
      });
  }
}
