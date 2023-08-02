import { OnlineStatus } from 'icqq';
import {
  MessageParticipant,
  NotificationType,
  RequestType
} from 'vscode-messenger-common';

/** 登录记录 */
export interface LoginInfo {
  /** 账号 */
  uin: number;
  /** 密码 */
  password: string;
  /** 自动登录 */
  autoLogin: boolean;
  /** 记住密码 */
  savePass: boolean;
  /** 在线状态 */
  onlineStatus: Exclude<OnlineStatus, OnlineStatus.Offline>;
}

/** 扩展接收端（webview）信息 */
export const webReceiver: MessageParticipant = {
  type: 'webview',
  webviewId: 'loginView'
};

/** 登录页面的请求类型表 */
/** 获取登录信息 */
export const getLoginInfo: RequestType<void, LoginInfo | undefined> = {
  method: 'getLoginInfo'
};
/** 提交登录信息 */
export const submitLoginInfo: NotificationType<LoginInfo> = {
  method: 'submitLoginInfo'
};
/** 登录结果 */
export const loginRet: NotificationType<boolean> = {
  method: 'loginRet'
};
