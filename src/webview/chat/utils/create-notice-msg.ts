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
import { messenger } from '../script';
import * as chat from '../../../message/chat';

/**
 * 撤回消息
 * @param msgid 消息id
 */
export function recallMsg(msgid: string) {
  const messageElems = document.querySelectorAll('.msg');
  messageElems.forEach((messageElem) => {
    if (msgid === messageElem.getAttribute('msgid')) {
      messageElem.remove();
      return;
    }
  });
}

/**
 * 生成通知消息
 * @todo 实现了，但没完全实现，通知词条待打磨
 * @param notice 群聊or私聊通知
 * @returns 消息实例
 */
export default async function createNoticeMsg(
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
    if (notice.sub_type === 'poke') {
      // 戳一戳
      tip.textContent = `对方${notice.action}你`;
    } else if (notice.sub_type === 'recall') {
      // 撤回消息
      recallMsg(notice.message_id);
      tip.textContent = `对方撤回了一条消息`;
    }
  } else {
    const { members } = await messenger.sendRequest(chat.getMember, {
      type: 'extension'
    });
    // 群聊通知
    if (notice.sub_type === 'poke') {
      // 戳一戳
      let operatorName = '',
        targetName = '';
      members.forEach((member) => {
        if (member.user_id === notice.operator_id) {
          operatorName = member.card ? member.card : member.nickname;
        } else if (member.user_id === notice.target_id) {
          targetName = member.card ? member.card : member.nickname;
        }
        if (operatorName.length && targetName.length) {
          return;
        }
      });
      tip.textContent = `${operatorName}${notice.action}${targetName}`;
    } else if (notice.sub_type === 'recall') {
      // 撤回消息
      let operatorName = '';
      members.forEach((member) => {
        if (member.user_id === notice.operator_id) {
          operatorName = member.card ? member.card : member.nickname;
          return;
        }
      });
      recallMsg(notice.message_id);
      tip.textContent = `${operatorName}撤回了一条消息`;
    } else if (notice.sub_type === 'sign') {
      // 打卡
      tip.textContent = `${notice.nickname}${notice.sign_text}`;
    } else if (notice.sub_type === 'admin') {
      // 管理员变更
      let targetName = '';
      members.forEach((member) => {
        if (member.user_id === notice.user_id) {
          targetName = member.card ? member.card : member.nickname;
          return;
        }
      });
      tip.textContent = `${targetName}被${notice.set ? '设为' : '移除'}管理员`;
    } else if (notice.sub_type === 'transfer') {
      // 群转让
      let operatorName = '',
        targetName = '';
      members.forEach((member) => {
        if (member.user_id === notice.operator_id) {
          operatorName = member.card ? member.card : member.nickname;
        } else if (member.user_id === notice.user_id) {
          targetName = member.card ? member.card : member.nickname;
        }
        if (operatorName.length && targetName.length) {
          return;
        }
      });
      tip.textContent = `${operatorName}将本群转让给${targetName}`;
    } else if (notice.sub_type === 'ban') {
      // 群禁言
      let operatorName = '',
        targetName = '';
      members.forEach((member) => {
        if (member.user_id === notice.operator_id) {
          operatorName = member.card ? member.card : member.nickname;
        } else if (member.user_id === notice.user_id) {
          targetName = member.card ? member.card : member.nickname;
        }
        if (operatorName.length && targetName.length) {
          return;
        }
      });
      tip.textContent = `${targetName}被${operatorName}禁言${notice.duration}s`;
    } else if (notice.sub_type === 'increase') {
      tip.textContent = `${notice.nickname}加入本群`;
    } else if (notice.sub_type === 'decrease') {
      let operatorName = '',
        targetName = '';
      members.forEach((member) => {
        if (member.user_id === notice.operator_id) {
          operatorName = member.card ? member.card : member.nickname;
        } else if (member.user_id === notice.user_id) {
          targetName = member.card ? member.card : member.nickname;
        }
        if (operatorName.length && targetName.length) {
          return;
        }
      });
      tip.textContent = notice.dismiss
        ? // 群解散
          '群主已解散本群'
        : notice.operator_id === notice.user_id
        ? // 群员主动退出
          `${operatorName}退出本群`
        : // 被管理/群主踢出
          `${operatorName}将${targetName}移出本群`;
    }
  }
  return tip;
}
