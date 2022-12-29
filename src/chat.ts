import * as vscode from 'vscode';
import * as oicq from 'oicq';
import { Global } from './global';

interface WebviewPostData {
    command: keyof oicq.Client,
    params: any[],
    echo: string
}

const webviewMap: Map<number, vscode.WebviewPanel> = new Map;

vscode.commands.registerCommand("qlite.chat", openChatView);

function setHtml(uid: number, type: boolean, webview: vscode.Webview): string {
    const preload = webview.asWebviewUri(vscode.Uri.joinPath(Global.context.extensionUri, "assets", "preload.js")).toString();
    const css = webview.asWebviewUri(vscode.Uri.joinPath(Global.context.extensionUri, "assets", "style.css")).toString();
    const js = webview.asWebviewUri(vscode.Uri.joinPath(Global.context.extensionUri, "assets", "app.js")).toString();
    const path = webview.asWebviewUri(vscode.Uri.joinPath(Global.context.extensionUri, "assets")).toString();
    return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="referrer" content="never">
        <link rel="stylesheet" type="text/css" href="${css}" />
    </head>
    <body>
        <env self_id="${Global.client.uin}" nickname="${Global.client.nickname}" c2c="${type ? 0 : 1}" target_id="${uid}" temp="0" path="${path}" t="${Date.now()}">
        <script src="${preload}"></script>
        <script src="${js}"></script>
    </body>
    </html>`;
}

// this function is called when click a friend or a group
function openChatView(uid: number, type: boolean) {
    // get view name
    let label: string = type ? Global.client.gl.get(uid)?.group_name as string : Global.client.fl.get(uid)?.remark as string;
    if (webviewMap.has(uid)) { // this view has generated before
        return webviewMap.get(uid)?.reveal();
    }
    // generate a chat view
    const chatView = vscode.window.createWebviewPanel("chat", label, -1, {
        enableScripts: true,
        enableCommandUris: true,
        retainContextWhenHidden: true
    });
    // add chat view to map
    webviewMap.set(uid, chatView);
    chatView.webview.html = setHtml(uid, type, chatView.webview);
    chatView.reveal();
    chatView.onDidDispose(() => {
        webviewMap.delete(uid);
    });
    chatView.webview.onDidReceiveMessage(async (data: WebviewPostData) => {
        try {
            if (data.command === "getChatHistory" && data.params?.[0] === "") {
                let buf: Buffer;
                if (type) { // group
                    buf = Buffer.alloc(21);
                } else {
                    buf = Buffer.alloc(17);
                }
                buf.writeUInt32BE(uid, 0);
                data.params[0] = buf.toString("base64");
            }
            const fn = Global.client[data.command];
            if (typeof fn === "function") {
                // @ts-ignore
                let ret = fn.apply(Global.client, Array.isArray(data.params) ? data.params : []);
                if (ret instanceof Promise) {
                    ret = await ret;
                }
                if (ret instanceof Map) {
                    ret = [...ret.values()];
                }
                // ret.echo = data.echo;
                chatView.webview.postMessage({echo: data.echo, data: ret});
            }
        } catch { }
    });
}

function postPrivateEvent(data: oicq.PrivateMessageEvent | oicq.PrivateMessage) {
    webviewMap.get(data.sender.user_id)?.webview.postMessage(data);
}

function postGroupEvent(data: oicq.GroupMessageEvent) {
    webviewMap.get(data.group_id)?.webview.postMessage(data);
}

function bind() {
    Global.client.on("message.group", postGroupEvent);
    Global.client.on("message.private", postPrivateEvent);
    Global.client.on("sync.message", postPrivateEvent);
}

export { bind };
