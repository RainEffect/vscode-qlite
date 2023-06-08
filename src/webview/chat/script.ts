import * as webviewUiToolkit from '@vscode/webview-ui-toolkit';
import { UserInfo, ReqMsg, ResMsg, ChatType } from '../../types/chat';
import MessageHandler from '../message-handler';
import {
  GroupMessage,
  GroupMessageEvent,
  MessageElem,
  PrivateMessage,
  PrivateMessageEvent
} from 'icqq';
import { facemap } from './utils/face';
import createUserMsg from './utils/create-user-msg';
import nodeToMsgElem from './utils/node-to-msgelem';
import { inHTMLData } from 'xss-filters';
import {
  FaceType,
  createFaceElem,
  createImgElem,
  createStampElem
} from './utils/msgelem-to-node';

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
/** 漫游表情栏 */
const stampBox = chatBox.querySelector('.stamp-box') as HTMLDivElement;
/** QQ表情栏 */
const faceBox = chatBox.querySelector('.face-box') as HTMLDivElement;
/** at列表 */
const atBox = chatBox.querySelector('.at-box') as HTMLDivElement;
/** 工具栏 */
const toolBox = chatBox.querySelector('.tool-box') as HTMLDivElement;
/** 漫游表情工具 */
const stampBtn = toolBox.querySelector('.stamp-btn') as webviewUiToolkit.Button;
/** sface表情工具 */
const faceBtn = toolBox.querySelector('.face-btn') as webviewUiToolkit.Button;
/** at工具 */
const atBtn = toolBox.querySelector('.at-btn') as webviewUiToolkit.Button;
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
function getMessage(message_id: string) {
  return Array.from(msgBox.querySelectorAll('.msg')).find(
    (msg) => msg.getAttribute('msgid') === message_id
  );
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

/**
 * 向光标位置插入元素
 * @param node 被插入的元素节点
 */
function insertInput(node: Node) {
  const selection = window.getSelection() as Selection;
  if (document.activeElement !== inputArea) {
    // 光标不在输入框中
    const range = document.createRange();
    range.setStart(inputArea, inputArea.childNodes.length);
    range.setEnd(inputArea, inputArea.childNodes.length);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  let range = selection.getRangeAt(0);
  // 插入目标节点
  range.insertNode(node);
  selection.collapseToEnd();
  range = selection.getRangeAt(0);
  // 插入空字符
  range.insertNode(document.createTextNode(' '));
  selection.collapseToEnd();
}

// 接受来自扩展的消息
msgHandler.onMessage((msg) => {
  switch (msg.command) {
    case 'messageEvent': {
      const message = msg.payload as GroupMessageEvent | PrivateMessageEvent;
      if (getMessage(message.message_id)) {
        break;
      }
      msgBox.insertAdjacentElement('beforeend', createUserMsg(message));
      break;
    }
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
  if (ev.key === 'Delete' || ev.key === 'Backspace') {
    // 删除非文本和表情时将其整体移除
    const selection = window.getSelection() as Selection;
    const node = selection.anchorNode?.parentNode;
    if (node?.nodeName === 'VSCODE-TAG' || node?.nodeName === 'SPAN') {
      // 光标在非文本组件中
      ev.preventDefault();
      node.parentElement?.removeChild(node);
    } else if (node?.nodeName === 'DIV') {
      const text = selection.anchorNode as Text;
      if (ev.key === 'Backspace') {
        const prev = text.previousSibling;
        if (
          prev &&
          (prev.nodeName === 'VSCODE-TAG' || prev.nodeName === 'SPAN') &&
          selection.anchorOffset === 0
        ) {
          // 光标的左侧紧贴非文本组件且为backspace键
          ev.preventDefault();
          node.removeChild(prev);
        }
      } else {
        const next = text.nextSibling;
        if (
          next &&
          (next.nodeName === 'VSCODE-TAG' || next.nodeName === 'SPAN') &&
          selection.anchorOffset === text.length
        ) {
          // 光标的右侧紧贴非文本组件且为delete键
          ev.preventDefault();
          node.removeChild(next);
        }
      }
    }
  }
});

// 粘贴信息到输入框
inputArea.addEventListener('paste', (ev: ClipboardEvent) => {
  if (!ev.clipboardData || !ev.clipboardData.items) {
    return;
  }
  ev.preventDefault();
  const clipBoardData = ev.clipboardData as DataTransfer;
  Array.from(clipBoardData.items).map((item) => {
    if (item.kind === 'string') {
      if (item.type === 'text/plain') {
        item.getAsString((str) =>
          insertInput(document.createTextNode(inHTMLData(str)))
        );
      }
    } else if (item.kind === 'file') {
      if (item.type.startsWith('image')) {
        const reader = new FileReader();
        reader.onload = () =>
          insertInput(createImgElem(reader.result as string));
        reader.readAsDataURL(item.getAsFile() as File);
      }
    } else {
      console.warn('ChatView paste: unsupported data');
    }
  });
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
      5000
    )
    .then((msg) => {
      const retMsg = (msg as ResMsg<'sendMsg'>).payload.retMsg;
      msgBox.insertAdjacentElement('beforeend', createUserMsg(retMsg));
    })
    .catch((error: Error) =>
      console.error('ChatView sendMessage: ' + error.message)
    )
    .finally(() => {
      this.disabled = false;
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
    if (user.type === ChatType.Friend) {
      // 私聊隐藏at工具
      atBtn.style.display = 'none';
    } else {
      /**
       * @todo 加载at列表，添加at工具点击事件
       */
    }
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
  atBox.style.display = 'none';
  // 加载漫游表情
  msgHandler
    .postMessage({ id: '', command: 'getStamp' } as ReqMsg<'getStamp'>, 2000)
    .then((msg) => {
      const stamps = (msg as ResMsg<'getStamp'>).payload.stamps;
      stamps.forEach((stamp) => {
        const img = document.createElement('img');
        img.src = stamp;
        const elem = new webviewUiToolkit.Button();
        elem.appearance = 'icon';
        elem.append(img);
        elem.onclick = () => insertInput(createStampElem(stamp));
        stampBox.append(elem);
      });
    })
    .catch((error: Error) =>
      console.error('ChatView getStamp: ' + error.message)
    );
  // 加载face表情
  for (const id in facemap) {
    const face = document.createElement('img');
    face.src = `https://qq-face.vercel.app/static/s${id}.png`;
    face.title = face.alt = facemap[id];
    const elem = new webviewUiToolkit.Button();
    elem.appearance = 'icon';
    elem.append(face);
    elem.onclick = () =>
      insertInput(createFaceElem(Number(id), FaceType.static, facemap[id]));
    faceBox.append(elem);
  }
})();
