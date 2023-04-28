import * as vscode from 'vscode';
import * as icqq from 'icqq';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import LoginViewProvider from './login/login-view';
import ContactTreeDataProvider from './contact/contact-tree';
import { loginMatcher } from './types/login';

/** 管理全局静态变量，启动时创建所有变量 */
export default class Global {
  /** 扩展工具集 */
  static context: vscode.ExtensionContext;
  /** 客户端实例 */
  static client: icqq.Client;
  /** 存放本扩展所有创建的文件的根目录 */
  static rootDir: string;
  /** 登录视图容器 */
  static loginViewProvider: LoginViewProvider;
  /** 联系人视图容器 */
  static contactViewProvider: ContactTreeDataProvider;

  constructor(context: vscode.ExtensionContext) {
    Global.context = context;

    Global.rootDir = path.join(os.homedir(), '.qlite');
    // 创建根目录文件夹
    if (!fs.existsSync(Global.rootDir)) {
      fs.mkdirSync(Global.rootDir);
    }

    /** {@link Global.client client} 的配置参数 */
    const defaultConf: icqq.Config = {
      log_level: 'off',
      platform: 5,
      ignore_self: false,
      data_dir: Global.rootDir
    };
    Global.client = icqq.createClient(defaultConf);
    // 登录失败
    Global.client.on('system.login.error', ({ code, message }) => {
      vscode.window.showErrorMessage(`${message}\nError Code: ${code}`);
    });
    // 离线
    Global.client.on('system.offline', ({ message }) => {
      vscode.commands.executeCommand('setContext', 'qlite.isOnline', false);
      vscode.window.showWarningMessage(`${message}\nclient offline`);
    });
    // 提供login页面的自定义事件
    loginMatcher.forEach((eventName) => {
      Global.client.on(eventName, (event: any) => {
        Global.client.emit('login.' + eventName, event);
      });
    });
    // 注册登录视图容器
    Global.loginViewProvider = new LoginViewProvider(
      Global.client,
      context.extensionUri
    );
    vscode.window.registerWebviewViewProvider(
      'loginView',
      Global.loginViewProvider
    );
    Global.contactViewProvider = new ContactTreeDataProvider(Global.client);
    vscode.window.registerTreeDataProvider(
      'contactView',
      Global.contactViewProvider
    );
  }
}
