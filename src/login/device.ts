import EventEmitter = require('events');
import puppeteer, { Browser, HTTPResponse, Page } from 'puppeteer';

export class Device extends EventEmitter {
  private readonly _url: string;

  constructor(url: string) {
    super();
    this._url = url;
    this.launchBrowser();
  }

  private async launchBrowser() {
    const browser: Browser = await puppeteer.launch({ headless: false });
    const page: Page = await browser.newPage();
    const res: HTTPResponse | null = await page.goto(this._url);
    if (!res || !res.ok()) {
      console.error('failed to open the url');
      return;
    }
    browser.on('disconnected', () => {
      // 关闭浏览器时发送登录信息
      this.emit('device');
    });
  }
}
