import * as icqq from 'icqq';
import * as vscode from 'vscode';
import { ChatType } from '../message/chat';

/** 叶节点信息 */
interface LeafInfo {
  /** 账号 */
  uin: number;
  /** 是否为私聊 */
  type: ChatType;
  /** 头像地址 */
  avatarUrl: string;
}

/** 聊天列表树节点 */
class ContactTreeItem<
  T extends ContactTreeItem<any> | MessageTreeItem
> extends vscode.TreeItem {
  /** 子节点列表 */
  children: T[];
  /**
   * @param label 节点名
   * @param leafInfo 好友/群聊包含的额外显示数据
   * @param children 子节点列表，默认为空列表
   */
  constructor(label: string, leafInfo?: LeafInfo, children: T[] = []) {
    super(label);
    this.children = children;
    if (!leafInfo) {
      if (label === '联系人' || label === '消息') {
        this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      } else {
        this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      }
    } else {
      this.collapsibleState = vscode.TreeItemCollapsibleState.None;
      this.command = {
        title: '打开聊天',
        command: 'qlite.chat',
        arguments: [leafInfo.uin, leafInfo.type]
      };
      this.contextValue = 'leaf';
      this.iconPath = vscode.Uri.parse(leafInfo.avatarUrl);
      this.tooltip = leafInfo.uin.toString();
      this.children = [];
    }
  }
}

/** 消息列表子节点 */
class MessageTreeItem extends ContactTreeItem<any> {
  readonly uin: number;
  readonly type: ChatType;
  private cnt = 0;
  /**
   * @param label 好友昵称/群聊名
   * @param leafInfo 好友/群聊包含的额外显示数据
   */
  constructor(label: string, leafInfo: LeafInfo) {
    super(label, leafInfo);
    this.uin = leafInfo.uin;
    this.type = leafInfo.type;
    this.contextValue = 'message';
  }

  /**
   * 标记新消息
   * @param cnt 新消息数，默认`+1`
   */
  markNew(cnt = 1) {
    this.cnt += cnt;
    this.description = `+${this.cnt}`;
  }

  /**
   * 标记消息已读
   */
  markRead() {
    this.cnt = 0;
    this.description = undefined;
  }
}

/** 聊天列表树视图容器 */
export default class ContactTreeDataProvider
  implements vscode.TreeDataProvider<ContactTreeItem<any>>
{
  /** 客户端账号 */
  private readonly _client: icqq.Client;
  /** 消息列表 */
  private readonly _messages: ContactTreeItem<MessageTreeItem> =
    new ContactTreeItem('消息');
  private readonly _contacts: ContactTreeItem<
    ContactTreeItem<ContactTreeItem<any>>
  > = new ContactTreeItem('联系人', undefined, [
    new ContactTreeItem('好友'),
    new ContactTreeItem('群聊')
  ]);
  /** 更新列表数据的事件响应器 */
  private _onDidChangeTreeData: vscode.EventEmitter<
    ContactTreeItem<any> | undefined
  > = new vscode.EventEmitter<ContactTreeItem<any> | undefined>();

  readonly onDidChangeTreeData: vscode.Event<ContactTreeItem<any> | undefined> =
    this._onDidChangeTreeData.event;

  /**
   * @param client 一个*在线的*客户端
   */
  constructor(client: icqq.Client) {
    this._client = client;
    // 注册通知事件处理
    client.on('notice.friend.decrease', (event) => {
      vscode.window.showInformationMessage(
        `删除好友：${event.nickname}(${event.user_id})`
      );
      this.refreshContacts(true);
    });
    client.on('notice.friend.increase', (event) => {
      vscode.window.showInformationMessage(
        `添加好友：${event.nickname}(${event.user_id})`
      );
      this.refreshContacts(true);
    });
    client.on('notice.group.increase', (event) => {
      if (event.user_id === client.uin) {
        vscode.window.showInformationMessage(`加入群聊：${event.group.name}`);
        this.refreshContacts(false);
      }
    });
    client.on('notice.group.decrease', (event) => {
      if (event.user_id === client.uin) {
        let msg: string;
        if (event.dismiss) {
          msg = `群聊：${event.group_id}已解散`;
        } else if (event.operator_id === client.uin) {
          msg = `'退出群聊：${event.group.name}`;
        } else {
          msg = `被踢出群聊：${event.group.name}`;
        }
        vscode.window.showInformationMessage(msg);
        this.refreshContacts(false);
      }
    });
    // 热重启
    client.on('system.online', () => {
      this.refreshContacts(false);
      this.refreshContacts(true);
      this._messages.children = [];
    });
    // bind(); // 绑定命令
  }

  getTreeItem(element: ContactTreeItem<any>): ContactTreeItem<any> {
    return element;
  }

  getChildren(
    element?: ContactTreeItem<any>
  ): vscode.ProviderResult<ContactTreeItem<any>[]> {
    return element ? element.children : [this._messages, this._contacts];
  }

  /**
   * 更新联系人
   * @param isPrivate 更新好友列表为`true`，群聊列表为`false`
   */
  private refreshContacts(isPrivate: boolean) {
    if (isPrivate) {
      /** 好友列表 */
      this._contacts.children[0].children = [
        ...this._client.classes.values()
      ].map(
        (className: string, classId: number) =>
          // 获取所有分组
          new ContactTreeItem(
            className,
            undefined,
            [...this._client.fl.values()]
              // 移除非该分组下的好友
              .filter((info: icqq.FriendInfo) => info.class_id === classId)
              .map((info: icqq.FriendInfo) => {
                /** 好友根节点 */
                const friend: ContactTreeItem<any> = new ContactTreeItem(
                  info.remark.length ? info.remark : info.nickname,
                  {
                    uin: info.user_id,
                    type: ChatType.Friend,
                    avatarUrl: this._client
                      .pickFriend(info.user_id)
                      .getAvatarUrl(40)
                  }
                );
                return friend;
              })
          )
      );
      this._onDidChangeTreeData.fire(this._contacts.children[0]);
    } else {
      /** 群聊列表 */
      this._contacts.children[1].children = [
        '我创建的',
        '我管理的',
        '我加入的'
      ].map(
        (className: string, classId: number) =>
          // 获取所有分组
          new ContactTreeItem(
            className,
            undefined,
            [...this._client.gl.values()]
              .filter((info: icqq.GroupInfo) =>
                classId === 0
                  ? // 群主
                    info.owner_id === this._client.uin
                  : classId === 1
                  ? // 管理员
                    info.owner_id !== this._client.uin && info.admin_flag
                  : // 群员
                    info.owner_id !== this._client.uin && !info.admin_flag
              )
              .map((info: icqq.GroupInfo) => {
                /** 群聊根节点 */
                const group: ContactTreeItem<any> = new ContactTreeItem(
                  info.group_name,
                  {
                    uin: info.group_id,
                    type: ChatType.Group,
                    avatarUrl: this._client
                      .pickGroup(info.group_id)
                      .getAvatarUrl(40)
                  }
                );
                return group;
              })
          )
      );
      this._onDidChangeTreeData.fire(this._contacts.children[1]);
    }
  }

  /**
   * 更新新消息列表
   * @param type 聊天类型：私聊or群聊
   * @param uin 私聊为对方账号，群聊为群号
   * @param flag 有新消息为`true`，已读新消息为`false`
   */
  refreshMessages(type: ChatType, uin: number, flag: boolean) {
    const target: number = this._messages.children.findIndex(
      (msg) => msg.type === type && msg.uin === uin
    );
    if (target === -1) {
      // 消息列表中没有该消息
      const label: string | undefined = type
        ? this._client.pickFriend(uin).remark?.length
          ? this._client.pickFriend(uin).remark
          : this._client.pickFriend(uin).nickname
        : this._client.pickGroup(uin).name;
      const avatarUrl: string = type
        ? this._client.pickFriend(uin).getAvatarUrl(40)
        : this._client.pickGroup(uin).getAvatarUrl(40);
      this._messages.children.unshift(
        new MessageTreeItem(label as string, { uin, type, avatarUrl })
      );
    } else {
      // 在现有消息上修改
      if (flag) {
        // 标记未读
        this._messages.children[target].markNew();
        // 更新列表顺序
        this._messages.children.unshift(
          this._messages.children.splice(target, 1)[0]
        );
      } else {
        // 标记已读
        this._messages.children[target].markRead();
      }
    }
    // 刷新列表
    this._onDidChangeTreeData.fire(this._messages);
  }

  /**
   * 删除消息，响应removeMsg命令
   * @param targetTreeItem 要删除的消息
   */
  removeMsg(targetTreeItem: MessageTreeItem) {
    const target: number = this._messages.children.findIndex(
      (msg: MessageTreeItem) => targetTreeItem === msg
    );
    this._messages.children.splice(target, 1);
    this._onDidChangeTreeData.fire(this._messages);
  }

  /**
   * 显示好友/群聊的基础资料
   * @param item 被选中的好友/群聊
   */
  showProfile(item: ContactTreeItem<any>) {
    if (item.command?.arguments && item.command.arguments[1]) {
      const info = this._client.pickFriend(Number(item.tooltip))
        .info as icqq.FriendInfo;
      const profile = [
        '昵称：' + info.nickname,
        '性别：' +
          (info.sex === 'male' ? '男' : info.sex === 'female' ? '女' : '未知'),
        'QQ：' + info.user_id,
        '备注：' + info.remark,
        '分组：' + this._client.classes.get(info.class_id)
      ];
      vscode.window.showQuickPick(profile, {
        title: info.remark + '的好友资料'
      });
    } else {
      const info = this._client.pickGroup(Number(item.tooltip))
        .info as icqq.GroupInfo;
      const profile = [
        '群名：' + info.group_name,
        'QQ：' + info.group_id,
        '群主QQ：' + info.owner_id,
        '成员数：' + info.member_count
      ];
      vscode.window.showQuickPick(profile, {
        title: info.group_name + '的群聊资料'
      });
    }
  }
}
