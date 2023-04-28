import * as vscode from 'vscode';
import * as vscodeWebview from 'vscode-webview';

/** 消息接口 */
export interface WebMessage {
  /** 消息标识 */
  id: string;
  /** 消息类型 */
  command: string;
  /** 发送的数据 */
  payload?: any;
}

/** 待定的响应函数接口 */
interface PendingRequest {
  /** 消息处理回调 */
  resolve: (response: WebMessage) => void;
  /** 错误处理回调 */
  reject: (error: Error) => void;
  /** 超时timer */
  timeoutId: NodeJS.Timeout;
}

/** 网页与扩展之间的消息处理器 */
export default class MessageHandler {
  /** 消息计数器 */
  private messageId = 0;
  /** 管理所有的请求消息的回调函数 */
  private pendinRequest: Map<string, PendingRequest> = new Map();
  /**
   * 构造消息处理器
   * @param msgApi 扩展端为{@link vscode.Webview}，网页端为{@link vscodeWebview.WebviewApi}
   */
  constructor(
    private readonly msgApi: vscode.Webview | vscodeWebview.WebviewApi<any>
  ) {
    this.onMessage((response) => {
      const request = this.pendinRequest.get(response.id);
      if (request) {
        clearTimeout(request.timeoutId);
        request.resolve(response);
        this.pendinRequest.delete(response.id);
      }
    });
  }

  /** 类型保护函数 */
  private _isWeb(instance: any): instance is vscodeWebview.WebviewApi<any> {
    return !!instance.setState;
  }

  /**
   * 发送消息，不等待响应消息
   * @param msg 消息
   */
  postMessage(msg: WebMessage): void;
  /**
   * 发送消息，等待响应消息
   * @param msg 消息
   * @param timeout 超时限制
   * @returns 返回响应消息的`Promise`
   */
  postMessage(msg: WebMessage, timeout: number): Promise<WebMessage>;
  postMessage(msg: WebMessage, timeout?: number) {
    if (!timeout) {
      this.msgApi.postMessage(msg);
      return;
    }
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('timeout waiting for response'));
      }, timeout);
      const id = String(this.messageId++);
      msg.id = id;
      this.pendinRequest.set(id, { resolve, reject, timeoutId });
      this.postMessage(msg);
    });
  }

  /**
   * 接收消息
   * @param callback 接收到消息后的处理函数
   */
  onMessage(callback: (msg: WebMessage) => void) {
    if (!this._isWeb(this.msgApi)) {
      this.msgApi.onDidReceiveMessage((msg) => {
        callback(msg);
      });
    } else {
      window.addEventListener('message', (ev) => {
        callback(ev.data);
      });
    }
  }
}
