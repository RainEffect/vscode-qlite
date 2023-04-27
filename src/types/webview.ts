/** 消息枚举类型，有*请求*、*响应*和*错误*三种类型 */
export enum MessageType {
  Request = 0,
  Response,
  Error
}

/** 消息接口 */
export interface WebviewMessage {
  /** 消息类型 */
  type: MessageType;
  /** 消息唯一标识 */
  id: string;
  /** 消息携带的数据 */
  payload: any;
}

/** 消息处理的回调函数 */
export type Handler = (payload: any) => void;
