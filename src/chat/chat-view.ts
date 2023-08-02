import * as icqq from 'icqq';
import * as vscode from 'vscode';
import Global, { getHtmlForWebview } from '../global';
import * as chat from '../message/chat';
import { ChatType, parseMsgId } from '../message/parse-msg-id';
import { Messenger } from 'vscode-messenger';

/** 聊天页面的管理类 */
export default class ChatViewManager {
  /** 所有打开的聊天面板 */
  private readonly panelMap: Map<number, vscode.WebviewPanel>[] = [
    new Map(),
    new Map()
  ];

  /**
   * @param client 客户端
   * @param extensionUri 扩展根目录
   */
  constructor(
    private readonly client: icqq.Client,
    private readonly extensionUri: vscode.Uri
  ) {
    client.on('message.group', (event: icqq.GroupMessageEvent) => {
      if (!this.panelMap[ChatType.Group].get(event.group_id)?.active) {
        Global.contactViewProvider.refreshMessages(
          ChatType.Group,
          event.group_id,
          true
        );
      }
    });
    client.on('message.private', (event: icqq.PrivateMessageEvent) => {
      const uin = event.from_id === client.uin ? event.to_id : event.from_id;
      if (!this.panelMap[ChatType.Friend].get(uin)?.active) {
        Global.contactViewProvider.refreshMessages(ChatType.Friend, uin, true);
      }
    });
  }

  /**
   * 创建一个新页面
   * @param uin 页面的目标账号
   * @param type 聊天类型
   */
  newChat(uin: number, type: ChatType) {
    if (this.panelMap[type].has(uin)) {
      // 页面已被打开，则聚焦到目标页面
      this.panelMap[type].get(uin)?.reveal();
      return;
    }
    const label =
      (type === ChatType.Friend
        ? this.client.pickFriend(uin).remark ??
          this.client.pickFriend(uin).nickname
        : this.client.pickGroup(uin).name) ?? 'empty name';
    const chatView: vscode.WebviewPanel = vscode.window.createWebviewPanel(
      'chat',
      label,
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    const messenger = new Messenger();
    const webReceiver = messenger.registerWebviewPanel(chatView);
    this.panelMap[type].set(uin, chatView);
    /** 所有需要发送到页面的事件处理器列表，页面关闭时销毁 */
    const toDispose = [
      type === ChatType.Friend
        ? this.client.on('message.private', (event) => {
            if (event.friend.uid !== uin) {
              return;
            }
            messenger.sendNotification(chat.messageEvent, webReceiver, event);
          })
        : this.client.on('message.group', (event) => {
            if (event.group_id !== uin) {
              return;
            }
            messenger.sendNotification(chat.messageEvent, webReceiver, event);
          }),
      this.client.on('notice', (event) => {
        messenger.sendNotification(chat.noticeEvent, webReceiver, event);
      })
    ];
    chatView.iconPath = vscode.Uri.joinPath(this.extensionUri, 'ico.ico');
    chatView.webview.html = getHtmlForWebview(chatView.webview, 'chat');
    chatView.onDidDispose(() => {
      toDispose.forEach((dispose) => dispose());
      this.panelMap[type].delete(uin);
    });
    chatView.onDidChangeViewState(
      (e: vscode.WebviewPanelOnDidChangeViewStateEvent) => {
        if (e.webviewPanel.visible) {
          Global.contactViewProvider.refreshMessages(type, uin, false);
        }
      }
    );
    // 获取自己的基本信息
    messenger.onRequest(
      chat.getSimpleInfo,
      () => {
        return {
          uin: this.client.uin,
          name:
            type === ChatType.Friend
              ? this.client.nickname
              : this.client.pickGroup(uin).pickMember(this.client.uin).card ??
                this.client.nickname,
          type
        };
      },
      { sender: webReceiver }
    );
    // 获取历史消息
    messenger.onRequest(
      chat.getChatHistory,
      async (msgid) => {
        let chatHistory: (icqq.PrivateMessage | icqq.GroupMessage)[];
        if (type === ChatType.Friend) {
          const friend: icqq.Friend = this.client.pickFriend(uin);
          chatHistory = await friend.getChatHistory(
            msgid ? parseMsgId(ChatType.Friend, msgid).time : undefined
          );
        } else {
          const group: icqq.Group = this.client.pickGroup(uin);
          chatHistory = await group.getChatHistory(
            msgid ? parseMsgId(ChatType.Group, msgid).seq : undefined
          );
        }
        return chatHistory;
      },
      { sender: webReceiver }
    );
    // 获取用户头像
    messenger.onRequest(
      chat.getUserAvatar,
      (uin) => {
        return this.client.pickUser(uin).getAvatarUrl(40);
      },
      { sender: webReceiver }
    );
    // 发送消息
    messenger.onRequest(
      chat.sendMsg,
      async ({ content }) => {
        const ret = await this._sendMsg(type, uin, content);
        if (!ret) {
          vscode.window.showWarningMessage('消息无法显示，请重新打开此页面');
        }
        return ret;
      },
      { sender: webReceiver }
    );
    // 获取漫游表情
    messenger.onRequest(
      chat.getStamp,
      async () => {
        return await this.client.getRoamingStamp();
      },
      { sender: webReceiver }
    );
    // 获取群成员信息
    messenger.onRequest(
      chat.getMember,
      async () => {
        const group = this.client.pickGroup(uin);
        return {
          atAll: group.is_admin || group.is_owner,
          members: [...(await group.getMemberMap()).values()]
        };
      },
      { sender: webReceiver }
    );
    // 发送文件
    // @todo 获取发送文件的消息的逻辑待完善，目前采用与发送普通消息一样的暴力监听新消息的方式
    messenger.onRequest(
      chat.sendFile,
      async (filePath) => {
        const ret = this._sendFile(type, uin, filePath);
        if (!ret) {
          vscode.window.showWarningMessage('文件无法显示，请重新打开此页面');
        }
        return ret;
      },
      {
        sender: webReceiver
      }
    );
    // 获取文件下载链接
    messenger.onNotification(
      chat.getFileUrl,
      (url) => {
        const target =
          type === ChatType.Friend
            ? this.client.pickFriend(uin)
            : this.client.pickGroup(uin);
        target
          .getFileUrl(url)
          .then((url) => vscode.env.openExternal(vscode.Uri.parse(url)));
      },
      { sender: webReceiver }
    );
  }

  /**
   * 发送私聊/群聊消息
   * @param type 聊天类型
   * @param uin 目标账号
   * @param content 发送内容
   * @returns 发送成功返回发送的消息完整信息，否则返回undefined
   */
  private async _sendMsg(type: ChatType, uin: number, content: icqq.Sendable) {
    let sentMsg,
      /** 尝试次数 */
      attemps = 5;
    if (type === ChatType.Friend) {
      const friend = this.client.pickFriend(uin);
      const ret = await friend.sendMsg(content);
      do {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const history = await friend.getChatHistory();
        sentMsg = history.find(
          /** id会有1s的误差 */
          (msg) => Math.abs(msg.message_id.localeCompare(ret.message_id)) <= 1
        );
        attemps--;
      } while (!sentMsg && attemps);
    } else {
      const group = this.client.pickGroup(uin);
      const ret = await group.sendMsg(content);
      do {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const history = await group.getChatHistory();
        sentMsg = history.find(
          /** id会有1s的误差 */
          (msg) => msg.message_id === ret.message_id || msg.message_id === ret.message_id + 1
        );
        attemps--;
      } while (!sentMsg && attemps);
    }
    return sentMsg;
  }

  /**
   * 发送文件
   * @param type 聊天类型
   * @param uin 目标账号
   * @param filePath 文件路径，或文件的buffer值
   * @returns 发送成功返回发送的消息完整信息，否则返回undefined
   */
  private async _sendFile(
    type: ChatType,
    uin: number,
    filePath: string | Buffer
  ) {
    let sentMsg,
      /** 尝试次数 */
      attemps = 5;
    if (type === ChatType.Friend) {
      const friend = this.client.pickFriend(uin);
      const fid = await friend.sendFile(filePath);
      do {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const history = await friend.getChatHistory();
        sentMsg = history.find(
          (msg) =>
            msg.message.length === 1 &&
            msg.message[0].type === 'file' &&
            msg.message[0].fid === fid
        );
        attemps--;
      } while (!sentMsg && attemps);
    } else {
      const group = this.client.pickGroup(uin);
      const fileState = await group.fs.upload(filePath);
      do {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const history = await group.getChatHistory();
        sentMsg = history.find(
          (msg) =>
            msg.message.length === 1 &&
            msg.message[0].type === 'file' &&
            msg.message[0].fid === fileState.fid
        );
        attemps--;
      } while (!sentMsg && attemps);
    }
    return sentMsg;
  }
}
