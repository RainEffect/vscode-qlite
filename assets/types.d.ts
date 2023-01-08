import * as oicq from "oicq";

/**
 * webview类型参考
 */
export interface Webview extends EventTarget {
    readonly self_uin: number; // 自己账号
    readonly nickname: string; // 自己昵称
    readonly c2c: boolean; // 私聊为true，群聊为false
    readonly target_uin: number; // 私聊时为对方账号，群聊时为群号
    readonly assets_path: string; // assets文件夹路径("/"结尾)
    readonly faces_path: string; // 表情文件夹路径("/"结尾)
    readonly t: number; // vsc启动时间戳，用于解决头像缓存问题
    readonly TimeoutError: typeof Error;

    // 监听新消息事件
    on(type: "message", listener: (event: CustomEvent<oicq.PrivateMessageEvent | oicq.GroupMessageEvent | oicq.PrivateMessage>) => void): void;
    // 监听新系统通知事件
    on(type: "notice", listener: (event: CustomEvent<oicq.FriendNoticeEvent | oicq.GroupNoticeEvent>) => void): void;

    scrollHome(): void;
    scrollEnd(): void;
    timestamp(unixtime?: number): string;
    datetime(unixtime?: number): string;
    getUserAvatarUrlSmall(uin: number): string;
    getUserAvatarUrlLarge(uin: number): string;
    getGroupAvatarUrlSmall(uin: number): string;
    getGroupAvatarUrlLarge(uin: number): string;

    callApi(command: keyof oicq.Friend | keyof oicq.Group, params?: any[]): Promise<unknown>;
    // Client Api
    getRoamingStamp: oicq.Client["getRoamingStamp"];
    deleteStamp: oicq.Client["deleteStamp"];
    // Contactable Api
    uploadImages: oicq.Friend["uploadImages"] | oicq.Group["uploadImages"];
    uploadVideo: oicq.Friend["uploadVideo"] | oicq.Group["uploadVideo"];
    uploadPtt: oicq.Friend["uploadPtt"] | oicq.Group["uploadPtt"];
    makeForwardMsg: oicq.Friend["makeForwardMsg"] | oicq.Group["makeForwardMsg"];
    getForwardMsg: oicq.Friend["getForwardMsg"] | oicq.Group["getForwardMsg"];
    getVideoUrl: oicq.Friend["getVideoUrl"] | oicq.Group["getVideoUrl"];
    // Friend Api: 为群聊消息时不实现
    getSimpleInfo: oicq.Friend["getSimpleInfo"];
    setFriendReq: oicq.Friend["setFriendReq"];
    setGroupReq: oicq.Friend["setGroupReq"];
    setGroupInvite: oicq.Friend["setGroupInvite"];
    setRemark: oicq.Friend["setRemark"];
    setClass: oicq.Friend["setClass"];
    poke: oicq.Friend["poke"];
    delete: oicq.Friend["delete"];
    sendFile: oicq.Friend["sendFile"];
    forwardFile: oicq.Friend["forwardFile"];
    recallFile: oicq.Friend["recallFile"];
    // Group Api: 为私聊消息时不实现
    setName: oicq.Group["setName"];
    setAvatar: oicq.Group["setAvatar"];
    muteAll: oicq.Group["muteAll"];
    muteMember: oicq.Group["muteMember"];
    muteAnony: oicq.Group["muteAnony"];
    kickMember: oicq.Group["kickMember"];
    pokeMember: oicq.Group["pokeMember"];
    setCard: oicq.Group["setCard"];
    setAdmin: oicq.Group["setAdmin"];
    setTitle: oicq.Group["setTitle"];
    invite: oicq.Group["invite"];
    quit: oicq.Group["quit"];
    getAnonyInfo: oicq.Group["getAnonyInfo"];
    allowAnony: oicq.Group["allowAnony"];
    getMemberMap: oicq.Group["getMemberMap"];
    getAtAllRemainder: oicq.Group["getAtAllRemainder"];
    renew: oicq.Group["renew"];
    // User or Group Api
    sendMsg: oicq.User["sendMsg"] | oicq.Group["sendMsg"];
    recallMsg: oicq.User["recallMsg"] | oicq.Group["recallMsg"];
    getChatHistory: oicq.User["getChatHistory"] | oicq.Group["getChatHistory"];
    markRead: oicq.User["markRead"] | oicq.Group["markRead"];
    getFileUrl: oicq.User["getFileUrl"] | oicq.Group["getFileUrl"];
    getAvatarUrl: oicq.User["getAvatarUrl"] | oicq.Group["getAvatarUrl"];
}
