import * as fs from 'fs';
import path from 'path';
import Global from './global';
import { LoginRecord } from './message/login';

/** 登录记录文件接口 */
interface LoginRecords {
  /** 最近登录的账号 */
  recent: number;
  /** 登陆账号历史记录 */
  data: Map<number, LoginRecord>;
}

/** 读取`login-record.json`文件时调用，解析`json`数据 */
function parseFile(key: string, value: any) {
  if (key === 'recent') {
    return Number(value);
  }
  if (key === 'data') {
    const map = new Map<number, LoginRecord>();
    const obj = new Map(Object.entries(value)) as Map<string, LoginRecord>;
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
  private static readFile(): LoginRecords {
    const filePath: string = this.getFilePath();
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath).toString(), parseFile);
    } else {
      const defaultAccounts: LoginRecords = {
        recent: 0,
        data: new Map()
      };
      fs.writeFileSync(filePath, JSON.stringify(defaultAccounts, undefined, 2));
      return defaultAccounts;
    }
  }

  /**
   * 获取最近一次的登录记录
   * @returns 最近的登录记录，若`recent = 0`则为空
   */
  static getRecent(): LoginRecord | undefined {
    const records: LoginRecords = this.readFile();
    const recentRecord = records.data.get(records.recent);
    if (records.recent !== 0 && !recentRecord) {
      throw Error('invalid recent record');
    }
    return recentRecord;
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
  static setRecent(uin: number, info: LoginRecord): void;
  static setRecent(uin: number, info?: LoginRecord) {
    const records: LoginRecords = this.readFile();
    if (!info) {
      // 更新`recent`键值
      const record: LoginRecord | undefined = records.data.get(uin);
      if (!record) {
        throw Error('invalid uin');
      }
      records.recent = uin;
    } else {
      // 写入账号记录
      records.data.set(uin, info);
      records.recent = uin;
    }
    fs.writeFileSync(
      this.getFilePath(),
      JSON.stringify(
        records,
        (key, value) => (key === 'data' ? Object.fromEntries(value) : value),
        2
      )
    );
  }

  /**
   * 获取登录账号列表
   * @returns 登录过的账号字典
   */
  static async getAll(): Promise<Map<number, string>> {
    const recordMap: Map<number, string> = new Map();
    const records: LoginRecords = this.readFile();
    for (const [uin] of records.data.entries()) {
      const info = await Global.client.pickUser(uin).getSimpleInfo();
      recordMap.set(uin, info.nickname);
    }
    return recordMap;
  }
}
