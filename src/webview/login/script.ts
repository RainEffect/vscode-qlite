import * as webviewUiToolkit from '@vscode/webview-ui-toolkit';
import {
  LoginReqMsg,
  LoginResMsg,
  ErrorMsg,
  QrcodeReqMsg,
  QrcodeResMsg,
  InitReqMsg,
  InitResMsg,
  QrcodeLoginRecord,
  PasswordLoginRecord,
  TokenLoginRecord
} from '../../types/login';
import { MessageType } from '../../types/webview';
import { MessageHandler } from '../message-handler';
/** 注册`vscode-ui`的`webview`组件 */
webviewUiToolkit
  .provideVSCodeDesignSystem()
  .register(webviewUiToolkit.allComponents);
/** 与扩展主体通信的变量 */
const vscode = acquireVsCodeApi();
/** 消息处理器 */
const msgHandler = new MessageHandler(vscode);

// 获取页面组件
const loginRadioGroup = document.querySelector(
  'vscode-radio-group'
) as webviewUiToolkit.RadioGroup;
const loginRadios = loginRadioGroup.querySelectorAll(
  'vscode-radio'
) as NodeListOf<webviewUiToolkit.Radio>;
const uinText = document.querySelector(
  'vscode-text-field#uin'
) as webviewUiToolkit.TextField;
const passwordText = document.querySelector(
  'vscode-text-field#password'
) as webviewUiToolkit.TextField;
const rememberOption = document.querySelector(
  'vscode-option#remember'
) as webviewUiToolkit.Option;
const tokenTag = document.querySelector(
  'vscode-tag#token-warn'
) as webviewUiToolkit.Tag;
const autoLoginCheckbox = document.querySelector(
  'vscode-checkbox#autoLogin'
) as webviewUiToolkit.Checkbox;
const qrcodeImg = document.querySelector('img#qrcode') as HTMLImageElement;
const loginButton = document.querySelector(
  'vscode-button#login'
) as webviewUiToolkit.Button;

/** 全局记录登录方式 */
var loginMethod: 'password' | 'qrcode' | 'token';

loginRadioGroup.addEventListener('click', (ev: MouseEvent) => {
  console.log(ev.target);
  try {
    const target = ev.target as webviewUiToolkit.Radio;
    if (target.id === loginMethod) {
      return;
    }
    loginMethod = target.id as 'password' | 'qrcode' | 'token';
    uinText.hidden = target.id === 'qrcode';
    passwordText.hidden = target.id !== 'password';
    tokenTag.hidden = target.id !== 'token';
    qrcodeImg.hidden = target.id !== 'qrcode';
    if (target.id === 'qrcode') {
      msgHandler
        .sendMsg(MessageType.Request, {
          command: 'qrcode'
        } as QrcodeReqMsg)
        .then((payload: QrcodeResMsg) => {
          qrcodeImg.src = payload.src;
          qrcodeImg.hidden = false;
        })
        .catch((error: ErrorMsg) => {
          console.error(error.reason);
        });
    }
    checkLoginState();
  } catch (err) {}
});

/**
 * 判断登录按钮是否可用，不同登录方式的判断条件不同
 */
function checkLoginState() {
  const state =
    loginMethod === 'password'
      ? uinText.value.length && passwordText.value.length
      : loginMethod === 'qrcode'
      ? true
      : uinText.value.length;
  loginButton.disabled = !state;
  if (state) {
    loginButton.textContent = '登录';
  }
}

/**
 * 获取页面的登录信息
 * @throws 登录按钮不可用时禁止获取登录信息
 * @returns 登录信息
 */
function getLoginInfo():
  | PasswordLoginRecord
  | QrcodeLoginRecord
  | TokenLoginRecord {
  if (loginButton.disabled) {
    throw Error('login button is disabled');
  }
  if (loginMethod === 'password') {
    return {
      method: 'password',
      uin: Number(uinText.value),
      password: passwordText.value,
      remember: rememberOption.selected,
      autoLogin: autoLoginCheckbox.checked
    } as PasswordLoginRecord;
  } else if (loginMethod === 'qrcode') {
    return {
      method: 'qrcode',
      autoLogin: autoLoginCheckbox.checked
    } as QrcodeLoginRecord;
  } else {
    return {
      method: 'token',
      uin: Number(uinText.value)
    } as TokenLoginRecord;
  }
}

// 暂存记住密码的选中状态
rememberOption.addEventListener('click', () => {
  rememberOption.selected = !rememberOption.selected;
});

// 提交登录信息
loginButton.addEventListener('click', () => {
  msgHandler
    .sendMsg(MessageType.Request, {
      command: 'login',
      data: getLoginInfo()
    } as LoginReqMsg)
    .then((payload: LoginResMsg) => {
      loginButton.textContent = '登录成功！';
    })
    .catch((error: ErrorMsg) => {
      console.error(error.reason);
      checkLoginState();
    });
  loginButton.disabled = true;
  loginButton.textContent = '登录中';
});

// 动态判断登录按钮的状态
uinText.addEventListener('input', () => {
  checkLoginState();
});
passwordText.addEventListener('input', () => {
  checkLoginState();
});

// 响应回车键
window.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    loginButton.click();
  }
});

// 初始化所有组件状态
(() => {
  // 获取登录账号历史信息
  msgHandler
    .sendMsg(MessageType.Request, { command: 'init' } as InitReqMsg)
    .then((payload: InitResMsg) => {
      // 似乎是radio-group的bug，初始化时首次点击总是会选中最后一个radio，所以默认设置需要重复2次
      loginRadios[0].click();
      if (!payload) {
        loginRadios[0].click();
        return;
      }
      if (payload.method === 'password') {
        uinText.value = payload.uin.toString();
        if (payload.remember) {
          loginRadios[0].checked = true;
          rememberOption.selected = true;
          passwordText.value = payload.password as string;
        }
      } else if (payload.method === 'qrcode') {
        loginRadios[1].checked = true;
      } else if (payload.method === 'token') {
        loginRadios[2].checked = true;
        uinText.value = payload.uin.toString();
      }
      autoLoginCheckbox.checked = payload.autoLogin;
      checkLoginState();
      if (autoLoginCheckbox.checked) {
        loginButton.click();
      }
    })
    .catch((error: ErrorMsg) => {
      console.error(error.reason);
    });
})();
