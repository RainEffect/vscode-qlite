import {
  provideVSCodeDesignSystem,
  allComponents,
  TextField,
  Checkbox,
  Button,
  Badge,
  Dropdown
} from '@vscode/webview-ui-toolkit';
import LoginCommand, { Record } from '../../message/login';
import MessageHandler from '../../message/message-handler';

/** 注册`vscode-ui`的`webview`组件 */
provideVSCodeDesignSystem().register(allComponents);
/** 与扩展主体通信的变量 */
const vscode = acquireVsCodeApi();
/** 消息处理器 */
const msgHandler = new MessageHandler<LoginCommand>(true, vscode);

// 获取页面组件
/** 扩展描述 */
const descBadge = document.getElementById('desc') as Badge;
/** 登录状态选单 */
const statusDropdown = document.getElementById('online-status') as Dropdown;
/** 账号输入框 */
const uinText = document.getElementById('uin') as TextField;
/** 密码输入框 */
const passwordText = document.getElementById('password') as TextField;
/** 记住密码选项 */
const savePassCheckbox = document.getElementById('save-pass') as Checkbox;
/** 自动登录选项 */
const autoLoginCheckbox = document.getElementById('auto-login') as Checkbox;
/** 登录按钮 */
const loginButton = document.getElementById('login') as Button;

/**
 * 刷新登录按钮状态
 */
function refreshButtonState() {
  /** 当账号有值时允许登录 */
  const state = uinText.value.length;
  loginButton.disabled = !state;
  if (state) {
    loginButton.textContent = '登录';
  }
}

/**
 * 切换登录状态，登录时禁用组件设置为只读
 * @param state 登录状态，默认为当前状态的下一状态
 */
function changeLoginState(state = !loginButton.disabled) {
  loginButton.disabled =
    uinText.readOnly =
    passwordText.readOnly =
    autoLoginCheckbox.readOnly =
    savePassCheckbox.readOnly =
    statusDropdown.disabled =
      state;
}

// 等待登录回应消息
msgHandler.get('loginRet', 'req').then((msg) => {
  if (msg.payload) {
    loginButton.textContent = '登录成功！';
    msgHandler.response(msg.id, msg.command, true);
  } else {
    changeLoginState();
    refreshButtonState();
  }
});

// 提交登录信息
loginButton.addEventListener('click', () => {
  /** 登录信息 */
  const record: Record = {
    uin: Number(uinText.value),
    password: passwordText.value,
    savePass: savePassCheckbox.checked,
    autoLogin: autoLoginCheckbox.checked,
    onlineStatus: Number(statusDropdown.selectedOptions[0].value)
  };
  msgHandler.request('submitRecord', record);
  loginButton.textContent = '登录中';
  changeLoginState();
});

// 动态判断登录按钮的状态
uinText.addEventListener('input', refreshButtonState);
passwordText.addEventListener('input', refreshButtonState);

// 响应回车键
window.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    loginButton.click();
  }
});

(() => {
  // 获取扩展版本信息
  msgHandler
    .request('getDesc', undefined, 2000)
    .then((msg) => (descBadge.textContent = msg.payload));
  // 获取登录账号历史信息
  msgHandler.request('getRecord', undefined, 2000).then((msg) => {
    const record = msg.payload;
    if (!record) {
      refreshButtonState();
      return;
    }
    uinText.value = record.uin.toString();
    if (record.savePass) {
      passwordText.value = record.password;
    }
    savePassCheckbox.checked = record.savePass;
    autoLoginCheckbox.checked = record.autoLogin;
    statusDropdown.options.forEach((option) => {
      if (option.value === record.onlineStatus.toString()) {
        option.selected = true;
        return;
      }
    });
    refreshButtonState();
    if (autoLoginCheckbox.checked) {
      // 自动登录
      loginButton.click();
    }
  });
})();
