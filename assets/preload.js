/**
 * 该文件在页面生成时自动加载
 */
; (() => {
    /**
     * @type {import("./types").Webview}
     */
    const vsc = new window.EventTarget;

    vsc.on = vsc.addEventListener;
    vsc.TimeoutError = class TimeoutError extends Error { };

    /**
     * @type {Map<string, Function>}
     */
    const handlers = new Map;

    /**
     * @type {Function}
     */
    const vscode = acquireVsCodeApi();

    const env = window.document.querySelector("env");
    vsc.self_uin = Number(env.attributes.self_id?.value);
    vsc.nickname = String(env.attributes.nickname?.value);
    vsc.c2c = env.attributes.c2c?.value === "1";
    vsc.target_uin = Number(env.attributes.target_id?.value);
    vsc.assets_path = env.attributes.path?.value + "/";
    vsc.faces_path = vsc.assets_path + "faces/";
    vsc.t = Number(env.attributes.t?.value);

    /**
     * @param {{echo: string, data: any}} data
     */
    function onHostMessage(data) {
        if (!data.echo) {
            if (Array.isArray(data.data)) {
                for (let i of data.data) {
                    if (i.post_type === "message" || (i.post_type === "sync" && i.sync_type === "message")) {
                        vsc.dispatchEvent(new window.CustomEvent("message", { detail: i }));
                    } else if (i.post_type === "notice") {
                        vsc.dispatchEvent(new window.CustomEvent("notice", { detail: i }));
                    }
                }
            } else {
                if (data.data.post_type === "message" || (data.data.post_type === "sync" && data.data.sync_type === "message")) {
                    vsc.dispatchEvent(new window.CustomEvent("message", { detail: data.data }));
                } else if (data.data.post_type === "notice") {
                    vsc.dispatchEvent(new window.CustomEvent("notice", { detail: data.data }));
                }
            }
        } else {
            handlers.get(data.echo)?.call(null, data.data);
            handlers.delete(data.echo);
        }
    }
    window.addEventListener("message", function (event) {
        onHostMessage(event.data);
    });

    vsc.callApi = (command, params = []) => {
        const echo = String(Date.now()) + String(Math.random());
        /**
         * @type {import("../src/chat").WebviewPostData}
         */
        const obj = {
            command, params, echo
        };
        return new Promise((resolve, reject) => {
            vscode.postMessage(obj);
            const id = setTimeout(() => {
                reject(new vsc.TimeoutError);
                handlers.delete(echo);
            }, 5500);
            handlers.set(echo, (data) => {
                clearTimeout(id);
                resolve(data);
            });
        });
    };

    /**
     * @type {{
     *     both: Array<keyof import("oicq").Friend> | Array<keyof import("oicq").Group;
     *     friend: Array<keyof import("oicq").Friend>;
     *     group: Array<keyof import("oicq").Group>
     * }}
     */
    const available_apis = {
        both: [
            "uploadImages", "uploadVideo", "uploadPtt", "makeForwardMsg", "getForwardMsg", "getVideoUrl",
            "sendMsg", "recallMsg", "getChatHistory", "markRead", "getFileUrl", "getAvatarUrl"
        ],
        friend: [
            "getSimpleInfo", "setFriendReq", "setGroupReq", "setGroupInvite", "setRemark", "setClass",
            "poke", "delete", "sendFile", "forwardFile", "recallFile"
        ],
        group: [
            "setName", "setAvatar", "muteAll", "muteMember", "muteAnony",
            "kickMember", "pokeMember", "setCard", "setAdmin", "setTitle", "invite", "quit",
            "getAnonyInfo", "allowAnony", "getMemberMap", "getAtAllRemainder", "renew"
        ]
    };
    for (let name of available_apis.both) {
        vsc[name] = (...args) => vsc.callApi(name, args);
    }
    for (let name of vsc.c2c ? available_apis.friend : available_apis.group) {
        vsc[name] = (...args) => vsc.callApi(name, args);
    }

    vsc.scrollHome = () => window.scroll(0, 0);
    vsc.scrollEnd = () => window.scroll(0, window.document.body.scrollHeight);
    vsc.getUserAvaterUrlSmall = (uin) => `https://q1.qlogo.cn/g?b=qq&s=100&nk=${uin}&t=` + vsc.t;
    vsc.getUserAvaterUrlLarge = (uin) => `https://q1.qlogo.cn/g?b=qq&s=640&nk=${uin}&t=` + vsc.t;
    vsc.getGroupAvaterUrlSmall = (uin) => `https://p.qlogo.cn/gh/${uin}/${uin}/100?t=` + vsc.t;
    vsc.getGroupAvaterUrlLarge = (uin) => `https://p.qlogo.cn/gh/${uin}/${uin}/640?t=` + vsc.t;
    vsc.timestamp = (unixstamp) => {
        const date = new Date(unixstamp ? unixstamp * 1000 : Date.now());
        return date.getHours()
            + ":"
            + String(date.getMinutes()).padStart(2, "0")
            + ":"
            + String(date.getSeconds()).padStart(2, "0");
    };
    vsc.datetime = (unixstamp) => {
        const date = new Date(unixstamp ? unixstamp * 1000 : Date.now());
        return date.getFullYear()
            + "/"
            + String(date.getMonth() + 1).padStart(2, "0")
            + "/"
            + String(date.getDate()).padStart(2, "0")
            + " "
            + vsc.timestamp(unixstamp);
    };

    window.webview = vsc;

})(window);
