import * as vscode from 'vscode';
import * as icqq from 'icqq';
import * as fs from 'fs';
import { WebMsg } from '../api/webview';
import {
  InitResMsg,
  LoginReqMsg,
  LoginResMsg,
  QrcodeReqMsg,
  QrcodeResMsg,
  ReqMsg
} from '../api/web-login';
import AccountManager from '../account';
import Slider from './slider';
import Device from './device';

/** 登陆界面容器类 */
export default class LoginViewProvider implements vscode.WebviewViewProvider {
  /** 是否以空表形式加载视图 */
  private _isEmpty: boolean = false;
  /** 显示的视图 */
  private _view?: vscode.WebviewView;
  /** 客户端 */
  private readonly _client: icqq.Client;
  /** 扩展根目录 */
  private readonly _extensionUri: vscode.Uri;

  private _lastMsg?: ReqMsg;
  /**
   * @param client 客户端实例
   * @param extensionUri 扩展根目录
   */
  constructor(client: icqq.Client, extensionUri: vscode.Uri) {
    this._client = client;
    this._extensionUri = extensionUri;
    this._client.on('system.online', () => {
      if (!this._lastMsg) {
        return;
      }
      const msg: LoginReqMsg & WebMsg = this._lastMsg as LoginReqMsg & WebMsg;
      if (msg.args.qrcode) {
        msg.args.uin = this._client.uin;
      }
      // 更新账号记录
      AccountManager.setRecent(msg.args);
      const resMsg: LoginResMsg = {
        timer: msg.timer,
        data: { ret: true }
      };
      this._view?.webview.postMessage(resMsg);
      vscode.commands.executeCommand('setContext', 'qlite.isOnline', true);
      console.log('client online');
      this._lastMsg = undefined;
    });
    this._client.on('system.login.qrcode', ({ image }) => {
      if (!this._lastMsg) {
        return;
      }
      const msg: QrcodeReqMsg & WebMsg = this._lastMsg as QrcodeReqMsg & WebMsg;
      const resMsg: QrcodeResMsg = {
        timer: msg.timer,
        data: { src: 'data:image/png; base64, ' + image.toString('base64') }
      };
      this._view?.webview.postMessage(resMsg);
      this._lastMsg = undefined;
    });
    this._client.on('system.login.device', ({ url }) => {
      // 设备验证
      new Device(url).on('device', () => {
        this._client.login();
      });
    });
    this._client.on('system.login.slider', ({ url }) => {
      // 滑动验证码验证
      new Slider(url).on('ticket', (ticket: string) => {
        this._client.submitSlider(ticket);
      });
    });
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    webviewView.webview.html = this._getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage((msg: ReqMsg) => {
      if (msg.command === 'init') {
        const resMsg: InitResMsg = {
          timer: msg.timer,
          data: this._isEmpty ? undefined : AccountManager.getRecent()
        };
        webviewView.webview.postMessage(resMsg);
      } else if (msg.command === 'login') {
        if (msg.args.qrcode) {
          // 已扫二维码则直接登录
          this._client.login();
        } else {
          // 账号密码登录
          this._client.login(
            msg.args.uin as number,
            msg.args.password as string
          );
        }
        this._lastMsg = msg;
      } else if (msg.command === 'qrcode') {
        // 获取二维码
        this._lastMsg = msg;
      } else {
        console.error('unresolved message from login view');
      }
    });
    webviewView.onDidDispose(() => {
      this._view = undefined;
    });
  }

  /**
   * 设置该视图是否以空视图加载
   *
   * *注意*：当视图活动时这个设置是没用的
   * @param isEmpty 视图是否设为空
   */
  setEmptyView(isEmpty: boolean) {
    if (!this._view) {
      console.warn("it's not working when login view is active");
    }
    this._isEmpty = isEmpty;
  }

  /**
   * 构造`webviewUri`格式的文件目录
   * @param base 起始目录
   * @param pathSegments 子目录
   * @returns 可用于`webview`的`Uri`路径
   */
  private _asWebviewUri(
    base: vscode.Uri,
    ...pathSegments: string[]
  ): vscode.Uri {
    return this._view?.webview.asWebviewUri(
      vscode.Uri.joinPath(base, ...pathSegments)
    ) as vscode.Uri;
  }

  /**
   * 获取`webview`的`html`
   */
  private _getHtmlForWebview() {
    /** 登陆界面的所有素材的根目录 */
    const webviewUri = vscode.Uri.joinPath(
      this._extensionUri,
      'out',
      'webview'
    );
    /** `html`文件的地址 */
    const htmlPath = vscode.Uri.joinPath(
      webviewUri,
      'login',
      'index.html'
    ).fsPath;
    /** 所有要替换的`Uri`键值对，包含`js`、`css`等文件`Uri` */
    const htmlUris: Map<string, vscode.Uri> = new Map();
    htmlUris.set(
      'scriptUri',
      this._asWebviewUri(webviewUri, 'login', 'script.js')
    );
    htmlUris.set(
      'styleUri',
      this._asWebviewUri(webviewUri, 'login', 'style.css')
    );
    htmlUris.set('codiconUri', this._asWebviewUri(webviewUri, 'codicon.css'));
    /** 从`html`文件地址中读取字符串并替换`${}`格式的字符串为特定文件的`WebviewUri` */
    const html: string = fs
      .readFileSync(htmlPath, 'utf-8')
      .replace(
        /\${(\w+)}/g,
        (match, key) => htmlUris.get(key)?.toString() ?? html
      );
    return html;
  }
}
