import * as vscode from 'vscode';
import * as oicq from 'oicq';

/** 全局类 */
class Global {
    /** 扩展菜单 */
    static context: vscode.ExtensionContext;
    /** 客户端信息 */
    static client: oicq.Client;
    /** 侧边栏视图 */
    static qliteTreeView: vscode.TreeView<vscode.TreeItem>;
}

export { Global };
