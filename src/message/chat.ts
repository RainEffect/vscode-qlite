import * as icqq from 'icqq';
import { ChatType } from './parse-msg-id';
import { NotificationType, RequestType } from 'vscode-messenger-common';

/** 基本信息接口 */
export interface UserInfo {
  /** QQ号 */
  uin: number;
  /** 昵称 */
  name: string;
  /** 聊天对象类型 */
  type: ChatType;
}

/** 聊天页面的请求类型 */
/** 获取用户基本信息 */
export const getSimpleInfo: RequestType<void, UserInfo> = {
  method: 'getSimpleInfo'
};
/** 获取用户头像 */
export const getUserAvatar: RequestType<number, string> = {
  method: 'getUserAvatar'
};
/** 获取漫游表情 */
export const getStamp: RequestType<void, string[]> = {
  method: 'getStamp'
};
/** 获取群员信息，仅群聊有效 */
export const getMember: RequestType<
  void,
  {
    /** 是否能at全体成员 */
    atAll: boolean;
    /** 成员信息列表 */
    members: icqq.MemberInfo[];
  }
> = {
  method: 'getMember'
};
/** 获取聊天记录 */
export const getChatHistory: RequestType<
  string | void,
  (icqq.PrivateMessage | icqq.GroupMessage)[]
> = {
  method: 'getChatHistory'
};
/** 发送消息 */
export const sendMsg: RequestType<
  {
    /** 消息内容 */
    content: icqq.Sendable;
    /** 引用的回复消息 */
    source?: icqq.Quotable;
  },
  icqq.PrivateMessage | icqq.GroupMessage | undefined
> = {
  method: 'sendMsg'
};
/** 发送文件 */
export const sendFile: RequestType<
  string | Buffer,
  icqq.PrivateMessage | icqq.GroupMessage | undefined
> = {
  method: 'sendFile'
};
/** 获取文件下载地址 */
export const getFileUrl: NotificationType<string> = {
  method: 'getFileUrl'
};
/** 消息事件 */
export const messageEvent: NotificationType<
  icqq.GroupMessageEvent | icqq.PrivateMessageEvent | icqq.DiscussMessageEvent
> = {
  method: 'messageEvent'
};
/** 通知事件 */
export const noticeEvent: NotificationType<any> = {
  method: 'noticeEvent'
};
