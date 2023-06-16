import { Client } from 'icqq';
import {
  Uri,
  WebviewView,
  WebviewViewProvider,
  commands,
  window
} from 'vscode';
import LoginRecordManager from '../login-record';
import LoginCommand from '../message/login';
import MessageHandler from '../message/message-handler';
import { getHtmlForWebview } from '../global';

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
    webviewView.webview.html = getHtmlForWebview(webviewView.webview, 'login');
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
}
