import puppeteer, { Browser, HTTPRequest, HTTPResponse, Page } from 'puppeteer';
import * as http from 'http';
import websocket = require('ws');
import EventEmitter = require('events');
import * as portfinder from 'portfinder';

/** 处理滑动验证码的事件类 */
export class Slider extends EventEmitter {
  /** 滑动验证码的网址 */
  private readonly _url: string;
  /** ws的远程调试端口 */
  private _port: number = 0;
  /** 通过websocket监视浏览器 */
  private _ws: websocket | undefined;
  /** 获取的ticket */
  private _ticket: string = '';

  /**
   * 构造函数
   * @param url 滑动验证码网址
   */
  constructor(url: string) {
    super();
    this._url = url;
    this.launchBrowser();
  }

  /**
   * 启动chromium
   */
  private async launchBrowser() {
    this._port = await portfinder.getPortPromise(); // 获取空闲端口
    const browser: Browser = await puppeteer.launch({
      headless: false,
      // 开启远程调试，为websocket提供调试端口
      args: ['--remote-debugging-port=' + this._port]
    }); // 打开浏览器
    const page: Page = await browser.newPage(); // 新建标签页
    const res: HTTPResponse | null = await page.goto(this._url); // 打开网页
    if (!res || !res.ok()) {
      // 打开网页失败
      console.error('failed to open the url');
      return;
    }
    // 获取远程调试地址
    this.getWebSocketDebuggerUrl();
  }

  /**
   * 获取websocket的远程调试地址
   */
  private getWebSocketDebuggerUrl() {
    http
      .get(
        'http://localhost:' + this._port + '/json/list',
        (res: http.IncomingMessage) => {
          let data = '';
          // 获取Target信息
          res
            .on('data', (chunk: string) => (data += chunk))
            .on('end', () => {
              try {
                const obj = JSON.parse(data);
                for (let o of obj) {
                  if (o.type === 'iframe') {
                    // 主页面的监听无效，必须获取iframe中的监听地址
                    this.getTicket(o.webSocketDebuggerUrl as string);
                    return;
                  }
                }
                this.getWebSocketDebuggerUrl();
              } catch (err: any) {
                console.error(err);
              }
            });
        }
      )
      .on('error', (err: Error) => {
        console.error(err.message);
      });
  }

  /**
   * 借助websocket监听网络识别ticket
   * @param webSocketDebuggerUrl websocket的调试地址
   */
  private getTicket(webSocketDebuggerUrl: string) {
    // 创建websocket
    this._ws = new websocket(webSocketDebuggerUrl);
    this._ws
      .on('open', () => {
        // 开始监听
        this._ws?.send(
          JSON.stringify({
            id: 1,
            method: 'Network.enable'
          })
        );
        console.log('socket listening on ' + webSocketDebuggerUrl);
      })
      .on('error', (err) => {
        // 监听错误
        console.log(err.message);
      })
      .on('close', (code, reason) => {
        // 监听关闭
        console.log('socket closed ' + reason.toString());
        if (this._ticket.length) {
          // 成功获取到ticket
          this.emit('ticket', this._ticket);
        } else {
          // iframe刷新，需要重新监听
          this.getWebSocketDebuggerUrl();
        }
      })
      .on('message', (data) => {
        // 消息处理
        try {
          const obj: any = JSON.parse(data.toString());
          if (
            obj.method === 'Network.responseReceived' &&
            obj.params.type === 'XHR' &&
            obj.params.response.url ===
              'https://t.captcha.qq.com/cap_union_new_verify'
          ) {
            // 获取符合要求的响应报文
            this._ws?.send(
              // 请求响应报文的主体
              JSON.stringify({
                id: 2,
                method: 'Network.getResponseBody',
                params: {
                  requestId: obj.params.requestId
                }
              })
            );
          } else if (obj.id === 2) {
            // 获取目标报文的主体
            const body = JSON.parse(obj.result.body);
            this._ticket = body.ticket;
            if (this._ticket) {
              // 获取到有效ticket，关闭浏览器和websocket
              this._ws?.send(
                JSON.stringify({
                  id: 3,
                  method: 'Browser.close'
                })
              );
              this._ws?.close();
            }
          }
        } catch (err: any) {
          console.error(err);
        }
      });
  }
}
