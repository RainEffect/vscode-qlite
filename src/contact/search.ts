import { QuickPickItem, QuickPickItemKind, commands, window } from 'vscode';
import Global from '../global';
import { ChatType } from '../message/parse-msg-id';

/** 搜索栏 */
export default function search() {
  const searchList: QuickPickItem[] = [];
  for (const friend of Global.client.fl.values()) {
    const fItem: QuickPickItem = {
      label: '$(person) ' + (friend.remark ? friend.remark : friend.nickname),
      alwaysShow: false,
      description: friend.user_id.toString()
    };
    searchList.push(fItem);
  }
  const seperator: QuickPickItem = {
    label: '',
    kind: QuickPickItemKind.Separator
  };
  searchList.push(seperator);
  for (const group of Global.client.gl.values()) {
    const gItem: QuickPickItem = {
      label: '$(organization) ' + group.group_name,
      alwaysShow: false,
      description: group.group_id.toString()
    };
    searchList.push(gItem);
  }
  window
    .showQuickPick(searchList, {
      placeHolder: '搜索好友/群聊',
      matchOnDescription: true
    })
    .then((item) => {
      if (!item) {
        return;
      }
      commands.executeCommand(
        'qlite.chat',
        Number(item.description),
        item.label.split(' ')[0].includes('person')
          ? ChatType.Friend
          : ChatType.Group
      );
    });
}
