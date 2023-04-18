import * as vscode from 'vscode';
import * as icqq from 'icqq';
import * as fs from 'fs';
import { Global } from '../global';
import { Slider } from './slider';
import { Device } from './device';

/** 定义表单数据 */
interface LoginData {
  /** QQ账号 */
  uin: number;
  /** 密码 */
  password: string;
  /** 是否记住密码 */
  remember: boolean;
  /** 是否自动登录 */
  autoLogin: boolean;
  /** 是否使用扫码登陆，若此项为真则前面信息无效 */
  qrcode: boolean;
}

/** 登陆界面容器类 */
export class LoginViewProvider implements vscode.WebviewViewProvider {
  /** 界面中的视图webview */
  private _view?: vscode.WebviewView;

  /** icqq的登录配置 */
  private _loginConfig: icqq.Config = {
    log_level: 'off', // 不记录日志，以后有需要再改
    platform: 5, // 以iPad设备信息登录
    ignore_self: false, // 显示群聊中自己发送的消息
    data_dir: Global.getRootDir() // 数据统一存放目录
  };

  /**
   * 构造函数
   * @param _extensionUri 扩展根目录
   */
  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    webviewView.webview.onDidReceiveMessage(
      (
        message:
          | { command: 'login'; data: LoginData }
          | { command: 'qrcode'; data: NodeJS.Timer }
      ) => {
        if (message.command === 'login') {
          // 获取登录信息
          const uin = message.data.uin;
          const password = message.data.password;
          this._createClient(uin, password);
        } else if (message.command === 'qrcode') {
          // 获取二维码
          this._createClient(undefined, undefined, message.data);
        }
      }
    );
  }

  /**
   * 获取webview的html信息
   * @param webview 要构造的webview
   * @returns html字符串
   */
  private _getHtmlForWebview(webview: vscode.Webview) {
    const loginUri = vscode.Uri.joinPath(
      this._extensionUri,
      'out',
      'webview',
      'login'
    );
    const htmlPath = vscode.Uri.joinPath(loginUri, 'index.html').fsPath;
    const htmlUris: Map<string, vscode.Uri> = new Map();
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
          'node_modules',
          '@vscode',
          'codicons',
          'dist',
          'codicon.css'
        )
      )
    );
    const html = fs
      .readFileSync(htmlPath, 'utf-8')
      .replace(/\${(\w+)}/g, (match, key) => {
        const value = htmlUris.get(key) as vscode.Uri;
        return value.toString();
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
    Global.onDefaultSetting(client)
      .on('system.login.qrcode', ({ image }) => {
        // 扫码登录
        if (id) {
          this._view?.webview.postMessage({
            id: id,
            image: 'data:image/png; base64, ' + image.toString('base64')
          });
        } else {
          console.error('receive an unknown qrcode');
        }
      })
      .on('system.login.device', ({ url }) => {
        // 设备验证
        new Device(url).on('device', () => {
          client.login();
        });
      })
      .on('system.login.slider', ({ url }) => {
        // 滑动验证码验证
        new Slider(url).on('ticket', (ticket: string) => {
          client.submitSlider(ticket);
        });
      })
      .login(uin, password); // 登录
  }
}
