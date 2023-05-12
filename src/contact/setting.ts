import * as vscode from 'vscode';
import { OnlineStatus } from 'icqq';
import Global from '../global';
import LoginRecordManager from '../login-record';

/** 当前状态 */
let onlineStatus: number = 11;
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
 * 设置，响应setting指令
 */
export default function setting() {
  /** 设置选项 */
  const settings: vscode.QuickPickItem[] = [
    {
      label: '$(account) 账号管理',
      description: Global.client.nickname
    },
    {
      label: '$(bell) 我的状态',
      description: statusMap.get(onlineStatus)
    }
  ];
  vscode.window.showQuickPick(settings).then(async (settingItem) => {
    switch (settingItem) {
      case settings[0]:
        const accounts: vscode.QuickPickItem[] = [];
        const recordMap = await LoginRecordManager.getAll();
        recordMap.forEach((nickname: string, uin: number) => {
          accounts.push({
            label: '$(account) ' + nickname,
            description: uin.toString()
          });
        });
        accounts.push(
          { label: '', kind: vscode.QuickPickItemKind.Separator },
          { label: '$(log-out) 退出' }
        );
        vscode.window
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
              vscode.commands.executeCommand(
                'setContext',
                'qlite.isOnline',
                false
              );
            } else {
              // 切换账号
              const uin = Number(accountItem.description);
              Global.client.login(uin);
              LoginRecordManager.setRecent(uin);
            }
          });
        break;
      case settings[1]:
        const statusArray = [...statusMap.values()];
        vscode.window
          .showQuickPick([...statusMap.values()], {
            placeHolder: '当前状态：' + statusMap.get(Global.client.status)
          })
          .then((statusItem) => {
            if (statusItem === undefined) {
              return;
            }
            onlineStatus = [...statusMap.keys()][
              statusArray.indexOf(statusItem)
            ];
            if (Global.client.isOnline()) {
              Global.client.setOnlineStatus(onlineStatus);
            }
          });
        break;
    }
  });
}
