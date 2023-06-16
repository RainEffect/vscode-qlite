import { QuickPickItem, commands, window } from 'vscode';
import Global from '../global';
import { ChatType } from '../message/parse-msg-id';

/** 搜索条目 */
interface SearchItem extends QuickPickItem {
  type: ChatType;
}

/**
 * 搜索栏
 * @todo 将好友和群聊以`separater`分隔
 */
export default function search() {
  if (!Global.client.isOnline()) {
    return;
  }
  const searchList: SearchItem[] = [];
  const searchMenu = ['$(person) 搜索好友', '$(organization) 搜索群聊'];
  window.showQuickPick(searchMenu).then((value) => {
    if (!value) {
      return;
    } else if (value === searchMenu[0]) {
      for (const friend of Global.client.fl.values()) {
        const fItem: SearchItem = {
          label: friend.remark ? friend.remark : friend.nickname,
          type: ChatType.Friend
        };
        fItem.alwaysShow = false;
        fItem.description = String(friend.user_id);
        searchList.push(fItem);
      }
    } else {
      for (const group of Global.client.gl.values()) {
        const gItem: SearchItem = {
          label: group.group_name,
          type: ChatType.Group
        };
        gItem.alwaysShow = false;
        gItem.description = String(group.group_id);
        searchList.push(gItem);
      }
    }
    window
      .showQuickPick(searchList, {
        matchOnDescription: true,
        placeHolder: value.split(' ')[1]
      })
      .then((value) => {
        if (value) {
          commands.executeCommand(
            'qlite.chat',
            Number(value.description),
            value.type
          );
        }
      });
  });
}
