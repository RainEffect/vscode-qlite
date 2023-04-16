import * as vscode from 'vscode';
import * as icqq from 'icqq';
import * as fs from 'fs';
import { Global } from '../global';
import { Slider } from './server';

/** 登陆界面容器类 */
export class LoginViewProvider implements vscode.WebviewViewProvider {
  /** 界面中的视图webview */
  private _view?: vscode.WebviewView;
  private _logining: boolean;

  /** icqq的登录配置 */
  private _loginConfig: icqq.Config = {
    log_level: 'off', // 不记录日志，以后有需要再改
    platform: 5, // 以iPad设备信息登录
    ignore_self: false // 显示群聊中自己发送的消息
  };

  /**
   * 构造函数
   * @param _extensionUri 扩展根目录
   */
  constructor(private readonly _extensionUri: vscode.Uri) {
    this._logining = false;
  }

  /**
   * 视图初次显示时调用此函数
   * @param webviewView 与视图绑定的webview
   */
  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === 'login') {
        // 获取登录信息
        const uin = message.uin;
        const password = message.password;
        this._createClient(Number(uin), password);
      } else if (message.command === 'qrcode') {
        this._createClient(undefined, undefined, message.id);
      }
    });
  }

  /**
   * 获取webview的html信息
   * @param webview 要构造的webview
   * @returns html字符串
   */
  private _getHtmlForWebview(webview: vscode.Webview) {
    const loginUri = vscode.Uri.joinPath(
      this._extensionUri,
      'out/webview/login'
    );
    const htmlPath = vscode.Uri.joinPath(loginUri, 'index.html').fsPath;
    const htmlUris: Map<string, vscode.Uri | string> = new Map();
    htmlUris.set('cspSource', webview.cspSource);
    htmlUris.set(
      'scriptUri',
      webview.asWebviewUri(vscode.Uri.joinPath(loginUri, 'script.js'))
    );
    htmlUris.set(
      'styleUri',
      webview.asWebviewUri(vscode.Uri.joinPath(loginUri, 'style.css'))
    );
    htmlUris.set(
      'codiconUri',
      webview.asWebviewUri(
        vscode.Uri.joinPath(
          this._extensionUri,
          'node_modules/@vscode/codicons/dist/codicon.css'
        )
      )
    );
    const html = fs
      .readFileSync(htmlPath, 'utf-8')
      .replace(/\${(\w+)}/g, (match, key) => {
        const value = htmlUris.get(key) as string | vscode.Uri;
        return typeof value === 'string' ? value : value.toString();
      });
    return html;
  }

  /**
   * 创建icqq.Client实例
   * @param uin 用户账号
   * @param password 密码
   */
  private _createClient(uin?: number, password?: string, id?: NodeJS.Timer) {
    const client = icqq.createClient(this._loginConfig);
    Global.client = client;
    client.on('system.login.error', ({ code, message }) => {
      this._logining = false;
      vscode.window.showErrorMessage(`${message}\nError Code: ${code}`);
    });
    client.on('system.login.qrcode', ({ image }) => {
      if (id) {
        this._view?.webview.postMessage({
          id: id,
          image: 'data:image/png; base64, ' + image.toString('base64')
        });
      } else {
        console.error('receive an unknown qrcode');
      }
    });
    client.on('system.login.device', ({ url, phone }) => {
      console.log('require device login');
    });
    client.on('system.login.slider', async ({ url }) => {
      const slider = new Slider(url, 3000);
      await slider.launchBrowser();
      slider.on('ticket', (ticket: string) => {
        console.log(ticket);
        client.submitSlider(ticket);
      });
    });
    client.on('system.online', () => {
      vscode.commands.executeCommand('setContext', 'qlite.isOnline', true);
      console.log('client online');
    });
    client.on('system.offline', ({ message }) => {
      vscode.commands.executeCommand('setContext', 'qlite.isOnline', false);
      console.log('client offline because ' + message);
    });
    client.login(uin, password);
  }
}
