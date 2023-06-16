import { existsSync, mkdirSync } from 'fs';
import { Client, Config, Platform } from 'icqq';
import { homedir } from 'os';
import path from 'path';
import { ExtensionContext, commands, window, workspace } from 'vscode';
import ChatViewManager from './chat/chat-view';
import ContactTreeDataProvider from './contact/contact-tree';
import LoginViewProvider from './login/login-view';

/** 管理全局静态变量，扩展启动时初始化所有静态成员变量 */
export default class Global {
  /** 扩展工具集 */
  static context: ExtensionContext;
  /** 客户端实例 */
  static client: Client;
  /** 存放本扩展所有创建的文件的根目录 */
  static rootDir: string;
  /** 登录视图容器 */
  static loginViewProvider: LoginViewProvider;
  /** 联系人视图容器 */
  static contactViewProvider: ContactTreeDataProvider;
  /** 聊天页面容器 */
  static chatViewManager: ChatViewManager;

  constructor(context: ExtensionContext) {
    Global.context = context;

    // rootdir = `${HOME}/.qlite`
    Global.rootDir = path.join(homedir(), '.qlite');
    // 创建根目录文件夹
    if (!existsSync(Global.rootDir)) {
      mkdirSync(Global.rootDir);
    }

    /** {@link Global.client client} 的配置参数 */
    const defaultConf: Config = {
      log_level: 'error',
      platform: workspace.getConfiguration().get('qlite.platform') as Platform,
      ignore_self: false,
      data_dir: Global.rootDir
    };
    Global.client = new Client(defaultConf);
    // 登录失败
    Global.client.on('system.login.error', ({ code, message }) => {
      window.showErrorMessage(`${message}\nError Code: ${code}`);
    });
    // 离线
    Global.client.on('system.offline', ({ message }) => {
      commands.executeCommand('setContext', 'qlite.isOnline', false);
      window.showWarningMessage(`${message}\nclient offline`);
    });
    // 初始化视图容器
    Global.loginViewProvider = new LoginViewProvider(
      Global.client,
      context.extensionUri
    );
    window.registerWebviewViewProvider('loginView', Global.loginViewProvider);
    Global.contactViewProvider = new ContactTreeDataProvider(Global.client);
    window.registerTreeDataProvider('contactView', Global.contactViewProvider);
  }
}
