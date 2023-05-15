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
      case 'IMG': // 图片
        const imgElem = childNode as HTMLImageElement;
        if (imgElem.className === 'face') {
          // 表情
          msgElems.push({ type: 'face', id: Number(imgElem.id) } as FaceElem);
        } else {
          // 图片
          const file = imgElem.currentSrc.startsWith('http')
            ? imgElem.currentSrc
            : imgElem.currentSrc.split(';')[1].replace(',', '://');
          msgElems.push({
            type: 'image',
            file,
            url: imgElem.currentSrc
          } as ImageElem);
        }
        break;
      case 'A': // AT
        const qq = (childNode as HTMLAnchorElement).id;
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
