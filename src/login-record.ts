import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import Global from './global';
import { LoginInfo } from './message/login';

/** 登录记录文件接口 */
interface LoginRecords {
  /** 最近登录的账号 */
  recent: number;
  /** 登录账号历史记录 */
  info: Map<number, LoginInfo>;
}

/** 读取`login-record.json`文件时调用，解析`json`数据 */
function reviver(key: string, value: any) {
  if (key === 'recent') {
    return Number(value);
  }
  if (key === 'info') {
    const map = new Map<number, LoginInfo>();
    const obj = new Map(Object.entries(value)) as Map<string, LoginInfo>;
    for (const [k, v] of obj) {
      map.set(Number(k), v);
    }
    return map;
  }
  return value;
}

/** 登录记录管理器 */
export default class LoginRecordManager {
  /**
   * 获取文件路径
   * @returns `login-record.json`的绝对路径
   */
  private static getFilePath(): string {
    return path.join(Global.rootDir, 'login-record.json');
  }

  /**
   * 读取文件
   * @returns 登录记录
   */
  private static getRecords(): LoginRecords {
    const filePath = this.getFilePath();
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath).toString(), reviver);
    }
    // 文件不存在，需要添加默认文件内容
    const defaultRecords: LoginRecords = { recent: 0, info: new Map() };
    writeFileSync(filePath, JSON.stringify(defaultRecords, undefined, 2));
    return defaultRecords;
  }

  /**
   * 获取最近一次的登录记录
   * @returns 最近的登录记录，若`recent = 0`则为空
   */
  static getRecent(): LoginInfo | undefined {
    const records = this.getRecords();
    return records.info.get(records.recent);
  }

  /**
   * 更新最近登录的账号记录到文件中
   * @param uin 登录账号
   */
  static setRecent(uin: number): void;
  /**
   * 写入登录记录到文件中
   * @param uin 登录账号
   * @param info 需要添加/修改的登录记录
   */
  static setRecent(uin: number, info: LoginInfo): void;
  static setRecent(uin: number, info?: LoginInfo) {
    const records = this.getRecords();
    if (!info) {
      // 更新`recent`键值
      if (!records.info.get(uin)) {
        // uin在info中没有记录说明是非法uin
        throw Error('invalid uin');
      }
    } else {
      if (!info.savePass) {
        info.password = '';
      }
      // 写入账号记录
      records.info.set(uin, info);
    }
    records.recent = uin;
    writeFileSync(
      this.getFilePath(),
      JSON.stringify(
        records,
        (key, value) => (key === 'info' ? Object.fromEntries(value) : value),
        2
      )
    );
  }

  /**
   * 获取登录账号记录列表
   * @returns 登录过的账号记录的账号与昵称表
   */
  static async getLoginRecord(): Promise<Map<number, string>> {
    const recordMap: Map<number, string> = new Map();
    const records: LoginRecords = this.getRecords();
    for (const [uin] of records.info.entries()) {
      const info = await Global.client.pickUser(uin).getSimpleInfo();
      recordMap.set(uin, info.nickname);
    }
    return recordMap;
  }
}
