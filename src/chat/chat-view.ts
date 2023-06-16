import { readFileSync } from 'fs';
import * as icqq from 'icqq';
import * as vscode from 'vscode';
import Global from '../global';
import ChatCommand from '../message/chat';
import MessageHandler from '../message/message-handler';
import { ChatType, parseMsgId } from '../message/parse-msg-id';

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
    const msgHandler = new MessageHandler<ChatCommand>(false, chatView.webview);
    this.panelMap[type].set(uin, chatView);
    /** 所有需要发送到页面的事件处理器列表，页面关闭时销毁 */
    const toDispose = [
      type === ChatType.Friend
        ? this.client.on('message.private', (event) => {
            if (event.friend.uid !== uin) {
              return;
            }
            msgHandler.request('messageEvent', event);
          })
        : this.client.on('message.group', (event) => {
            if (event.group_id !== uin) {
              return;
            }
            msgHandler.request('messageEvent', event);
          }),
      this.client.on('notice', (event) => {
        msgHandler.request('noticeEvent', event);
      })
    ];
    chatView.iconPath = vscode.Uri.joinPath(this.extensionUri, 'ico.ico');
    chatView.webview.html = this._getHtmlForWebview(chatView.webview);
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
    msgHandler.get('getSimpleInfo', 'req').then((msg) => {
      msgHandler.response(msg.id, msg.command, {
        uin: this.client.uin,
        name:
          type === ChatType.Friend
            ? this.client.nickname
            : this.client.pickGroup(uin).pickMember(this.client.uin).card ??
              this.client.nickname,
        type
      });
    });
    // 获取历史消息
    msgHandler.get('getChatHistory', 'req').then(async (msg) => {
      let chatHistory: (icqq.PrivateMessage | icqq.GroupMessage)[];
      const message_id = msg.payload;
      if (type === ChatType.Friend) {
        const friend: icqq.Friend = this.client.pickFriend(uin);
        chatHistory = await friend.getChatHistory(
          message_id ? parseMsgId(ChatType.Friend, message_id).time : undefined
        );
      } else {
        const group: icqq.Group = this.client.pickGroup(uin);
        chatHistory = await group.getChatHistory(
          message_id ? parseMsgId(ChatType.Group, message_id).seq : undefined
        );
      }
      msgHandler.response(msg.id, msg.command, chatHistory);
    });
    // 获取用户头像
    msgHandler.get('getUserAvatar', 'req').then((msg) => {
      const src = this.client.pickUser(msg.payload.uin).getAvatarUrl(40);
      msgHandler.response(msg.id, msg.command, src);
    });
    // 发送消息
    msgHandler.get('sendMsg', 'req').then((msg) => {
      const content = msg.payload.content;
      if (type === ChatType.Friend) {
        const friend: icqq.Friend = this.client.pickFriend(uin);
        friend.sendMsg(content).then((ret) => {
          /** 超时检测 */
          const timeout = setTimeout(() => {
            clearInterval(interval);
            vscode.window.showWarningMessage('消息无法显示，请重新打开此页面');
          }, 4000);
          /** 间隔获取消息 */
          const interval = setInterval(async () => {
            const retMsg = (await friend.getChatHistory(ret.time, 1))[0];
            // 返回的消息中的时间可能有1s的延迟误差
            if (retMsg.time === ret.time || retMsg.time === ret.time + 1) {
              clearInterval(interval);
              clearTimeout(timeout);
              msgHandler.response(msg.id, msg.command, retMsg);
            }
          }, 200);
        });
      } else {
        const group: icqq.Group = this.client.pickGroup(uin);
        group.sendMsg(content).then((ret) => {
          /** 超时检测 */
          const timeout = setTimeout(() => {
            clearInterval(interval);
            vscode.window.showWarningMessage('消息无法显示，请重新打开此页面');
          }, 2000);
          /** 间隔获取消息 */
          const interval = setInterval(async () => {
            const retMsg = (await group.getChatHistory(ret.seq, 1))[0];
            if (retMsg.message_id === ret.message_id) {
              clearInterval(interval);
              clearTimeout(timeout);
              msgHandler.response(msg.id, msg.command, retMsg);
            }
          }, 200);
        });
      }
    });
    // 获取漫游表情
    msgHandler.get('getStamp', 'req').then(async (msg) => {
      const stamps = await this.client.getRoamingStamp();
      msgHandler.response(msg.id, msg.command, stamps);
    });
    // 获取群成员信息
    msgHandler.get('getMember', 'req').then(async (msg) => {
      const group = this.client.pickGroup(uin);
      const members = [...(await group.getMemberMap()).values()];
      msgHandler.response(msg.id, msg.command, {
        atAll: group.is_admin || group.is_owner,
        members
      });
    });
    // 发送文件
    // @todo 获取发送文件的消息的逻辑待完善，目前采用与发送普通消息一样的暴力监听新消息的方式
    msgHandler.get('sendFile', 'req').then((msg) => {
      const filePath = msg.payload;
      if (type === ChatType.Friend) {
        const friend = this.client.pickFriend(uin);
        friend.sendFile(filePath, undefined).then((fid) => {
          console.log(`${friend.uid}：文件${filePath}发送成功`);
          const timeout = setTimeout(() => {
            clearInterval(interval);
            vscode.window.showWarningMessage('文件无法显示，请重新打开此页面');
          }, 4000);
          const interval = setInterval(async () => {
            const retMsg = (await friend.getChatHistory(undefined, 1))[0];
            if (
              retMsg.message.length === 1 &&
              retMsg.message[0].type === 'file' &&
              retMsg.message[0].fid === fid
            ) {
              clearInterval(interval);
              clearTimeout(timeout);
              msgHandler.response(msg.id, msg.command, retMsg);
            }
          }, 200);
        });
      } else {
        const group = this.client.pickGroup(uin);
        group.fs
          .upload(filePath, undefined, undefined, (perc) =>
            console.log(`${group.gid}：发送文件${filePath}中：${perc}%`)
          )
          .then((fileState) => {
            console.log(`${group.gid}：文件${filePath}发送成功`);
            const timeout = setTimeout(() => {
              clearInterval(interval);
              vscode.window.showWarningMessage(
                '文件无法显示，请重新打开此页面'
              );
            }, 4000);
            const interval = setInterval(async () => {
              const retMsg = (await group.getChatHistory(undefined, 1))[0];
              if (
                retMsg.message.length === 1 &&
                retMsg.message[0].type === 'file' &&
                retMsg.message[0].fid === fileState.fid
              ) {
                clearInterval(interval);
                clearTimeout(timeout);
                msgHandler.response(msg.id, msg.command, retMsg);
              }
            }, 200);
          });
      }
    });
    // 获取文件下载链接
    msgHandler.get('getFileUrl', 'req').then((msg) => {
      const target =
        type === ChatType.Friend
          ? this.client.pickFriend(uin)
          : this.client.pickGroup(uin);
      target
        .getFileUrl(msg.payload)
        .then((url) => vscode.env.openExternal(vscode.Uri.parse(url)));
    });
  }

  /**
   * 获取`webview`的`html`
   * @param webview 目标`webview`实例
   * @returns 生成的`html`
   */
  private _getHtmlForWebview(webview: vscode.Webview) {
    const webviewUri = vscode.Uri.joinPath(this.extensionUri, 'out');
    const htmlPath = vscode.Uri.joinPath(
      webviewUri,
      'chat',
      'index.html'
    ).fsPath;
    const htmlUris: Map<string, vscode.Uri> = new Map();
    htmlUris.set(
      'scriptUri',
      webview.asWebviewUri(vscode.Uri.joinPath(webviewUri, 'chat', 'script.js'))
    );
    htmlUris.set(
      'styleUri',
      webview.asWebviewUri(vscode.Uri.joinPath(webviewUri, 'chat', 'style.css'))
    );
    htmlUris.set(
      'codiconUri',
      webview.asWebviewUri(vscode.Uri.joinPath(webviewUri, 'codicon.css'))
    );
    /** 从`html`文件地址中读取字符串并替换`${}`格式的字符串为特定文件的`WebviewUri` */
    const html: string = readFileSync(htmlPath, 'utf-8').replace(
      /\${(\w+)}/g,
      (match, key) => htmlUris.get(key)?.toString() ?? html
    );
    return html;
  }
}
