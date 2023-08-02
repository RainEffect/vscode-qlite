import { Client } from 'icqq';
import {
  Uri,
  WebviewView,
  WebviewViewProvider,
  commands,
  window
} from 'vscode';
import LoginRecordManager from '../login-record';
import * as login from '../message/login';
import { getHtmlForWebview } from '../global';
import { Messenger } from 'vscode-messenger';

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
    const messenger = new Messenger();
    messenger.registerWebviewView(webviewView);
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.html = getHtmlForWebview(webviewView.webview, 'login');
    /** 处理来自页面的消息 */
    // 获取登录记录
    messenger.onRequest(login.getLoginInfo, () => {
      if (this.isEmpty) {
        this.isEmpty = false;
        return;
      } else {
        return LoginRecordManager.getRecent();
      }
    });
    // 登录操作
    messenger.onNotification(login.submitLoginInfo, (loginInfo) => {
      this.client.login(loginInfo.uin, loginInfo.password);
      // 10s无响应则返回登录失败的信息
      const timeout = setTimeout(() => {
        window
          .showErrorMessage(
            '登录失败，是否要在开发人员工具中查看日志输出？',
            '是',
            '否'
          )
          .then((value) => {
            if (!value || value === '否') {
              return;
            }
            commands.executeCommand(
              'workbench.action.webview.openDeveloperTools'
            );
          });
        messenger.sendNotification(login.loginRet, login.webReceiver, false);
        errorDispose();
      }, 10e3);
      // 登录成功
      const onlineDispose = this.client.on('system.online', () => {
        this.client.setOnlineStatus(loginInfo.onlineStatus);
        // 更新账号记录
        LoginRecordManager.setRecent(this.client.uin, loginInfo);
        commands.executeCommand('setContext', 'qlite.isOnline', true);
        clearTimeout(timeout);
        onlineDispose();
        errorDispose();
      });
      // 登录失败
      const errorDispose = this.client.on('system.login.error', (error) => {
        window.showErrorMessage(error.message);
        messenger.sendNotification(login.loginRet, login.webReceiver, false);
        clearTimeout(timeout);
        onlineDispose();
        errorDispose();
      });
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
      console.warn("it's not working when loginView is active");
    }
    this.isEmpty = isEmpty;
  }
}
