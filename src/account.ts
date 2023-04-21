import * as path from 'path';
import * as fs from 'fs';
import Global from './global';
import { LoginData } from './api/web-login';

/** 文件账号信息 */
interface Accounts {
  /** 最近登录的账号 */
  recent: number;
  /** 登陆账号历史记录 */
  data: LoginData[];
}

/** 账号文件管理 */
export default class AccountManager {
  /**
   * 获取账号文件地址
   */
  private static getFilePath(): string {
    return path.join(Global.rootDir, 'account.json');
  }

  /**
   * 读取文件
   * @returns 文件内容
   */
  private static readFile(): Accounts {
    if (fs.existsSync(this.getFilePath())) {
      return JSON.parse(fs.readFileSync(this.getFilePath()).toString());
    } else {
      const defaultAccounts: Accounts = {
        recent: 0,
        data: []
      };
      fs.writeFileSync(
        this.getFilePath(),
        JSON.stringify(defaultAccounts, undefined, 2)
      );
      return defaultAccounts;
    }
  }

  /**
   * 获取最近登录信息
   * @returns 最近登录的账号信息
   */
  public static getRecent(): LoginData | undefined {
    const accounts: Accounts = this.readFile();
    const recentAcc = accounts.data.find((acc) => acc.uin === accounts.recent);
    if (!recentAcc) {
      console.error('read account file error');
    }
    return recentAcc;
  }

  /**
   * 添加账号信息到文件中
   * @param account 需要添加的账号信息
   */
  public static setRecent(account: LoginData | number) {
    const accounts: Accounts = this.readFile();
    if (typeof account === 'number') {
      const accIndex: number = accounts.data.findIndex(
        (acc) => acc.uin === account
      );
      if (accIndex === -1) {
        console.error('invalid account');
        return;
      }
      accounts.recent = account;
    } else {
      const accIndex: number = accounts.data.findIndex(
        (acc) => acc.uin === account.uin
      );
      if (account.qrcode) {
        // 二维码登录不记录密码和选项信息
        account.password = '';
        account.remember = false;
        account.autoLogin = false;
      } else if (!account.remember) {
        // 选择不记住密码则删除密码信息
        account.password = '';
        account.autoLogin = false;
      }
      if (accIndex > -1) {
        // 覆盖保存
        accounts.data[accIndex] = account;
      } else {
        // 添加新账号信息
        accounts.data.push(account);
      }
      accounts.recent = account.uin;
    }
    fs.writeFileSync(
      this.getFilePath(),
      JSON.stringify(accounts, undefined, 2)
    );
  }

  /**
   * 获取登陆账号列表
   * @returns 登陆过的账号列表
   */
  public static getAll(): number[] {
    const accs: number[] = [];
    const accounts: Accounts = this.readFile();
    accounts.data.forEach((account: LoginData) => {
      accs.push(account.uin);
    });
    return accs;
  }
}
