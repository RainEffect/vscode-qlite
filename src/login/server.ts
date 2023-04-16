import puppeteer, { HTTPRequest, HTTPResponse } from 'puppeteer';
import * as http from 'http';
import websocket = require('ws');
import EventEmitter = require('events');

export class Slider extends EventEmitter {
  private readonly _port: number;
  private readonly _url: string;
  private ticket: string = '';
  private ws: websocket | undefined = undefined;

  public constructor(url: string, port: number) {
    super();
    this._port = port;
    this._url = url;
  }

  public async launchBrowser() {
    const browser = await puppeteer.launch({
      headless: false,
      args: ['--remote-debugging-port=' + this._port]
    });
    const page = await browser.newPage();
    await page.goto(this._url);
    this.getWebSocketDebuggerUrl();
  }

  private getWebSocketDebuggerUrl() {
    http
      .get('http://localhost:' + this._port + '/json/list', (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const obj = JSON.parse(data);
            for (let o of obj) {
              if (o.type === 'iframe') {
                this.getTicket(o.webSocketDebuggerUrl as string);
                break;
              }
            }
          } catch (err: any) {
            console.error(err);
          }
        });
      })
      .on('error', (err) => {
        console.error(err.message);
      });
  }

  private getTicket(webSocketDebuggerUrl: string) {
    this.ws = new websocket(webSocketDebuggerUrl);
    this.ws.on('open', () => {
      this.ws?.send(
        JSON.stringify({
          id: 1,
          method: 'Network.enable'
        })
      );
      console.log('socket listening on ' + webSocketDebuggerUrl);
    });
    this.ws.on('error', (err) => {
      console.log(err.message);
    });
    this.ws.on('close', (code, reason) => {
      console.log('socket closed ' + reason.toString());
      if (this.ticket.length) {
        this.emit('ticket', this.ticket);
      } else {
        this.getWebSocketDebuggerUrl();
      }
    });
    this.ws.on('message', (data) => {
      try {
        const obj = JSON.parse(String(data));
        const params = obj.params;
        if (
          obj.method === 'Network.responseReceived' &&
          params.type === 'XHR' &&
          params.response.url ===
            'https://t.captcha.qq.com/cap_union_new_verify'
        ) {
          this.ws?.send(
            JSON.stringify({
              id: 2,
              method: 'Network.getResponseBody',
              params: {
                requestId: obj.params.requestId
              }
            })
          );
        } else if (obj.id === 2) {
          const body = JSON.parse(obj.result.body);
          this.ticket = body.ticket;
          if (this.ticket) {
            this.ws?.send(
              JSON.stringify({
                id: 3,
                method: 'Browser.close'
              })
            );
            this.ws?.close();
          }
        }
      } catch (err: any) {
        console.error(err);
      }
    });
  }
}
