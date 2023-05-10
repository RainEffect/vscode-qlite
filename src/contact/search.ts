import * as vscode from 'vscode';
import Global from '../global';
import { ChatType } from '../types/chat';

/** 搜索条目 */
interface SearchItem extends vscode.QuickPickItem {
  type: ChatType;
}

/**
 * 搜索栏
 * @todo 将好友和群聊以separater分隔
 */
export default function search() {
  if (!Global.client.isOnline()) {
    return;
  }
  const searchList: SearchItem[] = [];
  const searchMenu = ['$(person) 搜索好友', '$(organization) 搜索群聊'];
  vscode.window.showQuickPick(searchMenu).then((value) => {
    if (!value) {
      return;
    } else if (value === searchMenu[0]) {
      for (let friend of Global.client.fl.values()) {
        let fItem: SearchItem = {
          label: friend.remark ? friend.remark : friend.nickname,
          type: ChatType.Friend
        };
        fItem.alwaysShow = false;
        fItem.description = String(friend.user_id);
        searchList.push(fItem);
      }
    } else {
      for (let group of Global.client.gl.values()) {
        let gItem: SearchItem = {
          label: group.group_name,
          type: ChatType.Group
        };
        gItem.alwaysShow = false;
        gItem.description = String(group.group_id);
        searchList.push(gItem);
      }
    }
    vscode.window
      .showQuickPick(searchList, {
        matchOnDescription: true,
        placeHolder: value.split(' ')[1]
      })
      .then((value) => {
        if (value) {
          vscode.commands.executeCommand(
            'qlite.chat',
            Number(value.description),
            value.type
          );
        }
      });
  });
}
