import { readFileSync } from 'fs';
import { Client } from 'icqq';
import {
  Uri,
  Webview,
  WebviewView,
  WebviewViewProvider,
  commands,
  window
} from 'vscode';
import LoginRecordManager from '../login-record';
import LoginCommand from '../message/login';
import MessageHandler from '../message/message-handler';

/** 登录界面容器类 */
export default class LoginViewProvider implements WebviewViewProvider {
  /** 是否以空表形式加载视图 */
  private isEmpty = false;
  /** 显示的视图 */
  private _view?: WebviewView;
  /**
   * @param client 客户端
   * @param extensionUri 扩展根目录
   */
  constructor(
    private readonly client: Client,
    private readonly extensionUri: Uri
  ) {
    this.client.on('system.login.device', ({ url }) => {
      // 设备锁验证
      window
        .showInformationMessage(
          `请点击 [此网址](${url}) 进行设备锁验证。`,
          '已验证'
        )
        .then((value: string | undefined) => {
          if (!value) {
            window.showInformationMessage('已取消登录');
          } else {
            this.client.login();
          }
        });
    });
    this.client.on('system.login.slider', ({ url }) => {
      // 滑动验证码验证
      window.showInformationMessage(`请点击 [此网址](${url}) 完成滑动验证码。`);
      window
        .showInputBox({
          placeHolder: '请输入验证ticket',
          prompt:
            '[如何获取ticket](https://github.com/takayama-lily/node-onebot/issues/28)',
          ignoreFocusOut: true
        })
        .then((ticket: string | undefined) => {
          if (!ticket) {
            window.showInformationMessage('取消登录');
          } else {
            this.client.submitSlider(ticket);
          }
        });
    });
  }

  resolveWebviewView(webviewView: WebviewView) {
    this._view = webviewView;
    const msgHandler = new MessageHandler<LoginCommand>(
      false,
      webviewView.webview
    );
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    /** 处理来自页面的消息 */
    // 获取登录记录
    msgHandler.get('getRecord', 'req').then((msg) => {
      const record = this.isEmpty ? undefined : LoginRecordManager.getRecent();
      msgHandler.response(msg.id, msg.command, record);
      this.isEmpty = false;
    });
    // 登录操作
    msgHandler.get('submitRecord', 'req').then((msg) => {
      if (msg.payload.method === 'password') {
        this.client.login(msg.payload.uin, msg.payload.password);
      } else if (msg.payload.method === 'qrcode') {
        this.client.login();
      } else {
        this.client.login(msg.payload.uin);
      }
      const onlineDispose = this.client.on('system.online', () => {
        // 更新账号记录
        LoginRecordManager.setRecent(this.client.uin, msg.payload);
        msgHandler.response(msg.id, msg.command, true);
        commands.executeCommand('setContext', 'qlite.isOnline', true);
        console.log('LoginView: client online');
        onlineDispose();
      });
    });
    // 获取登录二维码
    msgHandler.get('getQrcode', 'req').then((msg) => {
      const qrcodeDispose = this.client.on(
        'system.login.qrcode',
        ({ image }) => {
          const src = 'data:image/png; base64, ' + image.toString('base64');
          msgHandler.response(msg.id, msg.command, src);
          qrcodeDispose();
        }
      );
      this.client.fetchQrcode();
    });
    // 关闭页面
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
  private _getHtmlForWebview(webview: Webview) {
    /** 登陆界面的所有素材的根目录 */
    const webviewUri = Uri.joinPath(this.extensionUri, 'out');
    /** `html`文件的地址 */
    const htmlPath = Uri.joinPath(webviewUri, 'login', 'index.html').fsPath;
    /** 所有要替换的`Uri`键值对，包含`js`、`css`等文件`Uri` */
    const htmlUris: Map<string, Uri> = new Map();
    htmlUris.set(
      'scriptUri',
      webview.asWebviewUri(Uri.joinPath(webviewUri, 'login', 'script.js'))
    );
    htmlUris.set(
      'styleUri',
      webview.asWebviewUri(Uri.joinPath(webviewUri, 'login', 'style.css'))
    );
    htmlUris.set(
      'codiconUri',
      webview.asWebviewUri(Uri.joinPath(webviewUri, 'codicon.css'))
    );
    /** 从`html`文件地址中读取字符串并替换`${}`格式的字符串为特定文件的`WebviewUri` */
    const html: string = readFileSync(htmlPath, 'utf-8').replace(
      /\${(\w+)}/g,
      (match, key) => htmlUris.get(key)?.toString() ?? html
    );
    return html;
  }
}
