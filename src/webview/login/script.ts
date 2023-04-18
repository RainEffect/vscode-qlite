import {
  provideVSCodeDesignSystem,
  Button,
  TextField,
  Checkbox,
  Option,
  allComponents
} from '@vscode/webview-ui-toolkit';

/** 声明acquireVsCodeApi函数 */
declare function acquireVsCodeApi(): {
  postMessage(message: Object): void;
  getState(): any;
  setState(state: any): void;
};
/** 与扩展主体通信的变量 */
const vscode = acquireVsCodeApi();
/** 注册必要的webview组件 */
provideVSCodeDesignSystem().register(allComponents);

/** 定义表单数据 */
interface LoginData {
  /** QQ账号 */
  uin: number;
  /** 密码 */
  password: string;
  /** 是否记住密码 */
  remember: boolean;
  /** 是否自动登录 */
  autoLogin: boolean;
  /** 是否使用扫码登陆，若此项为真则前面信息无效 */
  qrcode: boolean;
}

// 获取页面组件
const uinText: TextField = document.querySelector(
  'vscode-text-field#uin'
) as TextField;
const passwordText: TextField = document.querySelector(
  'vscode-text-field#password'
) as TextField;
const rememberOption: Checkbox = document.querySelector(
  'vscode-checkbox#remember'
) as Checkbox;
const autoLoginOption: Checkbox = document.querySelector(
  'vscode-checkbox#autoLogin'
) as Checkbox;
const loginButton: Button = document.querySelector(
  'vscode-button#login'
) as Button;
const qrcodeOption: Option = document.querySelector(
  'vscode-option#qrcode'
) as Option;
const qrcodeImg: HTMLImageElement = document.querySelector(
  'img#qrcode'
) as HTMLImageElement;

let timers: NodeJS.Timer[] = [];

/**
 * 回收计时器
 * @param timer 要回收的计时器
 */
function resolveTimer(timer: NodeJS.Timer) {
  clearInterval(timer);
  const index = timers.indexOf(timer);
  if (index !== -1) {
    timers.splice(index, 1);
  }
}

/**
 * 判断登录按钮是否可用
 * @returns 可用为true，否则false
 */
function checkLoginState() {
  return (
    (uinText.value.length &&
      passwordText.value.length &&
      !qrcodeOption.selected) ||
    qrcodeOption.selected
  );
}

/**
 * 切换登陆方案，改变对应元素的可用性
 * @param option 登陆方案
 */
function toggleLoginOption(option: boolean) {
  uinText.disabled = option;
  passwordText.disabled = option;
  rememberOption.disabled = option;
  autoLoginOption.disabled = option;
  qrcodeOption.selected = option;
  qrcodeImg.style.visibility = option ? 'visible' : 'hidden';
}

// 接受来自扩展主体的消息
window.addEventListener('message', (event) => {
  const message = event.data;
  // 查找匹配的计时器id
  timers.forEach((timer) => {
    if (timer === message.id) {
      resolveTimer(timer);
      qrcodeImg.src = message.image;
      qrcodeImg.style.display = 'inline';
      return;
    }
  });
});

// 提交登录信息
loginButton.addEventListener('click', () => {
  // 表单数据
  const postData: LoginData = {
    uin: Number(uinText.value),
    password: passwordText.value,
    remember: rememberOption.checked,
    autoLogin: autoLoginOption.checked,
    qrcode: qrcodeOption.selected
  };
  vscode.postMessage({
    command: 'login',
    data: postData
  });
});

// 切换登录方案
qrcodeOption.addEventListener('click', () => {
  // 切换组件状态
  const nextStatus = !qrcodeOption.selected;
  toggleLoginOption(nextStatus);
  if (nextStatus) {
    // 状态为真则获取二维码
    const timer = setInterval(() => {
      console.error('无法获取二维码，请重试');
      clearInterval(timer);
    }, 2000);
    vscode.postMessage({
      command: 'qrcode',
      data: timer
    });
    timers.push(timer);
  }
});

// 动态判断登录按钮的状态
uinText.addEventListener('input', () => {
  loginButton.disabled = !checkLoginState();
});
passwordText.addEventListener('input', () => {
  loginButton.disabled = !checkLoginState();
});
qrcodeOption.addEventListener('click', () => {
  loginButton.disabled = !checkLoginState();
});

// 响应回车键
window.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    loginButton.click();
  }
});

// 初始化所有组件状态
(() => {
  // 默认禁用登录按钮
  loginButton.disabled = true;
  // 默认不显示二维码
  qrcodeImg.style.visibility = 'hidden';
})();
