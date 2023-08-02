import { OnlineStatus } from 'icqq';
import {
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

/** 登录页面的请求类型 */
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
/** 登录超时 */
export const loginTimeout: NotificationType<void> = {
  method: 'loginTimeout'
};
