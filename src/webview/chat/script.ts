import * as webviewUiToolkit from '@vscode/webview-ui-toolkit';
import { UserInfo, ReqMsg, ResMsg } from '../../types/chat';
import MessageHandler from '../message-handler';
import {
  AtElem,
  FaceElem,
  GroupMessage,
  ImageElem,
  MessageElem,
  PrivateMessage,
  TextElem
} from 'icqq';
import createUserMsg from './createUserMsg';

/** 注册`vscode-ui`的`webview`组件 */
webviewUiToolkit
  .provideVSCodeDesignSystem()
  .register(webviewUiToolkit.allComponents);

/** 与扩展主体通信的变量 */
const vscode = acquireVsCodeApi();
/** 消息处理器 */
export const msgHandler = new MessageHandler(vscode);

// 获取页面组件
const msgContainer = document.querySelector('.message') as HTMLDivElement;
const chatContainer = document.querySelector('.chat') as HTMLDivElement;
const toolBox = chatContainer.querySelector('.tool-box') as HTMLDivElement;
const inputBox = chatContainer.querySelector('.input-box') as HTMLDivElement;
const inputArea = inputBox.querySelector('.input') as HTMLDivElement;
const sendButton = inputBox.querySelector('.send') as webviewUiToolkit.Button;

/** 用户的基本信息 */
export let user: UserInfo;

/** 请求历史消息的状态，避免重复请求 */
let requestHistoryState = false;

/**
 * 获取目标消息的`html`对象
 * @param message_id 按`id`查找消息
 * @returns 消息对象，没找到为`undefined`
 */
function getMessage(message_id: string): HTMLDivElement | undefined {
  const messageList = msgContainer.querySelectorAll('.msg');
  return Array.from(messageList).find(
    (msg) => msg.getAttribute('msgid') === message_id
  ) as HTMLDivElement | undefined;
}

// 点击发送按钮发送消息
sendButton.addEventListener('click', function (this: webviewUiToolkit.Button) {
  const inputNodes = inputArea.childNodes;
  if (this.disabled) {
    console.warn('ChatView sendMessage: 消息发送中');
    return;
  } else if (!inputNodes.length) {
    return;
  }
  this.disabled = true;
  const msgElems: MessageElem[] = [];
  // 消息序列化
  inputNodes.forEach((inputNode) => {
    let msgElem: MessageElem | undefined;
    switch (inputNode.nodeName) {
      case 'BR': // 换行符
        msgElem = { type: 'text', text: '\n' } as TextElem;
        break;
      case '#text': // 文本
        msgElem = { type: 'text', text: inputNode.textContent } as TextElem;
        break;
      case 'IMG': // 图片
        const imgElem = inputNode as HTMLImageElement;
        if (imgElem.className === 'face') {
          // 表情
          msgElem = {
            type: 'face',
            id: Number(imgElem.id)
          } as FaceElem;
        } else {
          // 图片
          const file = imgElem.currentSrc.startsWith('http')
            ? imgElem.currentSrc
            : imgElem.currentSrc.split(';')[1].replace(',', '://');
          msgElem = {
            type: 'image',
            file,
            url: imgElem.currentSrc
          } as ImageElem;
        }
        break;
      case 'A': // AT
        const qq = (inputNode as HTMLAnchorElement).id;
        msgElem = { type: 'at', qq: qq === 'all' ? qq : Number(qq) } as AtElem;
        break;
      default:
        console.warn('ChatView sendMessage: 不支持的消息元素');
        break;
    }
    if (!msgElem) {
      return;
    }
    msgElems.push(msgElem);
  });
  msgHandler
    .postMessage(
      {
        id: '',
        command: 'sendMsg',
        payload: { content: msgElems }
      } as ReqMsg<'sendMsg'>,
      3000
    )
    .then((msg) => {
      const retMsg = (msg as ResMsg<'sendMsg'>).payload.retMsg;
      msgContainer.insertAdjacentElement('beforeend', createUserMsg(retMsg));
    })
    .catch((error: Error) =>
      console.error('ChatView sendMessage: ' + error.message)
    )
    .finally(() => {
      sendButton.disabled = false;
      inputArea.textContent = '';
      msgContainer.scrollTo(0, msgContainer.scrollHeight);
    });
});

// 输入框的编辑判断
inputArea.addEventListener('keydown', (ev: KeyboardEvent) => {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    sendButton.click();
  }
});

/**
 * 获取历史消息，调用此函数前请先判断 {@link requestHistoryState} 是否为真，为真则不要调用此函数
 * @param message_id 如果此值非空则从该消息往前获取历史消息
 * @returns 消息列表
 */
function getChatHistory(
  message_id?: string
): Promise<(PrivateMessage | GroupMessage)[]> {
  requestHistoryState = true;
  return new Promise((resolve) => {
    msgHandler
      .postMessage(
        {
          id: '',
          command: 'getChatHistory',
          payload: message_id ? { message_id } : undefined
        } as ReqMsg<'getChatHistory'>,
        2000
      )
      .then((msg) => {
        const history = (msg as ResMsg<'getChatHistory'>).payload.history;
        // 按发言时间逆序排列
        history.sort(
          (a: { time: number }, b: { time: number }) => b.time - a.time
        );
        resolve(history);
      })
      .catch((error: Error) => {
        console.error('ChatView getChatHistory: ' + error.message);
      })
      .finally(() => (requestHistoryState = false));
  });
}

/** 上一次滑动时的页面与顶部的距离 */
let lastTop = 0;
msgContainer.addEventListener('scroll', function (ev: Event) {
  const curTop = (ev.target as HTMLDivElement).scrollTop;
  // 当用户滑动方向为上且接近顶部时加载历史消息
  if (curTop < 10 && lastTop > curTop) {
    const firstMsg = this.querySelector('.msg');
    const message_id = firstMsg?.getAttribute('msgid');
    if (requestHistoryState) {
      return;
    }
    getChatHistory(message_id ?? undefined).then((msgList) =>
      msgList.forEach((msg) => {
        if (!getMessage(msg.message_id)) {
          this.insertAdjacentElement('afterbegin', createUserMsg(msg));
        }
      })
    );
  }
  lastTop = curTop;
});

(async () => {
  try {
    // 优先获取基本信息
    const msg = (await msgHandler.postMessage(
      { id: '', command: 'getSimpleInfo' } as ReqMsg<'getSimpleInfo'>,
      2000
    )) as ResMsg<'getSimpleInfo'>;
    user = msg.payload;
  } catch (error: any) {
    console.error('ChatView getSimpleInfo: ' + error.message);
  }
  // 初次获取历史消息
  getChatHistory().then((msgList) => {
    msgList.forEach((msg) =>
      msgContainer.insertAdjacentElement('afterbegin', createUserMsg(msg))
    );
    // 滑动窗口到底部
    msgContainer.scrollTop = msgContainer.offsetTop + msgContainer.offsetHeight;
  });
})();
