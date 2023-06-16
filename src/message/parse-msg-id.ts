/** 聊天类型 */
export enum ChatType {
  /** 群聊 */
  Group,
  /** 私聊 */
  Friend
}

/** 调用 {@link parseMsgId} 解析私聊`msgid`的字段接口 */
export interface FriendId {
  uid: number;
  seq: number;
  rand: number;
  time: number;
  flag: number;
}

/** 调用 {@link parseMsgId} 解析群聊`msgid`的字段接口 */
export interface GroupId {
  gid: number;
  uid: number;
  seq: number;
  rand: number;
  time: number;
  pktnum: number;
}

/**
 * 解析私聊`msgid`
 * @param id 需要解析的字符串
 * @returns 解析后的id数据
 */
export function parseMsgId(type: ChatType.Friend, id: string): FriendId;
/**
 * 解析群聊`msgid`
 * @param id 需要解析的字符串
 * @returns 解析后的id数据
 */
export function parseMsgId(type: ChatType.Group, id: string): GroupId;
export function parseMsgId(type: ChatType, id: string) {
  const parsed = Buffer.from(id, 'base64');
  return type === ChatType.Friend
    ? ({
        uid: parsed.readUInt32BE(0),
        seq: parsed.readUint32BE(4),
        rand: parsed.readUInt32BE(8),
        time: parsed.readUInt32BE(12),
        flag: parsed.readUInt8(16)
      } as FriendId)
    : ({
        gid: parsed.readUInt32BE(0),
        uid: parsed.readUInt32BE(4),
        seq: parsed.readUInt32BE(8),
        rand: parsed.readUInt32BE(12),
        time: parsed.readUInt32BE(16),
        pktnum: parsed.readUInt8(20)
      } as GroupId);
}
