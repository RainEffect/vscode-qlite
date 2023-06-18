import { Badge } from '@vscode/webview-ui-toolkit';
import {
  FriendPokeEvent,
  FriendRecallEvent,
  GroupAdminEvent,
  GroupMuteEvent,
  GroupPokeEvent,
  GroupRecallEvent,
  GroupTransferEvent,
  MemberDecreaseEvent,
  MemberIncreaseEvent
} from 'icqq';
import { GroupSignEvent } from 'icqq/lib/events';

/**
 * 生成通知消息
 * @todo 待完善
 * @param notice 群聊or私聊通知
 * @returns 消息实例
 */

export default function createNoticeMsg(
  notice:
    | FriendRecallEvent
    | FriendPokeEvent
    | MemberIncreaseEvent
    | GroupSignEvent
    | MemberDecreaseEvent
    | GroupRecallEvent
    | GroupAdminEvent
    | GroupMuteEvent
    | GroupTransferEvent
    | GroupPokeEvent
) {
  const tip = document.createElement('vscode-badge') as Badge;
  tip.className = 'tip';
  if (notice.notice_type === 'friend') {
    // 好友通知
    tip.textContent =
      notice.sub_type === 'recall'
        ? // 撤回消息
          `对方撤回了一条消息`
        : // 戳一戳
          `对方${notice.action}你`;
  } else {
    // 群聊通知
    tip.textContent;
  }
  return tip;
}
