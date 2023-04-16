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

// 获取页面组件
const form: HTMLFormElement = document.querySelector('form') as HTMLFormElement;
const uinText: TextField = document.querySelector(
  'vscode-text-field#uin'
) as TextField;
const passwordText: TextField = document.querySelector(
  'vscode-text-field#password'
) as TextField;
const remember: Checkbox = document.querySelector(
  'vscode-checkbox#remember'
) as Checkbox;
const autoLogin: Checkbox = document.querySelector(
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
function checkLoginStatue() {
  return (
    (uinText.value === '' || passwordText.value === '') &&
    !qrcodeOption.selected
  );
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
  const formData: FormData = new FormData(form);
  let postData = {};
  for (const [key, value] of formData.entries()) {
    postData[key] = value;
  }
  vscode.postMessage({
    command: 'login',
    ...postData
  });
});

// 获取登录二维码
qrcodeOption.addEventListener('click', () => {
  // 切换组件状态
  const nextStatus = !qrcodeOption.selected;
  uinText.disabled = nextStatus;
  passwordText.disabled = nextStatus;
  qrcodeOption.selected = nextStatus;
  remember.disabled = nextStatus;
  autoLogin.disabled = nextStatus;
  qrcodeImg.style.visibility = nextStatus ? 'visible' : 'hidden';

  if (nextStatus) {
    // 状态为真则获取二维码
    const timer = setInterval(() => {
      console.error('无法获取二维码，请重试');
      clearInterval(timer);
    }, 2000);
    vscode.postMessage({
      command: 'qrcode',
      id: timer
    });
    timers.push(timer);
  }
});

// 动态判断登录按钮的状态
uinText.addEventListener('input', () => {
  loginButton.disabled = checkLoginStatue();
});
passwordText.addEventListener('input', () => {
  loginButton.disabled = checkLoginStatue();
});
qrcodeOption.addEventListener('click', () => {
  loginButton.disabled = checkLoginStatue();
});
// 响应回车键
uinText.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    loginButton.click();
  }
});
passwordText.addEventListener('keydown', (event) => {
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
