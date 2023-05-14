import * as webviewUiToolkit from '@vscode/webview-ui-toolkit';
import { UserInfo, ReqMsg, ResMsg } from '../../types/chat';
import MessageHandler from '../message-handler';
import {
  GroupMessage,
  GroupMessageEvent,
  MessageElem,
  PrivateMessage,
  PrivateMessageEvent
} from 'icqq';
import createUserMsg from './create-user-msg';
import nodeToMsgElem from './node-to-msgelem';
import { sface } from './sface';

/** 注册`vscode-ui`的`webview`组件 */
webviewUiToolkit
  .provideVSCodeDesignSystem()
  .register(webviewUiToolkit.allComponents);

/** 与扩展主体通信的变量 */
const vscode = acquireVsCodeApi();
/** 消息处理器 */
export const msgHandler = new MessageHandler(vscode);

// 获取页面组件
/** 上半部分的消息容器 */
const msgBox = document.querySelector('.message') as HTMLDivElement;
/** 下半部分的聊天容器 */
const chatBox = document.querySelector('.chat') as HTMLDivElement;
/** 工具栏 */
const toolBox = chatBox.querySelector('.tool-box') as HTMLDivElement;
/** 漫游表情工具 */
const stampBtn = toolBox.querySelector('.stamp') as webviewUiToolkit.Button;
/** 漫游表情栏 */
const stampBox = chatBox.querySelector('.stamp-box') as HTMLDivElement;
/** sface表情工具 */
const faceBtn = toolBox.querySelector('.face') as webviewUiToolkit.Button;
/** sface表情栏 */
const faceBox = chatBox.querySelector('.face-box') as HTMLDivElement;
/** 输入容器 */
const inputBox = chatBox.querySelector('.input-box') as HTMLDivElement;
/** 输入框 */
const inputArea = inputBox.querySelector('.input') as HTMLDivElement;
/** 发送按钮 */
const sendButton = inputBox.querySelector('.send') as webviewUiToolkit.Button;

/** 用户的基本信息 */
export let user: UserInfo;

/** 请求历史消息的状态，避免重复请求 */
let requestHistoryState = false;

/** 上一次滑动时的页面与顶部的距离 */
let lastTop = 0;

/**
 * 获取目标消息的`html`对象
 * @param message_id 按`id`查找消息
 * @returns 消息对象，没找到为`undefined`
 */
function getMessage(message_id: string): HTMLDivElement | undefined {
  const messageList = msgBox.querySelectorAll('.msg');
  return Array.from(messageList).find(
    (msg) => msg.getAttribute('msgid') === message_id
  ) as HTMLDivElement | undefined;
}

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

// 接受来自扩展的消息
msgHandler.onMessage((msg) => {
  switch (msg.command) {
    case 'messageEvent':
      const message = msg.payload as GroupMessageEvent | PrivateMessageEvent;
      if (getMessage(message.message_id)) {
        break;
      }
      msgBox.insertAdjacentElement('beforeend', createUserMsg(message));
      break;
    case 'noticeEvent':
      console.log(
        'ChatView receive noticeEvent: ' +
          (msg as ReqMsg<'noticeEvent'>).payload
      );
      break;
  }
});

// 打开漫游表情工具栏
stampBtn.addEventListener('click', () => {
  stampBox.style.display = 'flex';
  stampBtn.disabled = true;
});
// 点击其他地方关闭工具栏
document.addEventListener('click', (ev) => {
  if (
    ev.target !== stampBox &&
    ev.target !== stampBtn &&
    !stampBox.contains(ev.target as Node) &&
    !stampBtn.contains(ev.target as Node)
  ) {
    stampBox.style.display = 'none';
    stampBtn.disabled = false;
  }
});

// 打开sface表情工具栏
faceBtn.addEventListener('click', () => {
  faceBox.style.display = 'flex';
  faceBtn.disabled = true;
});
// 点击其他地方关闭工具栏
document.addEventListener('click', (ev) => {
  if (
    ev.target !== faceBox &&
    ev.target !== faceBtn &&
    !faceBtn.contains(ev.target as Node) &&
    !faceBtn.contains(ev.target as Node)
  ) {
    faceBox.style.display = 'none';
    faceBtn.disabled = false;
  }
});

// 输入框按下按键时
inputArea.addEventListener('keydown', (ev: KeyboardEvent) => {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    // 按下Enter键时发送消息
    ev.preventDefault();
    sendButton.click();
  }
});

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
  const msgElems: MessageElem[] = nodeToMsgElem(inputNodes);
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
      msgBox.insertAdjacentElement('beforeend', createUserMsg(retMsg));
    })
    .catch((error: Error) =>
      console.error('ChatView sendMessage: ' + error.message)
    )
    .finally(() => {
      sendButton.disabled = false;
      inputArea.textContent = '';
      msgBox.scrollTo(0, msgBox.scrollHeight);
    });
});

// 页面滑动时
msgBox.addEventListener('scroll', function (ev: Event) {
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
  // 初次加载历史消息
  getChatHistory().then((msgList) => {
    msgList.forEach((msg) =>
      msgBox.insertAdjacentElement('afterbegin', createUserMsg(msg))
    );
    // 滑动窗口到底部
    msgBox.scrollTop = msgBox.offsetTop + msgBox.offsetHeight;
  });
  // 工具栏不显示
  stampBox.style.display = 'none';
  faceBox.style.display = 'none';
  // 加载漫游表情
  msgHandler
    .postMessage({ id: '', command: 'getStamp' } as ReqMsg<'getStamp'>, 2000)
    .then((msg) => {
      const stamps = (msg as ResMsg<'getStamp'>).payload.stamps;
      stamps.forEach((stamp) => {
        const img = document.createElement('img');
        img.className = 'stamp';
        img.src = stamp;
        stampBox.append(img);
      });
    })
    .catch((error: Error) =>
      console.error('ChatView getStamp: ' + error.message)
    );
  // 加载sface表情
  sface.forEach((desc: string, id: number) => {
    const face = document.createElement('img');
    face.src = `https://qq-face.vercel.app/static/s${id}.png`;
    face.className = 'sface';
    face.title = face.alt = desc;
    faceBox.append(face);
  });
})();
