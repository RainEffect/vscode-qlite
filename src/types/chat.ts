import {
  Sendable,
  Quotable,
  PrivateMessage,
  GroupMessage,
  GroupMessageEvent,
  PrivateMessageEvent,
  DiscussMessageEvent
} from 'icqq';
import { WebMessage } from '../webview/message-handler';

/** 聊天类型 */
export enum ChatType {
  /** 群聊 */
  Group,
  /** 私聊 */
  Friend
}

/** 调用 {@link parseMsgId} 解析私聊`msgid`的字段接口 */
interface FriendId {
  uid: number;
  seqid: number;
  random: number;
  timestamp: number;
  flag: number;
}

/** 调用 {@link parseMsgId} 解析群聊`msgid`的字段接口 */
interface GroupId {
  gid: number;
  uid: number;
  seqid: number;
  random: number;
  timestamp: number;
  pktnum: number;
}

/** 基本信息接口 */
export interface UserInfo {
  /** QQ号 */
  uin: number;
  /** 昵称 */
  name: string;
}

/**
 * 解析私聊`msgid`
 * @param id 需要解析的字符串
 * @returns 解析后的id数据
 */
export function parseMsgId(id: string, type: ChatType.Friend): FriendId;
/**
 * 解析群聊`msgid`
 * @param id 需要解析的字符串
 * @returns 解析后的id数据
 */
export function parseMsgId(id: string, type: ChatType.Group): GroupId;
export function parseMsgId(id: string, type: ChatType) {
  const parsed = Buffer.from(id, 'base64');
  return type === ChatType.Friend
    ? ({
        uid: parsed.readUInt32BE(0),
        seqid: parsed.readUint32BE(4),
        random: parsed.readUInt32BE(8),
        timestamp: parsed.readUInt32BE(12),
        flag: parsed.readUInt8(16)
      } as FriendId)
    : ({
        gid: parsed.readUInt32BE(0),
        uid: parsed.readUInt32BE(4),
        seqid: parsed.readUInt32BE(8),
        random: parsed.readUInt32BE(12),
        timestamp: parsed.readUInt32BE(16),
        pktnum: parsed.readUInt8(20)
      } as GroupId);
}

/** 聊天页面涉及的所有消息指令 */
export interface CommandMap {
  getSimpleInfo: {
    req: never;
    res: UserInfo;
  };
  getStamp: {
    req: never;
    res: { stamps: string[] };
  };
  getChatHistory: {
    req: { message_id: string } | undefined;
    res: { history: (PrivateMessage | GroupMessage)[] };
  };
  getUserAvatar: {
    req: { uin: number };
    res: { src: string };
  };
  sendMsg: {
    req: {
      content: Sendable;
      source?: Quotable;
    };
    res: { retMsg: PrivateMessage | GroupMessage };
  };
  messageEvent: {
    req: GroupMessageEvent | PrivateMessageEvent | DiscussMessageEvent;
    res: never;
  };
  noticeEvent: {
    req: any;
    res: never;
  };
}

/** 请求消息 */
export interface ReqMsg<T extends keyof CommandMap> extends WebMessage {
  command: T;
  payload: CommandMap[T]['req'];
}

/** 响应消息 */
export interface ResMsg<T extends keyof CommandMap> extends WebMessage {
  command: T;
  payload: CommandMap[T]['res'];
}
