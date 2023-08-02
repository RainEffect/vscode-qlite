import { OnlineStatus } from 'icqq';
import { NotificationType, RequestType } from 'vscode-messenger-common';

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

/** 登录页面的请求类型表 */
export default class LoginReqType {
  static readonly getLoginInfo: RequestType<void, LoginInfo | undefined> = {
    method: 'getLoginInfo'
  };
  static readonly submitLoginInfo: NotificationType<LoginInfo> = {
    method: 'submitLoginInfo'
  };
  static readonly loginRet: NotificationType<boolean> = {
    method: 'loginRet'
  };
}
