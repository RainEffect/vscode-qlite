import { WebviewApi } from 'vscode-webview';
import { Handler, MessageType, WebviewMessage } from '../types/webview';

/**
 * 判断传入参数是否为{@link MessageType}类型
 * @param message 需要判断的参数
 * @returns 是否为{@link MessageType}类型
 */
function isValidMsg(message: any): message is WebviewMessage {
  return (
    typeof message === 'object' &&
    typeof message.type === 'number' &&
    typeof message.id === 'string'
  );
}

/** 处理网页与扩展之间的消息 */
export class MessageHandler {
  /** 请求消息的计数器 */
  private requestId = 0;
  /** 管理所有的请求消息的回调函数 */
  private handlers: { [id: string]: Handler } = {};
  /**
   * 处理网页与扩展之间的消息
   * @param vscode 所在页面的`vscode`实例
   */
  constructor(private readonly vscode: WebviewApi<any>) {
    window.addEventListener('message', (event) => {
      if (!isValidMsg(event.data)) {
        return;
      }
      const message: WebviewMessage = event.data;
      if (
        message.type === MessageType.Response ||
        message.type === MessageType.Error
      ) {
        const handler = this.handlers[message.id];
        if (handler) {
          handler(message);
          delete this.handlers[message.id];
        }
      }
    });
  }

  /**
   * 发送请求消息
   * @param type 消息类型，请求消息为{@link MessageType.Request}
   * @param payload 消息包含的数据
   * @returns 返回消息的`Promise`，`Response`消息由`resolve`传递，`Error`消息由`reject`传递
   */
  sendMsg(type: MessageType.Request, payload: any): Promise<any>;
  /**
   * 发送响应消息
   * @param type 消息的类型，有{@link MessageType.Response}, {@link MessageType.Error}
   * @param payload 消息包含的数据
   */
  sendMsg(type: MessageType.Error | MessageType.Response, payload: any): void;
  sendMsg(type: MessageType, payload: any) {
    const id = (this.requestId++).toString();
    this.vscode.postMessage({ type, id, payload } as WebviewMessage);
    if (type !== MessageType.Request) {
      return;
    }
    return new Promise((resolve, reject) => {
      this.handlers[id] = (msg: WebviewMessage) => {
        if (msg.type === MessageType.Response) {
          resolve(msg.payload);
        } else if (msg.type === MessageType.Error) {
          reject(msg.payload);
        }
      };
    });
  }
}
