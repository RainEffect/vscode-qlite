import { Tag } from '@vscode/webview-ui-toolkit';
import { AtElem, FaceElem, ImageElem, MessageElem, TextElem } from 'icqq';

/**
 * 解析`html`对象为消息链
 * @todo 添加对其他消息类型的解析
 * @param childNodes `html`对象
 * @returns 消息链列表
 */
export default function nodeToMsgElem(
  childNodes: NodeListOf<ChildNode>
): MessageElem[] {
  const msgElems: MessageElem[] = [];
  childNodes.forEach((childNode) => {
    switch (childNode.nodeName) {
      case 'BR': // 换行符
        msgElems.push({ type: 'text', text: '\n' } as TextElem);
        break;
      case '#text': // 文本
        msgElems.push({
          type: 'text',
          text: childNode.textContent
        } as TextElem);
        break;
      case 'IMG':
        const imgElem = childNode as HTMLImageElement;
        if (imgElem.className === 'face') {
          // 表情
          msgElems.push({ type: 'face', id: Number(imgElem.id) } as FaceElem);
        }
        break;
      case 'VSCODE-TAG': // 图片
        const tagElem = childNode as Tag;
        const src = tagElem.getAttribute('src') as string;
        const file = src.startsWith('http')
          ? src
          : src.split(';')[1].replace(',', '://');
        msgElems.push({
          type: 'image',
          file,
          url: src,
          asface: tagElem.className === 'stamp'
        } as ImageElem);
        break;
      case 'SPAN': // AT
        const qq = (childNode as HTMLSpanElement).getAttribute('qq');
        msgElems.push({
          type: 'at',
          qq: qq === 'all' ? qq : Number(qq)
        } as AtElem);
        break;
      default:
        console.warn('ChatView sendMessage: 不支持的消息元素');
        break;
    }
  });
  return msgElems;
}
