export type InitReqMsg = { command: 'init' };
export type LoginReqMsg = { command: 'login'; data: LoginRecord };
export type QrcodeReqMsg = { command: 'qrcode' };

export type InitResMsg = LoginRecord | undefined;
export type LoginResMsg = {};
export type QrcodeResMsg = { src: string };

export type ErrorMsg = { reason: string };

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
