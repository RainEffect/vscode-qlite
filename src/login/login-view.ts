import { readFileSync } from 'fs';
import { Client } from 'icqq';
import vscode from 'vscode';
import LoginRecordManager from '../login-record';
import { LoginRecord, ReqMsg, ResMsg } from '../types/login';
import MessageHandler from '../webview/message-handler';

/** 登录界面容器类 */
export default class LoginViewProvider implements vscode.WebviewViewProvider {
  /** 是否以空表形式加载视图 */
  private isEmpty = false;
  /** 显示的视图 */
  private _view?: vscode.WebviewView;
  /**
   * @param client 客户端
   * @param extensionUri 扩展根目录
   */
  constructor(
    private readonly client: Client,
    private readonly extensionUri: vscode.Uri
  ) {
    this.client.on('system.login.device', ({ url }) => {
      // 设备锁验证
      vscode.window
        .showInformationMessage(
          `请点击 [此网址](${url}) 进行设备锁验证。`,
          '已验证'
        )
        .then((value: string | undefined) => {
          if (!value) {
            vscode.window.showInformationMessage('已取消登录');
          } else {
            this.client.login();
          }
        });
    });
    this.client.on('system.login.slider', ({ url }) => {
      // 滑动验证码验证
      vscode.window.showInformationMessage(
        `请点击 [此网址](${url}) 完成滑动验证码。`
      );
      vscode.window
        .showInputBox({
          placeHolder: '请输入验证ticket',
          prompt:
            '[如何获取ticket](https://github.com/takayama-lily/node-onebot/issues/28)',
          ignoreFocusOut: true
        })
        .then((ticket: string | undefined) => {
          if (!ticket) {
            vscode.window.showInformationMessage('取消登录');
          } else {
            this.client.submitSlider(ticket);
          }
        });
    });
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    const msgHandler = new MessageHandler(webviewView.webview);
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    msgHandler.onMessage((msg) => {
      if (msg.command === 'init') {
        const res: ResMsg<'init'> = {
          id: msg.id,
          command: 'init',
          payload: this.isEmpty ? undefined : LoginRecordManager.getRecent()
        };
        msgHandler.postMessage(res);
        this.isEmpty = false;
      } else if (msg.command === 'login') {
        const info: LoginRecord = (msg as ReqMsg<'login'>).payload;
        if (info.method === 'password') {
          this.client.login(info.uin, info.password);
        } else if (info.method === 'qrcode') {
          this.client.login();
        } else {
          this.client.login(info.uin);
        }
        const onlineDispose = this.client.on('system.online', () => {
          // 更新账号记录
          LoginRecordManager.setRecent(
            this.client.uin,
            (msg as ReqMsg<'login'>).payload
          );
          msgHandler.postMessage({
            id: msg.id,
            command: 'login',
            payload: { ret: true }
          } as ResMsg<'login'>);
          vscode.commands.executeCommand('setContext', 'qlite.isOnline', true);
          console.log('LoginView: client online');
          onlineDispose();
        });
      } else if (msg.command === 'qrcode') {
        const qrcodeDispose = this.client.on(
          'system.login.qrcode',
          ({ image }) => {
            msgHandler.postMessage({
              id: msg.id,
              command: 'qrcode',
              payload: {
                src: 'data:image/png; base64, ' + image.toString('base64')
              }
            } as ResMsg<'qrcode'>);
            qrcodeDispose();
          }
        );
        this.client.fetchQrcode();
      } else {
        console.error('LoginView: unresolved message');
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
    if (this._view) {
      console.warn("it's not working when login view is active");
    }
    this.isEmpty = isEmpty;
  }

  /**
   * 获取`webview`的`html`
   * @param webview 目标`webview`实例
   * @returns 生成的`html`
   */
  private _getHtmlForWebview(webview: vscode.Webview) {
    /** 登陆界面的所有素材的根目录 */
    const webviewUri = vscode.Uri.joinPath(this.extensionUri, 'out');
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
      webview.asWebviewUri(
        vscode.Uri.joinPath(webviewUri, 'login', 'script.js')
      )
    );
    htmlUris.set(
      'styleUri',
      webview.asWebviewUri(
        vscode.Uri.joinPath(webviewUri, 'login', 'style.css')
      )
    );
    htmlUris.set(
      'codiconUri',
      webview.asWebviewUri(vscode.Uri.joinPath(webviewUri, 'codicon.css'))
    );
    /** 从`html`文件地址中读取字符串并替换`${}`格式的字符串为特定文件的`WebviewUri` */
    const html: string = readFileSync(htmlPath, 'utf-8').replace(
      /\${(\w+)}/g,
      (match, key) => htmlUris.get(key)?.toString() ?? html
    );
    return html;
  }
}
