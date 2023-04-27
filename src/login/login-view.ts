import * as vscode from 'vscode';
import * as icqq from 'icqq';
import * as fs from 'fs';
import { MessageType, WebviewMessage } from '../types/webview';
import {
  LoginResMsg,
  QrcodeResMsg,
  LoginReqMsg,
  InitReqMsg,
  QrcodeReqMsg,
  InitResMsg
} from '../types/login';
import LoginRecordManager from '../login-record';
import Slider from './slider';
import Device from './device';

/** 登陆界面容器类 */
export default class LoginViewProvider implements vscode.WebviewViewProvider {
  /** 是否以空表形式加载视图 */
  private _isEmpty = false;
  /** 显示的视图 */
  private _view?: vscode.WebviewView;
  private _lastMsg?: WebviewMessage;
  /**
   * @param client 客户端
   * @param extensionUri 扩展根目录
   */
  constructor(
    private readonly client: icqq.Client,
    private readonly extensionUri: vscode.Uri
  ) {
    this.client.on('system.online', () => {
      if (!this._lastMsg) {
        return;
      }
      const msg = this._lastMsg;
      // 更新账号记录
      LoginRecordManager.setRecent(this.client.uin, msg.payload.data);
      this._view?.webview.postMessage({
        type: MessageType.Response,
        id: msg.id,
        payload: {} as LoginResMsg
      } as WebviewMessage);
      vscode.commands.executeCommand('setContext', 'qlite.isOnline', true);
      console.log('client online');
      this._lastMsg = undefined;
    });
    this.client.on('system.login.qrcode', ({ image }) => {
      if (!this._lastMsg) {
        return;
      }
      const msg = this._lastMsg;
      this._view?.webview.postMessage({
        type: MessageType.Response,
        id: msg.id,
        payload: {
          src: 'data:image/png; base64, ' + image.toString('base64')
        } as QrcodeResMsg
      } as WebviewMessage);
      this._lastMsg = undefined;
    });
    this.client.on('system.login.device', ({ url }) => {
      // 设备验证
      new Device(url).on('device', () => {
        this.client.login();
      });
    });
    this.client.on('system.login.slider', ({ url }) => {
      // 滑动验证码验证
      new Slider(url).on('ticket', (ticket: string) => {
        this.client.submitSlider(ticket);
      });
    });
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.html = this._getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage((msg: WebviewMessage) => {
      if (msg.type === MessageType.Request) {
        const payload: LoginReqMsg | InitReqMsg | QrcodeReqMsg = msg.payload;
        if (payload.command === 'init') {
          webviewView.webview.postMessage({
            type: MessageType.Response,
            id: msg.id,
            payload: this._isEmpty
              ? undefined
              : (LoginRecordManager.getRecent() as InitResMsg)
          } as WebviewMessage);
        } else if (payload.command === 'login') {
          const loginInfo = payload.data;
          if (loginInfo.method === 'password') {
            this.client.login(loginInfo.uin, loginInfo.password);
          } else if (loginInfo.method === 'qrcode') {
            this.client.login();
          } else {
            this.client.login(loginInfo.uin);
          }
          this._lastMsg = msg;
        } else if (payload.command === 'qrcode') {
          // 获取二维码
          this._lastMsg = msg;
          this.client.fetchQrcode();
        } else {
          console.error('unresolved message from login view');
        }
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
    const webviewUri = vscode.Uri.joinPath(this.extensionUri, 'out', 'webview');
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
