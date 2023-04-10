import * as icqq from "icqq";

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
    on(type: "message", listener: (event: CustomEvent<icqq.PrivateMessageEvent | icqq.GroupMessageEvent | icqq.PrivateMessage>) => void): void;
    // 监听新系统通知事件
    on(type: "notice", listener: (event: CustomEvent<icqq.FriendNoticeEvent | icqq.GroupNoticeEvent>) => void): void;

    scrollHome(): void;
    scrollEnd(): void;
    timestamp(unixtime?: number): string;
    datetime(unixtime?: number): string;
    getUserAvatarUrlSmall(uin: number): string;
    getUserAvatarUrlLarge(uin: number): string;
    getGroupAvatarUrlSmall(uin: number): string;
    getGroupAvatarUrlLarge(uin: number): string;

    callApi(command: keyof icqq.Friend | keyof icqq.Group, params?: any[]): Promise<unknown>;
    // Client Api
    getRoamingStamp: icqq.Client["getRoamingStamp"];
    deleteStamp: icqq.Client["deleteStamp"];
    // Contactable Api
    uploadImages: icqq.Friend["uploadImages"] | icqq.Group["uploadImages"];
    uploadVideo: icqq.Friend["uploadVideo"] | icqq.Group["uploadVideo"];
    uploadPtt: icqq.Friend["uploadPtt"] | icqq.Group["uploadPtt"];
    makeForwardMsg: icqq.Friend["makeForwardMsg"] | icqq.Group["makeForwardMsg"];
    getForwardMsg: icqq.Friend["getForwardMsg"] | icqq.Group["getForwardMsg"];
    getVideoUrl: icqq.Friend["getVideoUrl"] | icqq.Group["getVideoUrl"];
    // Friend Api: 为群聊消息时不实现
    getSimpleInfo: icqq.Friend["getSimpleInfo"];
    setFriendReq: icqq.Friend["setFriendReq"];
    setGroupReq: icqq.Friend["setGroupReq"];
    setGroupInvite: icqq.Friend["setGroupInvite"];
    setRemark: icqq.Friend["setRemark"];
    setClass: icqq.Friend["setClass"];
    poke: icqq.Friend["poke"];
    delete: icqq.Friend["delete"];
    sendFile: icqq.Friend["sendFile"];
    forwardFile: icqq.Friend["forwardFile"];
    recallFile: icqq.Friend["recallFile"];
    // Group Api: 为私聊消息时不实现
    setName: icqq.Group["setName"];
    setAvatar: icqq.Group["setAvatar"];
    muteAll: icqq.Group["muteAll"];
    muteMember: icqq.Group["muteMember"];
    muteAnony: icqq.Group["muteAnony"];
    kickMember: icqq.Group["kickMember"];
    pokeMember: icqq.Group["pokeMember"];
    setCard: icqq.Group["setCard"];
    setAdmin: icqq.Group["setAdmin"];
    setTitle: icqq.Group["setTitle"];
    invite: icqq.Group["invite"];
    quit: icqq.Group["quit"];
    getAnonyInfo: icqq.Group["getAnonyInfo"];
    allowAnony: icqq.Group["allowAnony"];
    getMemberMap: icqq.Group["getMemberMap"];
    getAtAllRemainder: icqq.Group["getAtAllRemainder"];
    renew: icqq.Group["renew"];
    // User or Group Api
    sendMsg: icqq.User["sendMsg"] | icqq.Group["sendMsg"];
    recallMsg: icqq.User["recallMsg"] | icqq.Group["recallMsg"];
    getChatHistory: icqq.User["getChatHistory"] | icqq.Group["getChatHistory"];
    markRead: icqq.User["markRead"] | icqq.Group["markRead"];
    getFileUrl: icqq.User["getFileUrl"] | icqq.Group["getFileUrl"];
    getAvatarUrl: icqq.User["getAvatarUrl"] | icqq.Group["getAvatarUrl"];
}
