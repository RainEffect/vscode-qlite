import * as vscode from 'vscode';
import * as oicq from 'oicq';
import * as fs from 'fs';
import * as path from 'path';
import { Global } from './global';

// 配置类
interface Config extends oicq.Config {
    // 用户账号
    account?: number,
    // 密码（md5加密）
    password?: string
}

// 配置文件信息
let config: Config | undefined;

// 默认配置信息
const defaultConfig: Config = {
    account: 0,
    password: ""
};

/**
 * 获取配置文件地址
 * @returns 配置文件地址
 */
function getConfigFilePath() {
    return path.join(Global.context.globalStorageUri.fsPath, "config.json");
}

/**
 * 从配置文件获取配置信息
 * @returns 文件配置
 */
function getConfig(): Config {
    try {
        config = JSON.parse(fs.readFileSync(getConfigFilePath(), { encoding: "utf-8" }));
    } catch {
        fs.writeFileSync(getConfigFilePath(), JSON.stringify(defaultConfig, null, 2));
        config = defaultConfig;
    }
    return config as Config;
}

/**
 * 修改配置文件
 * @param conf 要修改的配置信息
 */
function setConfig(conf?: Config) {
    Object.assign(getConfig(), conf ? conf : { account: 0, password: "" });
    fs.writeFileSync(getConfigFilePath(), JSON.stringify(config, null, 2));
}

/**
 * 返回登录配置信息
 * @returns 完整的配置信息
 */
function genClientConfig(): Config {
    const clientConfig: oicq.Config = {
        data_dir: Global.context.globalStorageUri.fsPath,
        ignore_self: false,
        log_level: "off",
        reconn_interval: 0,
        platform: 5
    };
    return Object.assign(clientConfig, getConfig());
}

export { getConfig, setConfig, genClientConfig };
