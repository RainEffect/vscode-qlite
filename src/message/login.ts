import { Command } from './message-handler';

/** 通用登录记录属性 */
interface Record {
  /** 登录方式 */
  method: 'password' | 'qrcode' | 'token';
  /** 自动登录 */
  autoLogin: boolean;
}

/** 密码登录 */
export interface PasswordRecord extends Record {
  method: 'password';
  /** 账号 */
  uin: number;
  /** 密码 */
  password?: string;
  /** 记住密码 */
  remember: boolean;
}

/** 二维码登录 */
export interface QrcodeRecord extends Record {
  method: 'qrcode';
}

/** `token`登录 */
export interface TokenRecord extends Record {
  method: 'token';
  /** 账号 */
  uin: number;
}

/** 登录记录类型 */
export type LoginRecord = PasswordRecord | QrcodeRecord | TokenRecord;

/** 登录页面指令表 */
export default interface LoginCommand extends Command {
  /** 获取上次的登录记录 */
  getRecord: {
    req: undefined;
    /** 登录信息，可能无登录记录 */
    res: LoginRecord | undefined;
  };
  /** 提交登录信息 */
  submitRecord: {
    /** 登录信息 */
    req: LoginRecord;
    /** 登录结果 */
    res: boolean;
  };
  /** 获取登录二维码 */
  getQrcode: {
    req: undefined;
    /** 二维码图片的`url` */
    res: string;
  };
}
