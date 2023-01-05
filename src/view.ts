import * as vscode from 'vscode';
import { bind } from './chat';
import { Global } from './global';

// 消息类
interface News {
    c2c: boolean,
    uin: number,
    item: InfoTreeItem,
    cnt: number
}

// 全局实例化容器
let qliteTreeDataProvider: QliteTreeDataProvider;
// 消息列表记录
let newsList: News[] = [];

// 数据容器
class QliteTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    newsListTree = new NewsListTree("消息");
    contactsListTree = new ContactsListTree("联系人");
    _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
    getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
        if (!Global.client.isOnline()) { // 离线不显示列表
            return [];
        } else if (element === undefined) { // 根目录
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
    refresh() {
        this.newsListTree = new NewsListTree("消息");
        this.contactsListTree = new ContactsListTree("联系人");
        this._onDidChangeTreeData.fire();
    }
}

// 消息目录
class NewsListTree extends vscode.TreeItem {
    newsList: InfoTreeItem[] = [];
    constructor(label: string | vscode.TreeItemLabel) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        newsList.forEach((value, index) => {
            if (value.c2c ? Global.client.pickFriend(value.uin) : Global.client.pickGroup(value.uin)) {
                this.newsList.push(value.item);
            } else {
                delete newsList[index];
            }
        });
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
    constructor(label: string | vscode.TreeItemLabel, uid: number, c2c: boolean, description?: string) {
        super(label);
        this.command = {
            title: "打开消息",
            command: "qlite.chat",
            arguments: [uid, c2c]
        };
        this.description = description;
    }
}

/**
 * 账号登录时调用，读取账号好友/群列表
 */
function createTreeView() {
    // 创建树视图
    qliteTreeDataProvider = new QliteTreeDataProvider;
    vscode.window.registerTreeDataProvider("qliteExplorer", qliteTreeDataProvider);
    let qliteTreeView = vscode.window.createTreeView("qliteExplorer", {
        treeDataProvider: qliteTreeDataProvider
    });
    // 注册通知事件处理
    Global.client.on("notice.friend.decrease", (event) => {
        vscode.window.showInformationMessage("你删除了好友：" + event.nickname + `(${event.user_id})`);
        qliteTreeDataProvider.refresh();
    });
    Global.client.on("notice.friend.increase", (event) => {
        vscode.window.showInformationMessage("你添加了好友：" + event.nickname + `(${event.user_id})`);
        qliteTreeDataProvider.refresh();
    });
    Global.client.on("notice.group.admin", (event) => {
        if (event.user_id === Global.client.uin) {
            vscode.window.showInformationMessage(event.set ? "你已成为" : "你被取消了" + "群：" + event.group.name + "的管理员");
        }
    });
    Global.client.on("notice.group.transfer", (event) => {
        if (event.user_id === Global.client.uin) {
            vscode.window.showInformationMessage("群：" + event.group.name + " 的群主已将群主身份转让给你");
        }
    });
    Global.client.on("notice.group.increase", (event) => {
        if (event.user_id === Global.client.uin) {
            vscode.window.showInformationMessage("你已加入群：" + event.group.name);
            qliteTreeDataProvider.refresh();
        }
    });
    Global.client.on("notice.group.decrease", (event) => {
        if (event.user_id === Global.client.uin) {
            let msg: string;
            if (event.dismiss) {
                msg = "群：" + event.group_id + " 已解散";
            } else if (event.operator_id === Global.client.uin) {
                msg = "你退出了群：" + event.group.name;
            } else {
                msg = event.group.pickMember(event.operator_id).card + " 将你踢出了群:" + event.group.name;
            }
            vscode.window.showInformationMessage(msg);
            qliteTreeDataProvider.refresh();
        }
    });
    bind(); // 绑定命令
}

/**
 * 更新新消息列表
 * @param c2c 私聊为true，群聊为false
 * @param uin 私聊为对方账号，群聊为群号
 * @param flag 有新消息为true，已读新消息为false
 */
function refreshContacts(c2c: boolean, uin: number, flag: boolean) {
    let news: News | undefined;
    newsList.forEach((value) => {
        if (value.c2c === c2c && value.uin === uin) {
            news = value;
        }
    });
    if (!news) { // 新消息列表中没有该消息
        const label = c2c ? Global.client.pickFriend(uin).remark : Global.client.pickGroup(uin).name;
        // 初始化新消息
        news = {
            c2c: c2c,
            uin: uin,
            item: new InfoTreeItem(label as string, uin, c2c, flag ? "+1" : ""),
            cnt: flag ? 1 : 0
        };
        newsList.unshift(news);
    } else {
        if (flag) { // 未读新消息
            news.cnt++;
            news.item.description = "+" + String(news.cnt);
            // 重新抽出该条消息到列表头
            newsList.splice(newsList.indexOf(news), 1);
            newsList.unshift(news);
        } else { // 已读新消息
            news.cnt = 0;
            news.item.description = false;
        }
    }
    // 最后刷新列表
    qliteTreeDataProvider.refresh();
}

export { createTreeView, refreshContacts, qliteTreeDataProvider };
