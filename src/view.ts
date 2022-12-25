import * as vscode from 'vscode';
import * as config from './config';
import { Global } from './global';

// explorer tree data
class QliteTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    newsListTree = new NewsListTree("消息");
    contactsListTree = new ContactsListTree("联系人");
    onDidChangeTreeData?: vscode.Event<vscode.TreeItem> | undefined;
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
    getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
        if (element === undefined) { // root
            return [this.newsListTree, this.contactsListTree];
        } else if (element instanceof NewsListTree) { // news list
            return element.newsList;
        } else if (element instanceof ContactsListTree) { // contacts list
            return [element.friendClassesListTree, element.groupClassesListTree];
        } else if (element instanceof ClassesListTree) { // class list
            return element._classesList;
        } else if (element instanceof ItemListTree) { // info list
            return element._infoList;
        }
    }
}

// news list
class NewsListTree extends vscode.TreeItem {
    newsList: InfoTreeItem[];
    constructor(label: string | vscode.TreeItemLabel) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.newsList = [];
    }
}

// contacts list
class ContactsListTree extends vscode.TreeItem {
    friendClassesListTree: ClassesListTree;
    groupClassesListTree: ClassesListTree;
    constructor(label: string | vscode.TreeItemLabel) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.friendClassesListTree = new ClassesListTree("分组", Global.client.classes);
        this.groupClassesListTree = new ClassesListTree("群组", new Map([
            [0, "我创建的"],
            [1, "我管理的"],
            [2, "我加入的"]
        ]));
    }
}

// classes list
class ClassesListTree extends vscode.TreeItem {
    public _classesList: ItemListTree[];
    constructor(label: string | vscode.TreeItemLabel, classesList: Map<number, string>) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this._classesList = [];
        for (let classesItem of classesList) {
            let classesTreeItem = new ItemListTree(classesItem, this.label === "分组" ? false : true);
            this._classesList.push(classesTreeItem);
        }
    }
}

// classes item
class ItemListTree extends vscode.TreeItem {
    public _type: boolean; // group for true, friend for false
    public _classId: number;
    public _infoList: InfoTreeItem[];
    constructor([classId, label]: [number, string | vscode.TreeItemLabel], type: boolean) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this._type = type;
        this._classId = classId;
        this._infoList = [];
        if (this._type) { // get group info
            for (let [, group] of Global.client.gl) {
                if ((this.label === "我创建的" && group.owner_id === Global.client.uin) ||
                (this.label === "我管理的" && group.owner_id !== Global.client.uin && group.admin_flag) ||
                (this.label === "我加入的" && group.owner_id !== Global.client.uin && !group.admin_flag)) {
                    this._infoList.push(new InfoTreeItem(group.group_name, group.group_id));
                }
            }
        } else { // get friend info
            for (let [, friend] of Global.client.fl) {
                if (friend.class_id === this._classId) {
                    this._infoList.push(new InfoTreeItem(friend.remark, friend.user_id));
                }
            }
        }
    }
}

// information item
class InfoTreeItem extends vscode.TreeItem {
    private _uid: number; // group id or friend id
    constructor(label: string | vscode.TreeItemLabel, uid: number) {
        super(label);
        this._uid = uid;
    }
}

// this method is called when account is online
function initLists() {
    let qliteTreeDataProvider = new QliteTreeDataProvider;
    vscode.window.registerTreeDataProvider("qliteExplorer", qliteTreeDataProvider);
    let qliteTreeView = vscode.window.createTreeView("qliteExplorer", {
        treeDataProvider: qliteTreeDataProvider
    });
}

export { initLists };