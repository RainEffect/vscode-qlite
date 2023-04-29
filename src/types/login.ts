import { WebMessage } from '../webview/message-handler';

/** 登录页面涉及的所有消息指令 */
export interface CommandMap {
  init: {
    req: never;
    res: LoginRecord | undefined;
  };
  login: {
    req: LoginRecord;
    res: { ret: true | string };
  };
  qrcode: {
    req: never;
    res: { src: string };
  };
}

/** 请求消息 */
export interface ReqMsg<T extends keyof CommandMap> extends WebMessage {
  command: T;
  payload: CommandMap[T]['req'];
}

/** 响应消息 */
export interface ResMsg<T extends keyof CommandMap> extends WebMessage {
  command: T;
  payload: CommandMap[T]['res'];
}

/** 抽象登录记录接口 */
interface Record {
  /** 登录方式 */
  method: 'password' | 'qrcode' | 'token';
  /** 自动登录 */
  autoLogin: boolean;
}

/** 密码登录 */
export interface PasswordLoginRecord extends Record {
  method: 'password';
  /** 账号 */
  uin: number;
  /** 密码 */
  password?: string;
  /** 记住密码 */
  remember: boolean;
}

/** 二维码登录 */
export interface QrcodeLoginRecord extends Record {
  method: 'qrcode';
}

/** `token`登录 */
export interface TokenLoginRecord extends Record {
  method: 'token';
  /** 账号 */
  uin: number;
}

/** 登录记录类型 */
export type LoginRecord =
  | PasswordLoginRecord
  | QrcodeLoginRecord
  | TokenLoginRecord;
