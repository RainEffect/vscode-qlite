import * as oicq from 'oicq';
import * as fs from 'fs';
import * as path from 'path';
import { Global } from './global';

/** 配置信息类 */
interface Config extends oicq.Config {
    /** 登录账号记录 */
    accounts: Map<number, string>
    /** 最近登陆的账号 */
    recentLogin: number
}

/** 配置文件信息 */
let config: Config;

/** 默认配置信息 */
const defaultConfig: Config = {
    accounts: new Map,
    recentLogin: 0
};

/**
 * 获取配置文件地址
 * @returns 配置文件地址
 */
function getConfigFilePath(): string {
    return path.join(Global.context.globalStorageUri.fsPath, "config.json");
}

/**
 * 从配置文件获取配置信息
 * @returns 文件配置
 */
function getConfig(): Config {
    try {
        config = JSON.parse(fs.readFileSync(getConfigFilePath(), {
            encoding: "utf-8"
        }));
        const map = new Map();
        for (let k of Object.keys(config.accounts)) {
            // @ts-ignore
            map.set(Number(k), (config.accounts[k]));
        }
        config.accounts = map;
    } catch {
        fs.writeFileSync(
            getConfigFilePath(),
            JSON.stringify(defaultConfig, null, 2)
        );
        config = defaultConfig;
    } finally {
        return config;
    }
}

/**
 * 修改配置文件
 * @param info 新增账号信息
 */
function setConfig(account?: number, password?: string) {
    if (!account) {
        config.recentLogin = 0;
    } else {
        if (!config.accounts.size) {
            config.accounts = new Map;
        }
        if (password && !config.accounts.has(account)) {
            config.accounts.set(account, password);
        }
        config.recentLogin = account;
    }
    const obj = Object.create(null);
    for (let [k, v] of config.accounts) {
        obj[k] = v;
    }
    fs.writeFileSync(getConfigFilePath(), JSON.stringify({
        accounts: obj, recentLogin: config.recentLogin
    }, null, 2));
}

/**
 * 返回登录配置信息
 * @returns 完整的配置信息
 */
function genClientConfig(): oicq.Config {
    return {
        data_dir: Global.context.globalStorageUri.fsPath,
        ignore_self: false,
        log_level: "off",
        reconn_interval: 0,
        platform: 5
    };
}

export { getConfig, setConfig, genClientConfig };
