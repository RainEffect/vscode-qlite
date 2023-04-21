import { WebMsg } from './webview';
import { PreReqWebMsg, ResWebMsg } from './webview';
/** 定义表单数据 */
export interface LoginData {
  /** QQ账号 */
  uin: number;
  /** 密码 */
  password: string;
  /** 是否记住密码 */
  remember: boolean;
  /** 是否自动登录 */
  autoLogin: boolean;
  /** 是否使用扫码登陆，若此项为真则前面信息无效 */
  qrcode: boolean;
}

type InitReqMsg = PreReqWebMsg<undefined> & { command: 'init' };

type LoginReqMsg = PreReqWebMsg<LoginData> & { command: 'login' };

type QrcodeReqMsg = PreReqWebMsg<undefined> & { command: 'qrcode' };

export type PreReqMsg = InitReqMsg | LoginReqMsg | QrcodeReqMsg;
export type ReqMsg = PreReqMsg & WebMsg;

type InitResMsg = ResWebMsg<
  | { uin: number; remember: false }
  | {
      uin: number;
      password: string;
      remember: true;
      autoLogin: boolean;
    }
  | undefined
>;

type LoginResMsg = ResWebMsg<{ ret: boolean }>;

type QrcodeResMsg = ResWebMsg<{ src: string }>;

export type ResMsg = InitResMsg | LoginResMsg | QrcodeResMsg;
