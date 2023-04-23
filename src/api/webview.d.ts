/** `webview`与`html`的交互消息 */
export interface WebMsg {
  /** 所有消息类都必须有的唯一标识，且在有限时间内无响应则抛出异常 */
  timer: NodeJS.Timeout;
}

/** 不包含`timer`的预请求消息，`timer`在`handler`中构建 */
export interface PreReqWebMsg<T> {
  /** 请求的指令 */
  command: string;
  /** 指令后接的可选参数 */
  args: T;
}

/** 请求消息 */
export interface ReqWebMsg<T> extends WebMsg, PreReqWebMsg<T> {}

/** 响应消息 */
export interface ResWebMsg<T> extends WebMsg {
  /** 响应的数据 */
  data: T;
}
