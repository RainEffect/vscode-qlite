import * as vscode from 'vscode';
import * as oicq from 'oicq';
import * as crypto from 'crypto';
import * as config from './config';
import { Global } from './global';
import * as view from './view';

// 登陆状态
let logining: boolean = false;
// 登录选项
const settings: Array<string> = [
    "切换账号",
    "我的状态",
    "登出账号"
];
// 当前状态
let selectedStatus: number = 11;
// 状态选项
const statusMap: Map<number, string> = new Map([
    [11, "在线"],
    [60, "Q我吧"],
    [31, "离开"],
    [50, "忙碌"],
    [70, "请勿打扰"],
    [41, "隐身"]
]);

/**
 * 生成一个客户端对象
 * @param uin 用户账号
 */
function createClient(uin: number) {
    Global.client = oicq.createClient(uin, config.genClientConfig());
    // 登陆失败
    Global.client.on("system.login.error", ({ message }) => {
        logining = false;
        if (message.includes("密码错误")) {
            config.setConfig();
        }
        vscode.window.showErrorMessage(message);
    });
    // 二维码登录
    Global.client.on("system.login.qrcode", ({ image }) => {
        const qrcodeWebview = vscode.window.createWebviewPanel("device", "手机QQ扫码登陆(完成后请关闭该页面)", -1, {
            enableScripts: true,
            enableCommandUris: true
        });
        qrcodeWebview.webview.html = `<img width="400px" height="400px" src="data:image/png; base64, ${image.toString("base64")}" />`;
        qrcodeWebview.reveal();
        qrcodeWebview.onDidDispose(() => {
            Global.client.login();
        });
    });
    // 设备锁验证
    Global.client.on("system.login.device", ({ url }) => {
        vscode.window.showInformationMessage(`[点击](${url})进行设备锁登录验证。`, "验证完成").then((value) => {
            if (value === "验证完成") {
                Global.client.login();
            }
        });
    });
    // 滑动验证
    Global.client.on("system.login.slider", ({ url }) => {
        vscode.window.showInformationMessage(`[点击](${url})完成滑动验证`);
        inputTicket();
    });
    // 离线
    Global.client.on("system.offline", ({ message }) => {
        logining = false;
        vscode.window.showErrorMessage(message);
    });
    // 上线
    Global.client.on("system.online", () => {
        logining = false;
        config.setConfig({
            account: Global.client.uin,
            password: Global.client.password_md5 ? Global.client.password_md5.toString("hex") : "qrcode"
        });
        vscode.window.showInformationMessage(`${Global.client.nickname}(${Global.client.uin}) 已上线。`);
        view.initLists();
    });
    inputPassword();
}

/**
 * 输入账号
 */
function inputAccount() {
    // 读取配置信息的账号
    const uin = config.getConfig().account as number;
    if (uin > 10000 && uin < 0xffffffff) {
        return createClient(uin);
    }
    vscode.window.showInputBox({
        placeHolder: "请输入QQ账号",
    }).then((value) => {
        if (!value) {
            return;
        }
        try {
            createClient(Number(value));
        } catch {
            inputAccount();
        }
    });
}

/**
 * 输入密码
 */
function inputPassword() {
    let password = config.getConfig().password;
    if (password === "qrcode") {
        return Global.client.login();
    } else if (password) {
        return Global.client.login(password);
    }
    vscode.window.showInputBox({
        placeHolder: "请输入密码",
        password: true
    }).then((value) => {
        if (!value) {
            return Global.client.login();
        }
        logining = true;
        Global.client.login(crypto.createHash('md5').update(value).digest());
    });
}

/**
 * 输入验证码ticket
 */
function inputTicket() {
    vscode.window.showInputBox({
        placeHolder: "请输入验证码"
    }).then((value) => {
        if (!value) {
            inputTicket();
        } else {
            Global.client.submitSlider(value);
        }
    });
}

/**
 * 登录入口
 */
export function login() {
    if (Global.client === undefined || !Global.client.isOnline()) {
        inputAccount();
        return;
    }
    vscode.window.showQuickPick(settings).then((value) => {
        if (value === "切换账号") {
            Global.client.logout();
            config.setConfig();
            inputAccount();
        } else if (value === "我的状态") {
            const statusArray = [...statusMap.values()];
            vscode.window.showQuickPick([...statusMap.values()], {
                placeHolder: "切换我的状态",
                title: "当前状态：" + statusMap.get(Global.client.status)
            }).then((value) => {
                if (value === undefined) {
                    return;
                }
                if (logining) {
                    vscode.window.showInformationMessage("登陆中...");
                    return;
                }
                selectedStatus = [...statusMap.keys()][statusArray.indexOf(value)];
                if (Global.client.isOnline()) {
                    Global.client.setOnlineStatus(selectedStatus);
                }
            });
        } else if (value === "登出账号") {
            Global.client.logout();
        }
    });
}
