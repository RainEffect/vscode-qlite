import { VsCodeApi, ResWebMsg, ReqWebMsg, PreReqWebMsg } from '../api/webview';

/** 处理`html`与`webview`之间的消息 */
export class MessageHandler {
  /** 所在页面的`vscode`实例，需要调用`postMessage` */
  private _vscode: VsCodeApi;
  /** 管理所有的消息处理的Map */
  private handlers: Map<NodeJS.Timeout, (data: any) => void> = new Map();

  /**
   * @param vscode 所在页面的`vscode`实例
   */
  constructor(vscode: VsCodeApi) {
    this._vscode = vscode;
    window.addEventListener('message', (event) => {
      const message: ResWebMsg<any> = event.data;
      clearTimeout(message.timer);
      this.handlers.get(message.timer)?.call(null, message);
      this.handlers.delete(message.timer);
    });
  }

  /**
   * 向`webview`请求信息
   * @param reqWebMsg 请求消息
   * @param limit 等待请求的时限，默认为`5000ms`
   * @returns 一个`Promise`对象，`resolve`返回响应的信息，`reject`返回未及时收到消息的原因
   */
  public request(reqWebMsg: PreReqWebMsg<any>, limit: number = 5000) {
    return new Promise(
      (
        resolve: (data: ResWebMsg<any>) => void,
        reject: (reason: string) => void
      ) => {
        const timeout = setTimeout(() => {
          reject('require message timeout');
        }, limit);
        const reqMsg: ReqWebMsg<any> = {
          ...reqWebMsg,
          timer: timeout
        };
        this._vscode.postMessage(reqMsg);
        this.handlers.set(timeout, (data: ResWebMsg<any>) => {
          clearTimeout(timeout);
          resolve(data);
        });
      }
    );
  }
}
