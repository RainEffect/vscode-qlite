import { Gender, OnlineStatus } from 'icqq';
import { QuickPickItem, QuickPickItemKind, commands, window } from 'vscode';
import Global from '../global';
import LoginRecordManager from '../login-record';

/** 状态选项 */
const statusMap: Map<number, string> = new Map([
  [OnlineStatus.Online, '在线'],
  [OnlineStatus.Qme, 'Q我吧'],
  [OnlineStatus.Absent, '离开'],
  [OnlineStatus.Busy, '忙碌'],
  [OnlineStatus.DontDisturb, '请勿打扰'],
  [OnlineStatus.Invisible, '隐身']
]);

/** 性别选项 */
const genderMap: Map<Gender, string> = new Map([
  ['male', '男'],
  ['female', '女'],
  ['unknown', '未知']
]);

/**
 * 管理账号，可以切换账号，退出账号
 * @todo 支持删除登录账号记录（record删除+token删除）
 */
async function setAccounts() {
  const accounts: QuickPickItem[] = [];
  const recordMap = await LoginRecordManager.getLoginRecord();
  recordMap.forEach((nickname, uin) => {
    accounts.push({
      label: '$(account) ' + nickname,
      description: uin.toString()
    });
  });
  accounts.push(
    { label: '', kind: QuickPickItemKind.Separator },
    { label: '$(log-out) 退出' }
  );
  window
    .showQuickPick(accounts, {
      placeHolder: '当前帐号：' + Global.client.nickname
    })
    .then(async (accountItem) => {
      if (!accountItem || Number(accountItem.description) === Global.client.uin) {
        // 重复点击已登录账号不退出
        return;
      }
      await Global.client.logout();
      if (accountItem === accounts[accounts.length - 1]) {
        // 退出
        Global.loginViewProvider.setEmptyView(true);
        commands.executeCommand('setContext', 'qlite.isOnline', false);
      } else {
        // 切换账号
        const uin = Number(accountItem.description);
        Global.client.login(uin);
        LoginRecordManager.setRecent(uin);
      }
    });
}

/** 设置状态，修改在线状态 */
function setStatus() {
  const statuses = [...statusMap.values()];
  window
    .showQuickPick(statuses, {
      placeHolder: '当前状态：' + statusMap.get(Global.client.status)
    })
    .then((statusItem) => {
      if (!statusItem) {
        return;
      }
      Global.client.setOnlineStatus(
        [...statusMap.keys()][statuses.indexOf(statusItem)]
      );
    });
}

/** 设置个人资料，暂时只支持昵称、性别的修改 */
function setProfile() {
  const profiles: QuickPickItem[] = [
    // {
    //   label: '头像'
    // },
    {
      label: '昵称',
      description: Global.client.nickname
    },
    // {
    //   label: '个性签名'
    // },
    {
      label: '性别',
      description: genderMap.get(Global.client.sex)
    }
    // {
    //   label: '年龄',
    //   description: Global.client.age.toString()
    // }
    // {
    //   label: '所在地'
    // },
  ];
  window
    .showQuickPick(profiles, { placeHolder: '我的资料' })
    .then((profile) => {
      if (!profile) {
        return;
      }
      if (profile === profiles[0]) {
        // 修改昵称
        window
          .showInputBox({
            title: '修改昵称',
            placeHolder: Global.client.nickname
          })
          .then((nickname) => {
            if (!nickname) {
              return;
            }
            Global.client
              .setNickname(nickname)
              .then((ret) =>
                ret
                  ? window.showInformationMessage('昵称修改成功：' + nickname)
                  : window.showErrorMessage('昵称修改失败')
              );
          });
      } else if (profile === profiles[1]) {
        // 修改性别
        window
          .showQuickPick([...genderMap.values()], {
            title: '修改性别',
            placeHolder: genderMap.get(Global.client.sex)
          })
          .then((gender) => {
            if (!gender) {
              return;
            }
            Global.client
              .setGender(gender === '男' ? 1 : gender === '女' ? 2 : 0)
              .then((ret) =>
                ret
                  ? window.showInformationMessage('性别修改成功：' + gender)
                  : window.showErrorMessage('性别修改失败')
              );
          });
      }
    });
}

/**
 * 设置，响应`setting`指令
 */
export default function setting() {
  /** 设置选项 */
  const settings: QuickPickItem[] = [
    {
      label: '$(account) 账号管理',
      description: Global.client.nickname
    },
    {
      label: '$(bell) 我的状态',
      description: statusMap.get(Global.client.status)
    },
    {
      label: '$(pencil) 编辑资料'
    }
  ];
  window
    .showQuickPick(settings, { placeHolder: '设置' })
    .then(async (settingItem) => {
      if (settingItem === settings[0]) {
        setAccounts();
      } else if (settingItem === settings[1]) {
        setStatus();
      } else if (settingItem === settings[2]) {
        setProfile();
      }
    });
}
