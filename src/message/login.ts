import { OnlineStatus } from 'icqq';
import { Command } from './message-handler';

/** 登录记录 */
export interface Record {
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

/** 登录页面指令表 */
export default interface LoginCommand extends Command {
  /** 获取上次的登录记录 */
  getRecord: {
    req: undefined;
    /** 登录信息，可能无登录记录 */
    res: Record | undefined;
  };
  /** 提交登录信息 */
  submitRecord: {
    /** 登录信息 */
    req: Record;
    res: undefined;
  };
  /** 回应登录结果 */
  loginRet: {
    /** 登录是否成功 */
    req: boolean;
    /** 响应消息 */
    res: true;
  };
}
