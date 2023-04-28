import * as webviewUiToolkit from '@vscode/webview-ui-toolkit';
import {
  QrcodeLoginRecord,
  PasswordLoginRecord,
  TokenLoginRecord,
  ResMsg,
  ReqMsg
} from '../../types/login';
import MessageHandler from '../message-handler';
import { LoginRecord } from '../../types/login';
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
        .postMessage({ id: '', command: 'qrcode' } as ReqMsg<'qrcode'>, 1000)
        .then((msg) => {
          qrcodeImg.src = (msg as ResMsg<'qrcode'>).payload.src;
          qrcodeImg.hidden = false;
        })
        .catch((err: Error) => {
          console.error('LoginView qrcode: ' + err.message);
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

function toggleReadonlyState() {
  const state = !loginButton.disabled;
  loginButton.disabled = state;
  autoLoginCheckbox.readOnly = state;
  if (loginMethod === 'password') {
    uinText.readOnly = state;
    passwordText.readOnly = state;
    rememberOption.ariaReadOnly = state ? 'true' : 'false';
  } else if (loginMethod === 'token') {
    uinText.readOnly = state;
  }
}

/**
 * 获取页面的登录信息
 * @throws 登录按钮不可用时禁止获取登录信息
 * @returns 登录信息
 */
function getLoginInfo(): LoginRecord {
  if (loginButton.disabled) {
    throw Error('LoginView: login button is disabled');
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
      uin: Number(uinText.value),
      autoLogin: autoLoginCheckbox.checked
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
    .postMessage(
      { id: '', command: 'login', payload: getLoginInfo() } as ReqMsg<'login'>,
      10000
    )
    .then((msg) => {
      const ret = (msg as ResMsg<'login'>).payload.ret;
      if (ret === true) {
        loginButton.textContent = '登录成功！';
      } else {
        console.error('LoginView login: ' + ret);
        checkLoginState();
      }
    })
    .catch((error: Error) => {
      console.error('LoginView login: ' + error.message);
      checkLoginState();
    });
  loginButton.textContent = '登录中';
  toggleReadonlyState();
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
    .postMessage({ id: '', command: 'init' } as ReqMsg<'init'>, 2000)
    .then((msg) => {
      const record = (msg as ResMsg<'init'>).payload;
      // 似乎是radio-group的bug，初始化时首次点击总是会选中最后一个radio，所以默认设置需要重复2次
      loginRadios[0].click();
      if (!record) {
        loginRadios[0].click();
        return;
      }
      if (record.method === 'password') {
        uinText.value = record.uin.toString();
        if (record.remember) {
          loginRadios[0].click();
          rememberOption.selected = true;
          passwordText.value = record.password as string;
        }
      } else if (record.method === 'qrcode') {
        loginRadios[1].click();
      } else if (record.method === 'token') {
        loginRadios[2].click();
        uinText.value = record.uin.toString();
      }
      autoLoginCheckbox.checked = record.autoLogin;
      checkLoginState();
      if (autoLoginCheckbox.checked) {
        loginButton.click();
      }
    })
    .catch((error: Error) => {
      console.error('LoginView init: ' + error.message);
    });
})();
