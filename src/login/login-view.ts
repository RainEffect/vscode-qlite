import {
  Uri,
  WebviewView,
  WebviewViewProvider,
  commands,
  window
} from 'vscode';
import LoginRecordManager from '../login-record';
import * as login from '../message/login';
import Global, { getHtmlForWebview } from '../global';

/** 登录界面容器类 */
export default class LoginViewProvider implements WebviewViewProvider {
  /** 是否以空表形式加载视图 */
  private isEmpty = false;
  /** 显示的视图 */
  private _view?: WebviewView;
  /**
   * @param extensionUri 扩展根目录
   */
  constructor(private readonly extensionUri: Uri) {}

  resolveWebviewView(webviewView: WebviewView) {
    this._view = webviewView;
    const msgParticipant = Global.messenger.registerWebviewView(webviewView);
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };
    webviewView.webview.html = getHtmlForWebview(webviewView.webview, 'login');
    /** 处理来自页面的消息 */
    // 登录超时
    Global.messenger.onNotification(login.loginTimeout, () => {
      window
        .showWarningMessage(
          '登录尚未成功，是否要在开发人员工具中查看登录日志？',
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
    });
    // 获取登录记录
    Global.messenger.onRequest(login.getLoginInfo, () => {
      if (this.isEmpty) {
        this.isEmpty = false;
        return;
      } else {
        return LoginRecordManager.getRecent();
      }
    });
    // 登录操作
    Global.messenger.onNotification(login.submitLoginInfo, (loginInfo) => {
      Global.client.login(loginInfo.uin, loginInfo.password);
      const loginDispose = [
        Global.client.on('system.login.device', ({ url }) => {
          // 设备锁验证
          window
            .showInformationMessage(
              `请点击 [此网址](${url}) 进行设备锁验证。`,
              '已验证'
            )
            .then((value: string | undefined) => {
              if (!value) {
                window.showInformationMessage('已取消登录');
                Global.messenger.sendNotification(
                  login.loginRet,
                  msgParticipant,
                  false
                );
                loginDispose.forEach((dispose) => dispose());
              } else {
                Global.client.login();
              }
            });
        }),
        Global.client.on('system.login.slider', ({ url }) => {
          // 滑动验证码验证
          window.showInformationMessage(
            `请点击 [此网址](${url}) 完成滑动验证码。`
          );
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
                Global.messenger.sendNotification(
                  login.loginRet,
                  msgParticipant,
                  false
                );
                loginDispose.forEach((dispose) => dispose());
              } else {
                Global.client.submitSlider(ticket);
              }
            });
        }),
        // 登录成功
        Global.client.on('system.online', () => {
          Global.client.setOnlineStatus(loginInfo.onlineStatus);
          // 更新账号记录
          LoginRecordManager.setRecent(Global.client.uin, loginInfo);
          commands.executeCommand('setContext', 'qlite.isOnline', true);
          loginDispose.forEach((dispose) => dispose());
        }),
        // 登录失败
        Global.client.on('system.login.error', (error) => {
          window.showErrorMessage(error.message);
          Global.messenger.sendNotification(
            login.loginRet,
            msgParticipant,
            false
          );
          loginDispose.forEach((dispose) => dispose());
        })
      ];
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
