import { Link } from '@vscode/webview-ui-toolkit';
import { MessageElem } from 'icqq';
import xss from 'xss';

/**
 * 创建AT组件
 * @param target AT的对象，包含`@`符号
 * @returns `vscode-link`组件
 */
function createAtElem(target: string) {
  const elem = document.createElement('vscode-link') as Link;
  elem.className = 'at';
  elem.href = 'javascript:void(0);';
  elem.textContent = target;
  return elem;
}

/**
 * 解析消息链为`html`对象
 * @todo 添加对其他消息类型的解析
 * @param msgElemList 消息链
 * @returns `html`对象列表
 */
export default function msgElemToNode(msgElemList: MessageElem[]): ChildNode[] {
  const message: ChildNode[] = [];
  msgElemList.forEach((msgElem) => {
    switch (msgElem.type) {
      case 'at':
        message.push(
          createAtElem(
            msgElem.qq === 'all' ? '@全体成员' : (msgElem.text as string)
          )
        );
        break;
      case 'bface':
        break;
      case 'dice':
        break;
      case 'face':
        break;
      case 'file':
        break;
      case 'flash':
        break;
      case 'image':
        break;
      case 'json':
        break;
      case 'location':
        break;
      case 'mirai':
        break;
      case 'music':
        break;
      case 'node':
        break;
      case 'poke':
        break;
      case 'quote':
        break;
      case 'record':
        break;
      case 'reply':
        break;
      case 'rps':
        break;
      case 'sface':
        break;
      case 'share':
        break;
      case 'text':
        const elem = document.createTextNode(msgElem.text);
        message.push(elem);
        // message.push(
        //   xss(msgElem.text).replace(
        //     /(https?:\/\/[^\s]+)/g,
        //     `<a href='$1'>$1</a>`
        //   )
        // );
        break;
      case 'video':
        break;
      case 'xml':
        break;
    }
  });
  return message;
}
