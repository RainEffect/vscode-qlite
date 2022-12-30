import * as vscode from 'vscode';
import { bind } from './chat';
import * as config from './config';
import { Global } from './global';

// 数据容器
class QliteTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    newsListTree = new NewsListTree("消息");
    contactsListTree = new ContactsListTree("联系人");
    // TODO: 实现更新树视图事件
    onDidChangeTreeData?: vscode.Event<vscode.TreeItem> | undefined;
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
    getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
        if (element === undefined) { // 根目录
            return [this.newsListTree, this.contactsListTree];
        } else if (element instanceof NewsListTree) {
            return element.newsList;
        } else if (element instanceof ContactsListTree) {
            return [element.friendClassesListTree, element.groupClassesListTree];
        } else if (element instanceof ClassesListTree) {
            return element.classesList;
        } else if (element instanceof ItemListTree) {
            return element.infoList;
        }
    }
}

// 消息目录
class NewsListTree extends vscode.TreeItem {
    newsList: InfoTreeItem[];
    constructor(label: string | vscode.TreeItemLabel) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.newsList = [];
    }
}

// 群聊目录
class ContactsListTree extends vscode.TreeItem {
    friendClassesListTree: ClassesListTree;
    groupClassesListTree: ClassesListTree;
    constructor(label: string | vscode.TreeItemLabel) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.friendClassesListTree = new ClassesListTree("分组", Global.client.classes);
        this.groupClassesListTree = new ClassesListTree("群组", new Map([
            [-1, "我创建的"],
            [-2, "我管理的"],
            [-3, "我加入的"]
        ]));
    }
}

// 分组目录
class ClassesListTree extends vscode.TreeItem {
    classesList: ItemListTree[];
    constructor(label: string | vscode.TreeItemLabel, classesList: Map<number, string>) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.classesList = [];
        for (let classesItem of classesList) {
            let classesTreeItem = new ItemListTree(classesItem);
            this.classesList.push(classesTreeItem);
        }
    }
}

// 好友/群列表
class ItemListTree extends vscode.TreeItem {
    infoList: InfoTreeItem[];
    constructor([classId, label]: [number, string | vscode.TreeItemLabel]) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.infoList = [];
        if (classId >= 0) { // 好友分组
            for (let [, friend] of Global.client.fl) {
                if (friend.class_id === classId) {
                    this.infoList.push(new InfoTreeItem(friend.remark, friend.user_id, true));
                }
            }
        } else { // 群分组
            for (let [, group] of Global.client.gl) {
                if ((this.label === "我创建的" && group.owner_id === Global.client.uin) ||
                    (this.label === "我管理的" && group.owner_id !== Global.client.uin && group.admin_flag) ||
                    (this.label === "我加入的" && group.owner_id !== Global.client.uin && !group.admin_flag)) {
                    this.infoList.push(new InfoTreeItem(group.group_name, group.group_id, false));
                }
            }
        }
    }
}

// 好友/群信息
class InfoTreeItem extends vscode.TreeItem {
    constructor(label: string | vscode.TreeItemLabel, uid: number, c2c: boolean) {
        super(label);
        this.command = {
            title: "打开消息",
            command: "qlite.chat",
            arguments: [uid, c2c]
        };
    }
}

// 账号登录时调用，读取账号好友/群列表
function initLists() {
    // 创建树视图
    let qliteTreeDataProvider = new QliteTreeDataProvider;
    vscode.window.registerTreeDataProvider("qliteExplorer", qliteTreeDataProvider);
    let qliteTreeView = vscode.window.createTreeView("qliteExplorer", {
        treeDataProvider: qliteTreeDataProvider
    });
    bind(); // 绑定命令
}

export { initLists };
