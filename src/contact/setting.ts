import * as vscode from 'vscode';
import Global from '../global';
import LoginRecordManager from '../login-record';

/** 当前状态 */
export let selectedStatus: number = 11;
/** 状态选项 */
export const statusMap: Map<number, string> = new Map([
  [11, '在线'],
  [60, 'Q我吧'],
  [31, '离开'],
  [50, '忙碌'],
  [70, '请勿打扰'],
  [41, '隐身']
]);

/**
 * 设置，响应setting指令
 */
export function setting() {
  /** 设置选项 */
  const settings: vscode.QuickPickItem[] = [
    {
      label: '$(account) 账号管理',
      description: `${Global.client.nickname}(${Global.client.uin})`
    },
    {
      label: '$(bell) 我的状态',
      description: statusMap.get(selectedStatus)
    }
  ];
  vscode.window.showQuickPick(settings).then((value) => {
    switch (value) {
      case settings[0]:
        const accounts: vscode.QuickPickItem[] = [];
        LoginRecordManager.getAll().forEach((nickname: string, uin: number) => {
          accounts.push({ label: `$(account)${nickname}(${uin})` });
        });
        accounts.push({ label: '$(log-out) 退出' });
        vscode.window.showQuickPick(accounts).then((account) => {
          if (!account) {
            return;
          }
          Global.client.logout();
          if (account === accounts[accounts.length - 1]) {
            // 退出
            Global.loginViewProvider.setEmptyView(true);
            vscode.commands.executeCommand(
              'setContext',
              'qlite.isOnline',
              false
            );
          } else {
            // 切换账号
            const uin = Number(account.label.substring(11));
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
          .then((value) => {
            if (value === undefined) {
              return;
            }
            selectedStatus = [...statusMap.keys()][statusArray.indexOf(value)];
            if (Global.client.isOnline()) {
              Global.client.setOnlineStatus(selectedStatus);
            }
          });
        break;
    }
  });
}
