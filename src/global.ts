import * as vscode from 'vscode';
import * as oicq from 'oicq';

//全局类
class Global {
    // 扩展菜单
    public static context: vscode.ExtensionContext;
    // 客户端信息
    public static client: oicq.Client;
}

export { Global };
