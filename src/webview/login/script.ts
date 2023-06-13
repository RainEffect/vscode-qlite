import {
  provideVSCodeDesignSystem,
  allComponents,
  Radio,
  TextField,
  Option,
  Tag,
  Checkbox,
  Button
} from '@vscode/webview-ui-toolkit';
import LoginCommand, {
  LoginRecord,
  PasswordRecord,
  QrcodeRecord,
  TokenRecord
} from '../../message/login';
import MessageHandler from '../../message/message-handler';

/** 注册`vscode-ui`的`webview`组件 */
provideVSCodeDesignSystem().register(allComponents);
/** 与扩展主体通信的变量 */
const vscode = acquireVsCodeApi();
/** 消息处理器 */
const msgHandler = new MessageHandler<LoginCommand>(true, vscode);

// 获取页面组件
/** 登录选项组 */
const loginRadios = document.querySelectorAll(
  'vscode-radio-group vscode-radio'
) as NodeListOf<Radio>;
/** 账号输入框 */
const uinText = document.getElementById('uin') as TextField;
/** 密码输入框 */
const passwordText = document.getElementById('password') as TextField;
/** 记住密码选项 */
const rememberOption = document.getElementById('remember') as Option;
/** token登录提示信息 */
const tokenTag = document.getElementById('token-warn') as Tag;
/** 自动登录选项 */
const autoLoginCheckbox = document.getElementById('autoLogin') as Checkbox;
/** 二维码图片 */
const qrcodeImg = document.getElementById('qrcode') as HTMLImageElement;
/** 登录按钮 */
const loginButton = document.getElementById('login') as Button;

/** 全局记录登录方式 */
let loginMethod: 'password' | 'qrcode' | 'token';

// 切换登录选项
loginRadios.forEach((loginRadio) =>
  loginRadio.addEventListener('click', () => {
    if (loginRadio.value === loginMethod) {
      return;
    }
    loginMethod = loginRadio.value as 'password' | 'qrcode' | 'token';
    uinText.hidden = loginRadio.value === 'qrcode';
    passwordText.hidden = loginRadio.value !== 'password';
    tokenTag.hidden = loginRadio.value !== 'token';
    qrcodeImg.hidden = loginRadio.value !== 'qrcode';
    if (loginRadio.value === 'qrcode') {
      msgHandler
        .request('getQrcode', undefined, 1000)
        .then((msg) => {
          qrcodeImg.src = msg.payload;
          qrcodeImg.hidden = false;
        })
        .catch((err: Error) => {
          console.error('LoginView qrcode: ' + err.message);
        });
    }
    checkLoginState();
  })
);

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
 * 切换可读状态，登录中时禁止修改表单信息
 */
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
 * @returns 登录信息
 */
function getLoginInfo(): LoginRecord {
  if (loginMethod === 'password') {
    return {
      method: 'password',
      uin: Number(uinText.value),
      password: passwordText.value,
      remember: rememberOption.selected,
      autoLogin: autoLoginCheckbox.checked
    } as PasswordRecord;
  } else if (loginMethod === 'qrcode') {
    return {
      method: 'qrcode',
      autoLogin: autoLoginCheckbox.checked
    } as QrcodeRecord;
  } else {
    return {
      method: 'token',
      uin: Number(uinText.value),
      autoLogin: autoLoginCheckbox.checked
    } as TokenRecord;
  }
}

// 记录记住密码的选中状态
rememberOption.addEventListener(
  'click',
  () => (rememberOption.selected = !rememberOption.selected)
);

// 提交登录信息
loginButton.addEventListener('click', () => {
  msgHandler
    .request('submitRecord', getLoginInfo(), 30000)
    .then((msg) => {
      if (msg.payload) {
        loginButton.textContent = '登录成功！';
      } else {
        console.error('LoginView login: ' + msg.payload);
        checkLoginState();
      }
    })
    .catch((error: Error) => {
      console.error('LoginView login: ' + error.message);
    })
    .finally(() => {
      toggleReadonlyState();
      checkLoginState();
    });
  loginButton.textContent = '登录中';
  toggleReadonlyState();
});

// 动态判断登录按钮的状态
uinText.addEventListener('input', checkLoginState);
passwordText.addEventListener('input', checkLoginState);

// 响应回车键
window.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    loginButton.click();
  }
});

(() =>
  // 获取登录账号历史信息
  msgHandler
    .request('getRecord', undefined, 2000)
    .then((msg) => {
      const record = msg.payload;
      if (!record) {
        // 默认密码登录
        loginRadios[0].click();
        return;
      }
      // 判断各个登录方式
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
        // 自动登录
        loginButton.click();
      }
    })
    .catch((error: Error) => {
      console.error('LoginView init: ' + error.message);
    }))();
