import * as vscode from 'vscode';
import * as oicq from 'oicq';
import { Global } from './global';

// 发送给页面的数据类
interface WebviewPostData {
    command: keyof oicq.Friend | keyof oicq.Group, // 指令
    params: any[], // 参数
    echo: string // 消息的唯一标识，用于一对一响应指令，由 Date.now() + Math.random() 组成
}

// 页面缓存, 按聊天类型和对象id建立与聊天页面的索引
const webviewMap: Map<[boolean, number], vscode.WebviewPanel> = new Map;

/**
 * 初始化聊天页面的html
 * @param uin 目标账号
 * @param c2c 是否是私聊
 * @param webview 聊天页面的webview类，用于转换本地文件路径
 * @returns 生成的html
 */
function setHtml(uin: number, c2c: boolean, webview: vscode.Webview): string {
    const assetUri = vscode.Uri.joinPath(Global.context.extensionUri, "assets");
    const path = webview.asWebviewUri(assetUri).toString();
    const preload = webview.asWebviewUri(vscode.Uri.joinPath(assetUri, "preload.js")).toString();
    const css = webview.asWebviewUri(vscode.Uri.joinPath(assetUri, "style.css")).toString();
    const js = webview.asWebviewUri(vscode.Uri.joinPath(assetUri, "app.js")).toString();
    return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="referrer" content="never">
        <link rel="stylesheet" type="text/css" href="${css}" />
    </head>
    <body>
        <env self_id="${Global.client.uin}" nickname="${Global.client.nickname}" c2c="${c2c ? 1 : 0}" target_id="${uin}" temp="0" path="${path}" t="${Date.now()}">
        <script src="${preload}"></script>
        <script src="${js}"></script>
    </body>
    </html>`;
}

/**
 * 生成一个聊天页面
 * @param uin 目标账号
 * @param c2c 是否是私聊
 */
function openChatView(uin: number, c2c: boolean) {
    let label: string | undefined = c2c ? Global.client.fl.get(uin)?.remark : Global.client.gl.get(uin)?.group_name;
    if (webviewMap.has([c2c, uin])) { // 读取页面缓存
        return webviewMap.get([c2c, uin])?.reveal();
    }
    const chatView = vscode.window.createWebviewPanel("chat", label as string, -1, {
        enableScripts: true,
        enableCommandUris: true,
        retainContextWhenHidden: true
    });
    // 添加页面缓存
    webviewMap.set([c2c, uin], chatView);
    chatView.webview.html = setHtml(uin, c2c, chatView.webview);
    chatView.reveal();
    chatView.onDidDispose(() => {
        webviewMap.delete([c2c, uin]);
    });
    chatView.webview.onDidReceiveMessage(async (data: WebviewPostData) => {
        try {
            const fn = c2c ? Global.client.pickFriend(uin)[data.command as keyof oicq.Friend] as Function
                            : Global.client.pickGroup(uin)[data.command as keyof oicq.Group] as Function;
            let ret = fn.apply(c2c ? Global.client.pickFriend(uin) : Global.client.pickGroup(uin), data.params);
            if (ret instanceof Promise) {
                ret = await ret;
            }
            if (ret instanceof Map) {
                ret = [...ret.values()];
            }
            // 响应信息
            chatView.webview.postMessage({
                echo: data.echo,
                data: ret
            });
        } catch { }
    });
}

/**
 * 向页面发送私聊信息
 * @param event 私聊事件
 */
function postPrivateEvent(event: oicq.PrivateMessageEvent | oicq.PrivateMessage) {
    webviewMap.get([true, event.sender.user_id])?.webview.postMessage(event);
}

/**
 * 向页面发送群聊信息
 * @param event 群聊信息
 */
function postGroupEvent(event: oicq.GroupMessageEvent) {
    webviewMap.get([false, event.group_id])?.webview.postMessage(event);
}

/**
 * 绑定消息事件
 */
function bind() {
    Global.client.on("message.group", postGroupEvent);
    Global.client.on("message.private", postPrivateEvent);
    Global.client.on("sync.message", postPrivateEvent);
}

export { openChatView, bind };
