import * as icqq from 'icqq';
import { Command } from './message-handler';
import { ChatType } from './parse-msg-id';

/** 基本信息接口 */
export interface UserInfo {
  /** QQ号 */
  uin: number;
  /** 昵称 */
  name: string;
  /** 聊天对象类型 */
  type: ChatType;
}

/** 聊天页面指令表 */
export default interface ChatCommand extends Command {
  /** 获取用户基本信息 */
  getSimpleInfo: {
    req: undefined;
    /** 用户的基本信息 */
    res: UserInfo;
  };
  /** 获取漫游表情 */
  getStamp: {
    req: undefined;
    /** 漫游表情图片的url的列表 */
    res: string[];
  };
  /** 获取群员信息，仅群聊有效 */
  getMember: {
    req: undefined;
    res: {
      /** 是否能at全体成员 */
      atAll: boolean;
      /** 成员信息列表 */
      members: icqq.MemberInfo[];
    };
  };
  /** 获取聊天记录 */
  getChatHistory: {
    /** 目标聊天记录的msg_id，从该消息往前获取最多20条聊天记录，为空则从最后一条消息开始往前获取记录 */
    req: string | undefined;
    /** 聊天记录列表 */
    res: (icqq.PrivateMessage | icqq.GroupMessage)[];
  };
  /** 发送消息 */
  sendMsg: {
    req: {
      /** 消息内容 */
      content: icqq.Sendable;
      /** 引用的回复消息 */
      source?: icqq.Quotable;
    };
    /** 发送成功的消息 */
    res: icqq.PrivateMessage | icqq.GroupMessage;
  };
  /** 发送文件 */
  sendFile: {
    /** 文件路径或文件的`Buffer`格式 */
    req: string | Buffer;
    /** 发送成功的消息 */
    res: icqq.PrivateMessage | icqq.GroupMessage;
  };
  /** 获取文件下载地址 */
  getFileUrl: {
    /** 文件id */
    req: string;
    res: undefined;
  };
  /** 消息事件 */
  messageEvent: {
    /** 各个聊天的消息事件 */
    req:
      | icqq.GroupMessageEvent
      | icqq.PrivateMessageEvent
      | icqq.DiscussMessageEvent;
    res: undefined;
  };
  /** 通知事件 */
  noticeEvent: {
    /** 各个聊天的通知事件 */
    req: any;
    res: undefined;
  };
}
