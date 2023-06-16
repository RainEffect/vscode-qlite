import { OnlineStatus } from 'icqq';
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
    }
  ];
  window.showQuickPick(settings).then(async (settingItem) => {
    switch (settingItem) {
      case settings[0]: {
        const accounts: QuickPickItem[] = [];
        const recordMap = await LoginRecordManager.getLoginRecord();
        recordMap.forEach((nickname: string, uin: number) => {
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
          .then((accountItem) => {
            if (!accountItem) {
              return;
            }
            Global.client.logout();
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
        break;
      }
      case settings[1]: {
        const statusArray = [...statusMap.values()];
        window
          .showQuickPick([...statusMap.values()], {
            placeHolder: '当前状态：' + statusMap.get(Global.client.status)
          })
          .then((statusItem) => {
            if (statusItem === undefined) {
              return;
            }
            Global.client.setOnlineStatus(
              [...statusMap.keys()][statusArray.indexOf(statusItem)]
            );
          });
        break;
      }
    }
  });
}
