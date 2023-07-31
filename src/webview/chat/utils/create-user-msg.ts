import {
  GroupRole,
  MessageElem,
  PrivateMessage,
  GroupMessage,
  DiscussMessage
} from 'icqq';
import { user } from '../script';
import msgElemToNode from './msgelem-to-node';

/**
 * 将时间戳格式化
 * @param time 时间戳
 * @returns 格式化后的时间
 */
function formatTimestamp(time?: number) {
  const date = new Date(time ? time * 1000 : Date.now());
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * 创建管理or群主头衔组件
 * @param role 成员角色
 * @returns `span`组件
 */
export function createFlagSpan(role: 'admin' | 'owner') {
  const elem = document.createElement('span');
  elem.className = 'flag';
  elem.textContent = role === 'owner' ? '群主' : '管理员';
  elem.style.backgroundColor = role === 'owner' ? '#f2bf25' : '#72d6a0';
  return elem;
}

/**
 * 创建名字组件
 * @param name 发送名
 * @returns `span`组件
 */
function createNameSpan(name: string) {
  const elem = document.createElement('span');
  elem.className = 'name';
  elem.textContent = name;
  return elem;
}

/**
 * 创建时间组件
 * @param time 发送时间戳
 * @returns `span`组件
 */
function createTimeSpan(time: number) {
  const elem = document.createElement('span');
  elem.className = 'time';
  elem.textContent = formatTimestamp(time);
  return elem;
}

/**
 * 群聊调用，创建消息头组件
 * @param time 发送时间，用于 {@link createTimeSpan}
 * @param name 发送名，用于 {@link createNameSpan}
 * @param role 管理头衔，用于 {@link createFlagTag}
 * @returns `div`组件
 */
function createHeaderElem(time: number, name?: string, role?: GroupRole) {
  const elem = document.createElement('div');
  elem.className = 'header';
  if (role && role !== 'member') {
    // 添加管理员or群主头衔
    const flagElem = createFlagSpan(role);
    elem.append(flagElem);
  }
  if (name) {
    elem.append(createNameSpan(name));
  }
  elem.append(createTimeSpan(time));
  return elem;
}

/**
 * 创建消息内容组件
 * @param message 消息链
 * @returns `div`组件
 */
function createContentElem(message: MessageElem[]) {
  const elem = document.createElement('div');
  elem.className = 'content';
  elem.append(...msgElemToNode(message));
  return elem;
}

/**
 * 创建头像组件
 * @param name 发送名
 * @param uin 用户QQ
 * @param color 边框颜色
 * @returns `img`组件
 */
function createAvatarElem(name: string, uin: number, color?: string) {
  const elem = document.createElement('img');
  elem.className = 'avatar';
  if (color) {
    elem.style.borderColor = color;
  }
  elem.src = `https://q1.qlogo.cn/g?b=qq&s=40&nk=${uin}`;
  elem.title = name;
  return elem;
}

/**
 * 生成用户消息
 * @param message 群聊or私聊消息
 * @returns 消息实例
 */
export default function createUserMsg(
  message: PrivateMessage | GroupMessage | DiscussMessage
) {
  const container = document.createElement('div');
  container.className = 'container';
  const header =
    message.message_type === 'group'
      ? message.sub_type === 'anonymous'
        ? createHeaderElem(message.time, message.anonymous?.name as string)
        : createHeaderElem(
            message.time,
            message.sender.nickname,
            message.sender.role
          )
      : createHeaderElem(message.time);
  const content = createContentElem(message.message);
  container.append(header, content);
  const avatar = createAvatarElem(
    message.sender.nickname,
    message.sender.user_id,
    message.message_type === 'group' && message.sub_type === 'anonymous'
      ? message.anonymous?.color
      : undefined
  );
  const msg = document.createElement('div');
  msg.className =
    'msg ' + (user.uin === message.sender.user_id ? 'right' : 'left');
  msg.setAttribute('msgid', message.message_id);
  msg.append(avatar, container);
  return msg;
}
