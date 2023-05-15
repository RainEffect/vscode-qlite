import { Tag } from '@vscode/webview-ui-toolkit';
import { MessageElem } from 'icqq';
import { FaceType, sface } from './sface';

/**
 * 添加`elem`元素的点击显示图片交互事件
 * @param elem 实现目标元素
 * @param src 图片地址
 */
function addTagClickEvent(elem: Tag, src: string) {
  /** 被显示的图片 */
  const image = document.createElement('img');
  image.src = src;
  image.className = 'enlarge';
  /** 是否显示了图片 */
  let showImage = false;
  // 点击显示图片
  elem.onclick = () => {
    if (showImage) {
      return;
    }
    showImage = true;
    elem.insertAdjacentElement('afterend', image);
    document.addEventListener('click', function removeImg(ev: MouseEvent) {
      if (
        ev.target !== elem &&
        !elem.contains(ev.target as Node) &&
        ev.target !== image
      ) {
        showImage = false;
        // 移除图片
        image.parentNode?.removeChild(image);
        // 移除监听器
        document.removeEventListener('click', removeImg);
      }
    });
  };
}

/**
 * 创建图片组件，由`vscode-tag`代替，点击时显示原图
 * @param src 图片地址
 * @param asface 是否标记为表情
 * @returns `vscode-tag`组件
 */
export function createImgElem(src: string, asface?: boolean) {
  const elem = document.createElement('vscode-tag') as Tag;
  elem.textContent = asface ? '表情' : '图片';
  elem.className = 'image';
  addTagClickEvent(elem, src);
  return elem;
}

/**
 * 创建漫游表情组件，由`vscode-tag`代替，点击时显示原图
 * @param src 图片地址
 * @returns `vscode-tag`组件
 */
export function createStampElem(src: string) {
  const elem = document.createElement('vscode-tag') as Tag;
  elem.textContent = '漫游表情';
  elem.className = 'stamp';
  addTagClickEvent(elem, src);
  return elem;
}

/**
 * 创建QQ表情组件
 * @param id 表情的`id`，对应 {@link sface} 中的`id`
 * @param type 显示的表情类型：静态or动态
 * @returns `image`组件
 */
export function createFaceElem(id: number, type: FaceType) {
  const elem = document.createElement('img');
  elem.src =
    `https://qq-face.vercel.app/` +
    `${type ? 'gif' : 'static'}/s${id}.${type ? 'gif' : 'png'}`;
  elem.title = elem.alt = sface.get(id) ?? '表情';
  elem.className = 'face';
  return elem;
}

/**
 * 创建AT组件
 * @param target AT的对象，包含`@`符号
 * @returns `span`组件
 */
export function createAtElem(target: string) {
  const elem = document.createElement('span');
  elem.className = 'at';
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
            msgElem.qq === 'all' ? '@全体成员' : msgElem.text ?? 'null'
          )
        );
        break;
      case 'bface':
        break;
      case 'dice':
        break;
      case 'face':
        message.push(createFaceElem(msgElem.id, FaceType.static));
        break;
      case 'file':
        break;
      case 'flash':
        break;
      case 'image':
        message.push(createImgElem(msgElem.url as string, msgElem.asface));
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
        message.push(createFaceElem(msgElem.id, FaceType.gif));
        break;
      case 'share':
        break;
      case 'text':
        message.push(document.createTextNode(msgElem.text));
        break;
      case 'video':
        break;
      case 'xml':
        break;
    }
  });
  return message;
}
