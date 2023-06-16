import EventEmitter from 'events';
import { Webview } from 'vscode';
import { WebviewApi } from 'vscode-webview';
import ChatCommand from './chat';
import LoginCommand from './login';

/** 所有指令表的基础属性结构 */
export interface Command {
  /** 指令名 */
  [command: string]: {
    /** 请求信息 */
    req: any;
    /** 响应信息 */
    res: any;
  };
}

/** 消息类型，`req`为请求消息，`res`为响应消息 */
type CommandType = 'req' | 'res';

/** 网页消息 */
interface WebMessage<C extends LoginCommand | ChatCommand> {
  /** 消息标识 */
  id: number;
  /** 消息指令 */
  command: keyof C;
  /** 消息类型 */
  type: CommandType;
  /** 发送的数据 */
  payload: C[this['command']][this['type']];
}

type CallBack<
  CMD extends LoginCommand | ChatCommand,
  C extends keyof CMD,
  T extends CommandType
> = (msg: WebMessage<CMD> & { command: C; type: T }) => void;

/** 待处理请求字典 */
interface PendingRequest<C extends LoginCommand | ChatCommand> {
  /** 请求的处理函数 */
  resolve: (/** 响应的消息 */ msg: WebMessage<C>) => void;
  /** 请求的计时器 */
  timeout: NodeJS.Timeout;
}

/** 消息处理器类，需显式定义处理器使用的指令表`CMD` */
export default class MessageHandler<
  CMD extends LoginCommand | ChatCommand
> extends EventEmitter {
  /** 未处理的请求 */
  private pendingRequests: Map<number, PendingRequest<CMD>> = new Map();

  /**
   * 创建网页端的消息处理器
   * @param isWeb 是否是网页端
   * @param webviewApi 网页端的api
   */
  constructor(isWeb: true, webviewApi: WebviewApi<any>);
  /**
   * 创建扩展端的消息处理器
   * @param isWeb 是否是网页端
   * @param webview 网页所在的webview对象
   */
  constructor(isWeb: false, webview: Webview);
  constructor(
    isWeb: boolean,
    private readonly msgApi: Webview | WebviewApi<any>
  ) {
    super();
    /** 通过请求表执行处理函数 */
    const handler = (msg: WebMessage<CMD>) => {
      const request = this.pendingRequests.get(msg.id);
      if (request) {
        clearTimeout(request.timeout);
        request.resolve(msg);
        this.pendingRequests.delete(msg.id);
      }
      this.emit(`${msg.command.toString()}.${msg.type}`, msg);
    };
    if (!isWeb) {
      // 扩展端
      (msgApi as Webview).onDidReceiveMessage(handler);
    } else {
      // 网页端
      window.addEventListener('message', (ev) =>
        handler(ev.data as WebMessage<CMD>)
      );
    }
  }

  /**
   * 发送消息，不等待响应
   * @param command 消息指令
   * @param payload 消息内容
   */
  request<C extends keyof CMD>(command: C, payload: CMD[C]['req']): void;
  /**
   * 发送消息，等待响应
   * @param command 消息指令
   * @param payload 消息内容
   * @param ms 计时器
   */
  request<C extends keyof CMD>(
    command: C,
    payload: CMD[C]['req'],
    ms: number
  ): Promise<WebMessage<CMD> & { command: C; type: 'res' }>;
  request<C extends keyof CMD>(
    command: C,
    payload: CMD[C]['req'],
    ms?: number
  ) {
    if (!ms) {
      const msg: WebMessage<CMD> = { id: -1, command, type: 'req', payload };
      this.msgApi.postMessage(msg);
      return;
    }
    return new Promise(
      (resolve: CallBack<CMD, C, 'res'>, reject: (error: Error) => void) => {
        const timeout = setTimeout(
          () => reject(new Error('timeout waiting for response')),
          ms
        );
        const id = Number(timeout);
        const msg: WebMessage<CMD> = { id, command, type: 'req', payload };
        // @todo 不得已禁用语法检查，逻辑待优化
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.pendingRequests.set(id, { resolve, timeout });
        this.msgApi.postMessage(msg);
      }
    );
  }

  /**
   * 获取对应指令的消息
   * @param command 指令名
   * @param type 消息类型
   */
  get<C extends keyof CMD, T extends CommandType>(command: C, type: T) {
    return new Promise((resolve: CallBack<CMD, C, T>) =>
      this.on(`${command.toString()}.${type}`, resolve)
    );
  }

  /**
   * 响应消息
   * @param id 消息id
   * @param command 指令名
   * @param payload 响应信息
   */
  response<C extends keyof CMD>(
    id: number,
    command: C,
    payload: CMD[C]['res']
  ) {
    const msg: WebMessage<CMD> = { id, command, type: 'res', payload };
    this.msgApi.postMessage(msg);
  }
}
