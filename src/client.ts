import * as vscode from 'vscode';
import * as oicq from 'oicq';
import * as crypto from 'crypto';
import * as config from './config';
import { Global } from './global';
import * as view from './view';

/** 登陆状态 */
let logining: boolean = false;
/** 当前状态 */
let selectedStatus: number = 11;
/** 状态选项 */
const statusMap: Map<number, string> = new Map([
    [11, "在线"],
    [60, "Q我吧"],
    [31, "离开"],
    [50, "忙碌"],
    [70, "请勿打扰"],
    [41, "隐身"]
]);

/**
 * 构造一个client实例
 * @param uin 用户账号
 */
function createClient(uin: number) {
    Global.client = oicq.createClient(uin, config.genClientConfig());
    // 登陆失败
    Global.client.on("system.login.error", (event) => {
        logining = false;
        vscode.window.showErrorMessage(event.message + "\nError Code: " + event.code);
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
            Global.client.qrcodeLogin();
        });
    });
    // 设备锁验证
    Global.client.on("system.login.device", ({ url }) => {
        vscode.window.showInformationMessage(`[点我](${url})完成设备锁登录验证。`, "完成").then((value) => {
            if (value === "完成") {
                Global.client.login();
            }
        });
    });
    // 滑动验证
    Global.client.on("system.login.slider", ({ url }) => {
        vscode.window.showInformationMessage(`[点我](${url})完成滑动验证`);
        inputTicket();
    });
    // 离线
    Global.client.on("system.offline", ({ message }) => {
        vscode.commands.executeCommand("setContext", "qlite.isOnline", false);
        logining = false;
        vscode.window.showErrorMessage(message);
    });
    // 上线
    Global.client.on("system.online", () => {
        logining = false;
        config.setConfig(
            Global.client.uin,
            Global.client.password_md5 ? Global.client.password_md5.toString("hex") : "qrcode"
        );
        // vscode.window.showInformationMessage(`${Global.client.nickname}(${Global.client.uin}) 已上线。`);
        view.createTreeView();
        vscode.commands.executeCommand("setContext", "qlite.isOnline", true);
    });
    inputPassword();
}

/**
 * 输入账号，响应login指令
 */
function inputAccount() {
    const uin = config.getConfig().recentLogin;
    if (uin) {
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
    const conf = config.getConfig();
    let password = conf.accounts.get(conf.recentLogin);
    if (password === "qrcode") {
        return Global.client.qrcodeLogin();
    } else if (password) {
        return Global.client.login(password);
    }
    vscode.window.showInputBox({
        placeHolder: "请输入密码，此处留空则使用二维码登录",
        password: true
    }).then((value) => {
        if (!value) {
            return Global.client.qrcodeLogin();
        }
        logining = true;
        Global.client.login(crypto.createHash("md5").update(value).digest());
    });
}

/**
 * 输入验证码ticket
 */
function inputTicket() {
    vscode.window.showInputBox({
        placeHolder: "请输入验证码"
    }).then((ticket) => {
        if (!ticket) {
            inputTicket();
        } else {
            Global.client.submitSlider(ticket);
        }
    });
}

/**
 * 设置，响应setting指令
 */
function setting() {
    /** 设置选项 */
    const settings: vscode.QuickPickItem[] = [
        {
            "label": "$(account) 切换账号",
            "description": `${Global.client.nickname}(${Global.client.uin})`
        },
        {
            "label": "$(bell) 我的状态",
            "description": statusMap.get(selectedStatus)
        }
    ];
    vscode.window.showQuickPick(settings).then((value) => {
        switch (value) {
            case settings[0]:
                const accounts: vscode.QuickPickItem[] = [];
                accounts.push({ label: "$(warning) 直接退出" });
                accounts.push({ label: "$(log-in) 登录新账号"});
                for (let [account] of config.getConfig().accounts) {
                    accounts.push({
                        label: String(account),
                        description: config.getConfig().recentLogin === account ? "最近登录" : ""
                    });
                }
                vscode.window.showQuickPick(accounts).then((account) => {
                    if (!account) {
                        return;
                    }
                    Global.client.logout();
                    vscode.commands.executeCommand("setContext", "qlite.isOnline", false);
                    Global.qliteTreeView.dispose();
                    if (account === accounts[0]) {
                        return;
                    } else if (account === accounts[1]) {
                        config.setConfig();
                        inputAccount();
                    } else {
                        const uin = Number(account.label);
                        config.setConfig(uin);
                        createClient(uin);
                    }
                });
                break;
            case settings[1]:
                const statusArray = [...statusMap.values()];
                vscode.window.showQuickPick([...statusMap.values()], {
                    placeHolder: "当前状态：" + statusMap.get(Global.client.status)
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
                break;
        }
    });
}

export { setting, inputAccount };
