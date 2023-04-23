import {
  provideVSCodeDesignSystem,
  allComponents,
  Button,
  TextField,
  Checkbox,
  Option
} from '@vscode/webview-ui-toolkit';
import { WebviewApi } from 'vscode-webview';
import {
  InitReqMsg,
  InitResMsg,
  LoginReqMsg,
  LoginResMsg,
  QrcodeReqMsg,
  QrcodeResMsg
} from '../../api/web-login';
import { MessageHandler } from '../message-handler';

/** 与扩展主体通信的变量 */
const vscode: WebviewApi<any> = acquireVsCodeApi();
/** 注册vscode主题的webview组件 */
provideVSCodeDesignSystem().register(allComponents);
const messageHandler = new MessageHandler(vscode);

// 获取页面组件
const uinText: TextField = document.querySelector(
  'vscode-text-field#uin'
) as TextField;
const passwordText: TextField = document.querySelector(
  'vscode-text-field#password'
) as TextField;
const loginButton: Button = document.querySelector(
  'vscode-button#login'
) as Button;
const rememberOption: Checkbox = document.querySelector(
  'vscode-checkbox#remember'
) as Checkbox;
const autoLoginOption: Checkbox = document.querySelector(
  'vscode-checkbox#autoLogin'
) as Checkbox;
const qrcodeOption: Option = document.querySelector(
  'vscode-option#qrcode'
) as Option;
const qrcodeImg: HTMLImageElement = document.querySelector(
  'img#qrcode'
) as HTMLImageElement;

/**
 * 判断登录按钮是否可用
 * @returns 可用为true，否则false
 */
function checkLoginState(button: Button) {
  const state =
    (uinText.value.length &&
      passwordText.value.length &&
      !qrcodeOption.selected) ||
    qrcodeOption.selected;
  button.disabled = !state;
  if (state) {
    button.textContent = '登录';
  }
}

// 提交登录信息
loginButton.addEventListener('click', () => {
  loginButton.disabled = true;
  loginButton.textContent = '登录中';
  const reqMsg: LoginReqMsg = {
    command: 'login',
    args: {
      uin: Number(uinText.value),
      password: passwordText.value,
      remember: rememberOption.checked,
      autoLogin: autoLoginOption.checked,
      qrcode: qrcodeOption.selected
    }
  };
  messageHandler
    .request(reqMsg)
    .then((msg: LoginResMsg) => {
      if (!msg.data.ret) {
        console.error('login errer');
      }
    })
    .finally(() => {
      // 解除禁用
      loginButton.disabled = false;
      loginButton.textContent = '登录成功！';
    });
});

// 切换登录方案
qrcodeOption.addEventListener('click', () => {
  /** 为`true`则扫码登陆，`false`则密码登录 */
  const option = !qrcodeOption.selected;
  uinText.disabled = option;
  passwordText.disabled = option;
  rememberOption.disabled = option;
  autoLoginOption.disabled = option;
  qrcodeOption.selected = option;
  if (option) {
    // 二维码登录时向外部请求二维码图片
    const reqMsg: QrcodeReqMsg = {
      command: 'qrcode',
      args: undefined
    };
    messageHandler.request(reqMsg).then((msg: QrcodeResMsg) => {
      qrcodeImg.src = msg.data.src;
      qrcodeImg.style.visibility = 'visible';
    });
  } else {
    // 密码登录时隐藏二维码图片
    qrcodeImg.style.visibility = 'hidden';
  }
});

// 动态判断登录按钮的状态
uinText.addEventListener('input', () => {
  checkLoginState(loginButton);
});
passwordText.addEventListener('input', () => {
  checkLoginState(loginButton);
});
qrcodeOption.addEventListener('click', () => {
  checkLoginState(loginButton);
});

// 响应回车键
window.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    loginButton.click();
  }
});

// 初始化所有组件状态
(() => {
  // 默认不显示二维码
  qrcodeImg.style.visibility = 'hidden';
  const reqMsg: InitReqMsg = {
    command: 'init',
    args: undefined
  };
  // 获取登录账号历史信息
  messageHandler.request(reqMsg).then((msg: InitResMsg) => {
    if (!msg) {
      return;
    }
    uinText.value = msg.data?.uin.toString() ?? '';
    if (!msg.data?.remember) {
      return;
    }
    rememberOption.checked = msg.data.remember;
    passwordText.value = msg.data.password;
    autoLoginOption.checked = msg.data.autoLogin;
    checkLoginState(loginButton);
    if (autoLoginOption.checked) {
      loginButton.click();
    }
  });
})();
