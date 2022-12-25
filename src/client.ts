import * as vscode from 'vscode';
import * as oicq from 'oicq';
import * as crypto from 'crypto';
import * as config from './config';
import { Global } from './global';
import * as view from './view';

function createClient(uin: number) {
    // generate a client
    Global.client = oicq.createClient(uin, config.genClientConfig());
    // login failed
    Global.client.on("system.login.error", ({ message }) => {
        vscode.window.showErrorMessage(message);
    });
    // device confirm
    Global.client.on("system.login.device", ({ url }) => {
        const deviceConfirmWebview = vscode.window.createWebviewPanel("device", "[QQ]需要验证设备安全性(完成后请关闭)", -1, {
            enableScripts: true,
            enableCommandUris: true
        });
        deviceConfirmWebview.webview.html = `<html style="height: 100%"><body style="height: 100%; padding: 0"><iframe width="100%" height="100%" style="border: 0" src="${url}"></iframe></body></html>`;
        deviceConfirmWebview.reveal();
        deviceConfirmWebview.onDidDispose(() => {
            Global.client.login();
        });
        vscode.window.showInformationMessage(`[设备锁验证登录](${url})。`);
    });
    // slide confirm
    Global.client.on("system.login.slider", ({ url }) => {
        vscode.window.showInformationMessage(`[点击](${url})完成滑动验证码`);
        inputTicket();
    });
    // offline message
    Global.client.on("system.offline", ({ message }) => {
        vscode.window.showErrorMessage(message);
    });
    // online message
    Global.client.on("system.online", () => {
        vscode.window.showInformationMessage(`${Global.client.nickname}(${Global.client.uin}) 已上线。`);
        view.initLists();
    });
    // inputPassword();
}

// get user account
function inputAccount() {
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

// get user password
function inputPassword() {
    vscode.window.showInputBox({
        placeHolder: "请输入密码",
        password: true
    }).then((value) => {
        if (!value) {
            return;
        }
        const password = crypto.createHash('md5').update(value).digest();
        Global.client.login(value);
    });
}

// get ticket from slider catpcha
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

// the function is called when the user is logining
export function login() {
    // inputAccount();
    createClient(870552064);
    Global.client.login("dsfgvsg46s84");
}