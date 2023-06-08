import { readFileSync } from 'fs';
import icqq from 'icqq';
import vscode from 'vscode';
import Global from '../global';
import { ChatType, ReqMsg, ResMsg, parseMsgId } from '../types/chat';
import MessageHandler from '../webview/message-handler';

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
    const label = (
      type === ChatType.Friend
        ? this.client.pickFriend(uin).remark ??
          this.client.pickFriend(uin).nickname
        : this.client.pickGroup(uin).name
    ) as string;
    const chatView: vscode.WebviewPanel = vscode.window.createWebviewPanel(
      'chat',
      label,
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    const msgHandler = new MessageHandler(chatView.webview);
    this.panelMap[type].set(uin, chatView);
    /** 所有需要发送到页面的事件处理器列表，页面关闭时销毁 */
    const toDispose = [
      type === ChatType.Friend
        ? this.client.on('message.private', (event) => {
            if (event.friend.uid !== uin) {
              return;
            }
            msgHandler.postMessage({
              id: '',
              command: 'messageEvent',
              payload: event
            } as ReqMsg<'messageEvent'>);
          })
        : this.client.on('message.group', (event) => {
            if (event.group_id !== uin) {
              return;
            }
            msgHandler.postMessage({
              id: '',
              command: 'messageEvent',
              payload: event
            } as ReqMsg<'messageEvent'>);
          }),
      this.client.on('notice', (event) => {
        msgHandler.postMessage({
          id: '',
          command: 'noticeEvent',
          payload: event
        } as ReqMsg<'noticeEvent'>);
      })
    ];
    chatView.iconPath = vscode.Uri.joinPath(this.extensionUri, 'ico.ico');
    chatView.webview.html = this._getHtmlForWebview();
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
    msgHandler.onMessage(async (msg) => {
      if (msg.command === 'getSimpleInfo') {
        // 获取自己的基本信息
        msgHandler.postMessage({
          command: msg.command,
          id: msg.id,
          payload: {
            uin: this.client.uin,
            name:
              type === ChatType.Friend
                ? this.client.nickname
                : this.client.pickGroup(uin).pickMember(this.client.uin).card ??
                  this.client.nickname,
            type
          }
        } as ResMsg<'getSimpleInfo'>);
      } else if (msg.command === 'getChatHistory') {
        // 获取历史消息
        let chatHistory: (icqq.PrivateMessage | icqq.GroupMessage)[];
        const message_id = (msg as ReqMsg<'getChatHistory'>).payload
          ?.message_id;
        if (type === ChatType.Friend) {
          const friend: icqq.Friend = this.client.pickFriend(uin);
          chatHistory = await friend.getChatHistory(
            message_id
              ? parseMsgId(message_id, ChatType.Friend).timestamp
              : undefined
          );
        } else {
          const group: icqq.Group = this.client.pickGroup(uin);
          chatHistory = await group.getChatHistory(
            message_id
              ? parseMsgId(message_id, ChatType.Group).seqid
              : undefined
          );
        }
        msgHandler.postMessage({
          command: msg.command,
          id: msg.id,
          payload: { history: chatHistory }
        } as ResMsg<'getChatHistory'>);
      } else if (msg.command === 'getUserAvatar') {
        // 获取用户头像
        const src = this.client.pickUser(msg.payload.uin).getAvatarUrl(40);
        msgHandler.postMessage({
          command: msg.command,
          id: msg.id,
          payload: { src }
        } as ResMsg<'getUserAvatar'>);
      } else if (msg.command === 'sendMsg') {
        const content = msg.payload.content;
        let retMsg: icqq.PrivateMessage | icqq.GroupMessage;
        /**
         * @todo 无法获取发送后的消息数据
         */
        if (type === ChatType.Friend) {
          const friend: icqq.Friend = this.client.pickFriend(uin);
          const ret: icqq.MessageRet = await friend.sendMsg(content);
          const interval = setInterval(async () => {
            /**
             * @todo 缺少`interval`的异常终止操作
             */
            retMsg = (await friend.getChatHistory(ret.time, 1))[0];
            if (retMsg.message_id === ret.message_id) {
              clearInterval(interval);
              msgHandler.postMessage({
                id: msg.id,
                command: msg.command,
                payload: { retMsg }
              } as ResMsg<'sendMsg'>);
            }
          }, 200);
        } else {
          const group: icqq.Group = this.client.pickGroup(uin);
          const ret: icqq.MessageRet = await group.sendMsg(content);
          const interval = setInterval(async () => {
            /**
             * @todo 缺少`interval`的异常终止操作
             */
            retMsg = (await group.getChatHistory(ret.seq, 1))[0];
            if (retMsg.message_id === ret.message_id) {
              clearInterval(interval);
              msgHandler.postMessage({
                id: msg.id,
                command: msg.command,
                payload: { retMsg }
              } as ResMsg<'sendMsg'>);
            }
          }, 200);
        }
      } else if (msg.command === 'getStamp') {
        const stamps = await this.client.getRoamingStamp();
        msgHandler.postMessage({
          id: msg.id,
          command: msg.command,
          payload: { stamps }
        } as ResMsg<'getStamp'>);
      }
    });
  }

  /**
   * 获取`webview`的`html`
   * @returns 生成的`html`
   */
  private _getHtmlForWebview() {
    const htmlPath = vscode.Uri.joinPath(
      this.extensionUri,
      'out',
      'chat',
      'index.html'
    ).fsPath;
    /** 从`html`文件地址中读取字符串 */
    return readFileSync(htmlPath, 'utf-8');
  }
}
