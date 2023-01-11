/**
 * window.webview 是一个内置全局变量，封装了一些与宿主交互的方法
 * @type {import("./types").Webview}
 */
var webview;

/**
 * 群员列表
 * @type {Map<number, import("oicq").MemberInfo>}
 */
let members = new Map;

/**
 * 群资料
 * @type {import("oicq").GroupInfo}
 */
let ginfo;

/**
 * 私聊好友信息
 * @type {import("oicq").FriendInfo}
 */
let friend;

// 监听消息和通知
webview.on("message", (event) => {
    appendMsg(genUserMessage(event.detail));
});
webview.on("notice", (event) => {
    appendMsg(genSystemMessage(event.detail));
});

/**
 * 将html格式的新消息字符串添加到聊天窗口末尾
 * @param {string} msg html格式的新消息
 */
function appendMsg(msg) {
    const chatbox = document.querySelector(".lite-chatbox");
    chatbox.insertAdjacentHTML("beforeend", msg);
    if (chatbox.scrollHeight - chatbox.scrollTop < chatbox.clientHeight * 1.5) { // 浏览历史记录时收到新消息不滑动窗口
        chatbox.scroll(0, chatbox.scrollHeight);
    }
}

/**
 * 更新群友信息
 */
function updateMemberList() {
    webview.renew().then((value) => { ginfo = value; });
    webview.getMemberMap().then((value) => {
        members = new Map;
        let owner_html = "";
        const element = document.querySelector(".group-members");
        element.innerHTML = "";
        for (let memberInfo of value.values()) {
            members.set(memberInfo.user_id, memberInfo);
            const role = memberInfo.role === "owner" ? "🟡" : (memberInfo.role === "admin" ? "🟢" : "");
            const html = `<p title="${filterXss(memberInfo.nickname)}(${memberInfo.user_id})" class="group-member" uid="${memberInfo.user_id}">
                ${role + filterXss(memberInfo.card || memberInfo.nickname)}
            </p>`;
            if (memberInfo.role === "owner") {
                owner_html = html;
                continue;
            }
            element.insertAdjacentHTML(memberInfo.role === "member" ? "beforeend" : "afterbegin", html);
        }
        element.insertAdjacentHTML("afterbegin", owner_html);
    });
}

/**
 * 获取好友信息
 */
function updateFriendInfo() {
    webview.getSimpleInfo().then((value) => {
        friend = value;
    });
}

/**
 * 获取历史聊天记录
 * @param {number | undefined} param 群聊为序号，默认从最后一条发言往前；私聊为时间，默认从当前时间往前
 * @param {number} count 获取的条数
 */
function getChatHistory(param, count = 20) {
    webview.getChatHistory(param, count).then((msgList) => {
        let html = "";
        let msgMark = [];
        msgList.forEach((msg) => {
            // 私聊以time为标识，群聊以seq为标识
            const mark = webview.c2c ? msg.time : msg.seq;
            if (!msgMark.includes(mark)) {
                msgMark.push(mark);
                html += genUserMessage(msg);
            }
        });
        if (!html) {
            return;
        }
        const chatbox = document.querySelector(".lite-chatbox");
        chatbox.insertAdjacentHTML("afterbegin", html);
        if (param) { // 上划获取历史记录，窗口停留在加载消息处
            window.location.hash = "#" + msgList[msgList.length - 1].seq;
        } else { // 初次加载历史记录，窗口滑动到底部
            chatbox.scroll(0, chatbox.scrollHeight);
        }
    });
}

// 发送状态
let sending = false;

/**
 * 发送消息
 */
function sendMsg() {
    /** @type {NodeListOf<ChildNode>} */
    const nodes = document.querySelector(".input-content").childNodes;
    if (sending || !nodes) { // 消息正在发送or输入框为空
        return;
    }
    sending = true;
    document.querySelector(".send").disabled = true; // 禁用发送按钮

    /** @type {(string | oicq.MessageElem)[]} */
    const messageList = [];
    nodes.forEach(value => {
        let segment;
        if (value.nodeName === "#text") { // 文字
            segment = value.textContent;
        } else if (value.nodeName === "IMG") { // 图片
            if (value.className === "face") { // qq表情
                segment = {
                    id: Number(value.id),
                    type: "face"
                };
            } else { // 图片
                const file = value.currentSrc.startsWith("https") ? value.currentSrc : value.currentSrc.split(";")[1].replace(",", "://");
                segment = {
                    file: file,
                    type: "image"
                };
            }
        } else if (value.nodeName === "A") { // at
            segment = {
                qq: value.title === "all" ? value.title : Number(value.title),
                type: "at"
            };
        } else { // 暂不支持的类型
            segment = "";
        }
        messageList.push(segment);
    });
    // 调用上层方法
    webview.sendMsg(messageList).then(value => {
        if (value.seq && webview.c2c) {
            const html = `<div class="cright cmsg", id="${value.seq}" time="${value.time}">
                <img class="headIcon radius" src="${webview.getUserAvatarUrlSmall(webview.self_uin)}" />
                <span class="name" title="${webview.nickname}(${webview.self_uin}) ${webview.datetime()}">
                    ${webview.timestamp()}
                </span>
                <span class="content">${document.querySelector(".input-content").innerHTML}</span>
            </div>`;
            document.querySelector(".lite-chatbox").insertAdjacentHTML("beforeend", html);
        }
    }).finally(() => {
        sending = false;
        document.querySelector(".send").disabled = false;
        document.querySelector(".input-content").textContent = "";
        document.querySelector(".lite-chatbox").scroll(0, document.querySelector(".lite-chatbox").scrollHeight);
    });
}

/**
 * 生成系统消息
 * @param {import("oicq").GroupNoticeEvent | import("oicq").FriendNoticeEvent} event 系统消息事件
 */
function genSystemMessage(event) {
    let msg = "";
    if (event.notice_type === "friend") { // 私聊通知
        switch (event.sub_type) {
            case "poke": // 戳一戳
                msg = `<span class="tips-info">${genLabel(event.operator_id)} ${event.action} ${webview.nickname} ${event.suffix}</span>`;
                break;
            case "recall": // 撤回（仅通知，消息不删除）
                msg = `<span class="tips-private">${genLabel(event.operator_id)} 撤回了 <a href="#${event.seq}" onclick="document.getElementById(${event.seq}).animate([{'background':'var(--vscode-sideBar-background)'}],{duration: 3000})">一条消息</a></span>`;
                break;
        }
    } else if (event.notice_type === "group") { // 群聊通知
        switch (event.sub_type) {
            case "recall": // 撤回（仅通知，消息不删除）
                msg = `<span class="tips-private">${genLabel(event.operator_id)} 撤回了 ${event.user_id === event.operator_id ? "自己" : genLabel(event.user_id)} 的<a href="#${event.seq}" onclick="document.getElementById(${event.seq}).animate([{'background':'var(--vscode-sideBar-background)'}],{duration: 3000})">一条消息</a></span>`;
                break;
            case "increase": // 群友加群
                updateMemberList();
                msg = `<span class="tips-success">${genLabel(event.user_id)} 加入了群聊</span>`;
                break;
            case "decrease": // 群友退群
                if (event.dismiss) { // 群解散
                    msg = `<span class="tips-danger">该群已被解散</span>`;
                    break;
                }
                if (event.operator_id === event.user_id) {
                    msg = `<span class="tips-warning">${genLabel(event.user_id)} 退出了群聊</span>`;
                } else {
                    msg = `<span class="tips-warning">${genLabel(event.operator_id)} 踢出了 ${genLabel(event.user_id)}</span>`;
                }
                updateMemberList();
                break;
            case "admin": // 管理员变更
                msg = `<span class="tips-info">${genLabel(event.user_id)} ${event.set ? "成为了" : "被取消了"}管理员</span>`;
                updateMemberList();
                break;
            case "transfer": // 群主转让
                msg = `<span class="tips-info">${genLabel(event.operator_id)} 将群主转让给了 ${genLabel(event.user_id)}</span>`;
                updateMemberList();
                break;
            case "ban": // 禁言
                if (event.user_id > 0) {
                    msg = `<span class="tips-danger">${genLabel(event.operator_id)} 禁言 ${event.user_id === 80000000 ? "匿名用户(" + event.nickname + ")" : genLabel(event.user_id)} ${~~(event.duration / 60)}分钟</span>`;
                } else {
                    msg = `<span class="tips-info">${genLabel(event.operator_id)} ${event.duration > 0 ? "开启" : "关闭"}了全员禁言</span>`;
                }
                updateMemberList();
                break;
            case "poke": // 戳一戳
                msg = `<span class="tips-info">${genLabel(event.operator_id)} ${event.action} ${genLabel(event.user_id)} ${event.suffix}</span>`;
                break;
        }
    }
    if (!msg) {
        return "";
    }
    return `<div class="tips" title="${webview.datetime(event.time)}">${msg}</div>`;
}

/**
 * 生成对象标签
 * @param {number} user_id 目标id
 * @returns {string} 对象的b元素昵称
 */
function genLabel(user_id) {
    if (webview.c2c) {
        return `<b title="${filterXss(friend.nickname)}">${filterXss(friend.nickname)}</b>`;
    } else {
        const member = members?.get(user_id);
        if (!member) {
            return user_id;
        }
        return `<b title="${filterXss(member.nickname)} (${user_id})">${filterXss(member.card ? member.card : member.nickname)}</b>`;
    }
}

/**
 * 生成一般消息
 * @param {import("oicq").PrivateMessage | import("oicq").GroupMessage} msg 私聊/群聊消息
 */
function genUserMessage(msg) {
    if (document.getElementById(msg.seq)) { // 重复消息
        return "";
    }
    let title = "", name = "";
    if (msg.sub_type === "anonymous") {
        title = `<span class="htitle member">匿名</span>`;
        name = msg.anonymous.name;
    } else {
        if (msg.sender.role === "owner") {
            title = `<span class="htitle owner">群主</span>`;
        } else if (msg.sender.role === "admin") {
            title = `<span class="htitle admin">管理员</span>`;
        }
        name = filterXss(msg.sender.card ? msg.sender.card : msg.sender.nickname);
    }
    return `<div class="${msg.sender.user_id === webview.self_uin ? "cright" : "cleft"} cmsg", id="${msg.seq}", time="${msg.time}">
        <img class="headIcon radius" src="${webview.getUserAvatarUrlSmall(msg.sender.user_id)}" />
        <span class="name" uid="${msg.sender.user_id}" ondblclick="addAt(${msg.sender.user_id})" title="${filterXss(msg.sender.nickname)}(${msg.sender.user_id}) ${webview.datetime(msg.time)}">
            ${webview.c2c ? "" : '<b class="operation">...</b>'}
            ${title} ${webview.c2c ? "" : name} ${webview.timestamp(msg.time)}
        </span>
        <span class="content">${parseMessage(msg.message)}</span>
    </div>`;
}


/**
 * xss过滤
 * @param {string} str 要处理的字符串
 * @returns {string} 过滤后的字符串
 */
function filterXss(str) {
    const xssMap = {
        "&": "&amp;",
        "\"": "&quot;",
        "<": "&lt;",
        ">": "&gt;",
        " ": "&nbsp;",
        "\t": "&emsp;",
    };
    str = str.replace(/[&"<>\t ]/g, (s) => {
        return xssMap[s];
    });
    str = str.replace(/\r\n/g, "<br>").replace(/\r/g, "<br>").replace(/\n/g, "<br>");
    return str;
}

/**
 * 生成消息字符串
 * @param {import("oicq").MessageElem[]} message 消息列表
 * @returns {string} 消息字符串
 */
function parseMessage(message) {
    let msg = "";
    for (let v of message) {
        switch (v.type) {
            case "text":
                msg += filterXss(v.text).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>');
                break;
            case "at":
                msg += `<a title="${v.qq}" href="javascript:void(0);" onclick="addAt('${v.qq}');">${filterXss(v.text)}</a>`;
                break;
            case "face":
                if (v.id > 324) {
                    msg += v.text || "[表情]";
                } else {
                    msg += `<img class="face" src="${webview.faces_path + v.id}.png" />`;
                }
                break;
            case "sface":
            case "bface":
                if (v.text) {
                    msg += "[" + filterXss(v.text) + "]";
                } else {
                    msg += "[表情]";
                }
                break;
            case "image":
            case "flash":
                if (!webview.c2c) {
                    v.url = v.url.replace(/\/[0-9]+\//, "/0/").replace(/[0-9]+-/g, "0-");
                }
                msg += `<img src="${v.url}" onload="drawImage(this)" ondblclick="enlargeImage(this)" />`;
                break;
            case "record":
                msg = `<a href="${v.url}" target="_blank">语音消息</a>`;
                break;
            case "video":
                msg = `<a href="${v.url}" target="_blank">视频消息</a>`;
                break;
            case "xml":
                const dom = new DOMParser().parseFromString(v.data, "text/xml");
                if (dom.querySelector("msg")?.getAttribute("serviceID") === "35") {
                    try {
                        const resid = /resid="[^"]+"/.exec(v.data)[0].replace("resid=\"", "").replace("\"", "");
                        msg = `<a href="javascript:void(0)" onclick="triggerForwardMsg(this)" id="${resid}">[合并转发]</a>
                        <span class="msg-forward"></span>`;
                    } catch {
                        msg = `<a href="javascript:void(0)" onclick="javascript:var s=this.nextElementSibling.style;if(s.display=='block')s.display='none';else s.display='block'">[嵌套转发]</a>
                        <span style="display:none">${filterXss(v.data)}</span>`;
                    }
                } else {
                    if (dom.querySelector("msg")?.getAttribute("action") === "web") { //判断是否为链接分享
                        const title = dom.querySelector("msg").getAttribute("brief");
                        const url = dom.querySelector("msg").getAttribute("url");
                        msg = `<a href="${filterXss(url)}">${filterXss(title)}</a><br>` + filterXss(dom.querySelector("summary")?.innerHTML);
                    } else {
                        msg = `<a href="javascript:void(0)" onclick="javascript:var s=this.nextElementSibling.style;if(s.display=='block')s.display='none';else s.display='block'">[XML卡片消息]</a>
                        <span style="display:none">${filterXss(v.data)}</span>`;
                    }
                }
                break;
            case "json":
                try {
                    const jsonObj = JSON.parse(v.data);
                    if (jsonObj["app"] === "com.tencent.mannounce") { //判断是否为群公告
                        const title = decodeURIComponent(Buffer.from(jsonObj["meta"]["mannounce"]["title"], "base64"));
                        const content = decodeURIComponent(Buffer.from(jsonObj["meta"]["mannounce"]["text"], "base64"));
                        msg = `<span class="jsonMsgTitle">${filterXss(title)}</span><br/><span class="jsonMsgContent">${filterXss(content)}</span><br/>`;
                    } else {
                        msg = `<a href="javascript:void(0)" onclick="javascript:var s=this.nextElementSibling.style;if(s.display=='block')s.display='none';else s.display='block'">[JSON卡片消息]</a>
                        <span style="display:none">${filterXss(JSON.stringify(jsonObj, null, 4))}</span>`;
                    }
                } catch { }
                break;
            case "file":
                msg = `<a href="${v.url}" target="_blank">文件: ${filterXss(v.name)} (${v.size / 1e6}MB)</a>`;
                break;
            case "rps":
                msg += "[猜拳]";
                break;
            case "dice":
                msg += "[骰子]";
                break;
            case "shake":
                msg = "[窗口抖动]";
                break;
            case "poke":
                msg = "[戳一戳]";
                break;
        }
    }
    return msg;
}

/* 添加特殊元素到输入框 */

/**
 * 加入at元素到输入框
 * @param {string} uid at对象的id或"all"
 */
function addAt(uid) {
    if (webview.c2c) { // 私聊无法at
        return;
    }
    let label = "";
    if (uid === "all") {
        label = "全体成员";
    } else {
        const member = members.get(Number(uid));
        label = member ? filterXss(member.card ? member.card : member.nickname) : uid;
    }
    document.querySelector(".input-content").insertAdjacentHTML("beforeend", `<a title="${uid}" href="javascript:void(0);" onclick="addAt('${uid}');">@${label}</a>`);
}

/**
 * 加入表情到输入框
 * @param {number} id 表情id
 * @param {string} src 表情url地址
 */
function addFace(id, src) {
    document.querySelector(".input-content").insertAdjacentHTML("beforeend", `<img class="face" src="${src}" id="${id}" />`);
}

/**
 * 加入图片到输入框
 * @param {string} url 图片url地址
 */
function addImage(url) {
    document.querySelector(".input-content").insertAdjacentHTML("beforeend", `<img src="${url}" onload="drawImage(this)" ondblclick="enlargeImage(this)" />`);
}

/**
 * 渲染缩略图
 * @param {Image} img 图片元素
 */
function drawImage(img) {
    const limit = 400; // 长宽上限
    if (img.width / img.height >= 1) { // 宽图宽度上限
        if (img.width > limit) {
            img.width = limit;
        }
    } else { // 长图高度上限
        if (img.height > limit) {
            img.height = limit;
        }
    }
}

/**
 * 点击图片放大
 * @param {Image} img 图片点击事件
 */
function enlargeImage(img) {
    const imgBox = document.querySelector(".img-focus");
    imgBox.innerHTML = `<img src="${img.src}" />`;
    imgBox.style.display = "flex";
}

/* 初始化页面 */

// 页面框架
document.querySelector("body").insertAdjacentHTML("beforeend",
    `<div class="content-left">
        <div class="lite-chatbox"></div>
        <div class="img-focus" onclick="this.style.display='none';"></div>
        <div class="menu-msg">
            <div class="menu-msg-at">@ TA</div>
            <div class="menu-msg-poke">戳一戳</div>
            <div class="menu-msg-recall">撤回消息</div>
            <div class="menu-msg-mute">禁言</div>
            <div class="menu-msg-kick">从本群中删除</div>
        </div>
        <div class="modal-dialog">
            <div class="modal-title"></div>
            <div class="modal-button">
                <button class="modal-confirm">确定</button>
                <button onclick="closeModalDialog()">取消</button>
            </div>
        </div>
        <div class="lite-chattools">
            <div style="display:none" class="stamp-box lite-chatbox-tool"></div>
            <div style="display:none" class="face-box lite-chatbox-tool"></div>
        </div>
        <div class="lite-chatinput">
            <hr class="boundary" />
            <button title="漫游表情" type="button" class="tool-button show-stamp-box">🧡</button>
            <button title="QQ表情" type="button" class="tool-button show-face-box">😀</button>
            <div class="input-content" contenteditable="true"></div>
            <button class="send" onclick="sendMsg()">Ctrl+Enter发送</button>
        </div>
    </div>
    <div class="content-right">
        <div class="group-info">
            <img class="headIcon radius" src="${webview.getGroupAvatarUrlSmall(webview.target_uin)}">
        </div>
        <div class="group-members"></div>
        <div class="menu-member">
            <div class="menu-member-at">@ TA</div>
            <div class="menu-member-poke">戳一戳</div>
            <div class="menu-member-admin1">设置为管理员</div>
            <div class="menu-member-admin0">取消管理员</div>
            <div class="menu-member-mute">禁言</div>
            <div class="menu-member-kick">从本群中删除</div>
        </div>
    </div>`
);

// 全局响应点击事件
document.querySelector("body").onclick = ev => {
    // 收起所有弹出的元素
    document.querySelector(".face-box").style.display = "none";
    document.querySelector(".stamp-box").style.display = "none";
    document.querySelector(".menu-msg").style.display = "none";
    document.querySelector(".menu-member").style.display = "none";

    if (ev.target === document.querySelector(".show-stamp-box")) { // 漫游表情
        document.querySelector(".stamp-box").style.display = "block";
        if (!document.querySelector(".stamp-box img")) { // 初始化漫游表情栏
            webview.getRoamingStamp().then((stampList) => {
                stampList.forEach((stampUrl) => {
                    document.querySelector(".stamp-box").insertAdjacentHTML("afterbegin",
                        `<img class="stamp" onclick="addImage('${stampUrl}')" src="${stampUrl}" />`);
                });
            });
        }
    } else if (ev.target === document.querySelector(".show-face-box")) { // QQ表情
        document.querySelector(".face-box").style.display = "block";
        if (!document.querySelector(".face-box img")) { // 初始化QQ表情栏
            for (let i = 0; i < 325; i++) {
                if (i === 275 || (i > 247 && i < 260)) {
                    continue;
                }
                const src = webview.faces_path + i + ".png";
                document.querySelector(".face-box").insertAdjacentHTML("beforeend",
                    `<img class="face" onclick="addFace(${i}, '${src}')" src="${src}" />`);
            }
        }
    } else if (ev.target.className === "operation") { // 更多
        // const seq = ev.target.parentNode.parentNode.previousElementSibling.id;
        document.querySelector(".menu-msg").style.left = ev.target.getBoundingClientRect().x + 12 + "px";
        document.querySelector(".menu-msg").style.top = ev.target.getBoundingClientRect().y + "px";
        document.querySelector(".menu-msg").style.display = "block";
        document.querySelector(".menu-msg .menu-msg-at").onclick = ev.target.parentNode.ondblclick;
        // document.querySelector(".menu-msg .menu-msg-recall").onclick = () => {
        //     showModalDialog("确定撤回此消息？", () => {
        //         webview.getChatHistory(webview.c2c ?  : seq, 1).then((value) => {webview.recallMsg(value[0]);});
        //     });
        // };
        const uid = Number(ev.target.parentNode.attributes.uid.value);
        const member = members.get(uid);
        const label = filterXss(member?.card || member?.nickname || "未知用户") + "(" + uid + ")";
        document.querySelector(".menu-msg .menu-msg-mute").onclick = () => {
            showModalDialog(`禁言以下成员 <input id="mute-minutes" size="1" maxlength="5" value="10"> 分钟<br>` + label, () => {
                const duration = document.querySelector("#mute-minutes").value;
                if (duration >= 0) {
                    webview.muteMember(uid, Number(duration) * 60);
                }
            });
        };
        document.querySelector(".menu-msg .menu-msg-kick").onclick = () => {
            showModalDialog(`确定要删除以下成员：<br>` + label, () => {
                webview.kickMember(uid);
            });
        };
        document.querySelector(".menu-msg .menu-msg-poke").onclick = () => {
            webview.poke();
        };
    } else if (ev.target.classList.contains("group-member")) {
        document.querySelector(".menu-member").style.left = ev.target.getBoundingClientRect().x + 50 + "px";
        document.querySelector(".menu-member").style.top = ev.target.getBoundingClientRect().y + 10 + "px";
        document.querySelector(".menu-member").style.display = "block";
        const uid = Number(ev.target.attributes.uid.value);
        const member = members.get(uid);
        const label = filterXss(member?.card || member?.nickname || "未知用户") + "(" + uid + ")";
        document.querySelector(".menu-member .menu-member-poke").onclick = () => {
            webview.pokeMember(uid);
        };
        document.querySelector(".menu-member .menu-member-at").onclick = () => {
            addAt(uid);
        };
        document.querySelector(".menu-member .menu-member-mute").onclick = () => {
            showModalDialog(`禁言以下成员 <input id="mute-minutes" size="1" maxlength="5" value="10"> 分钟<br>` + label, () => {
                const duration = document.querySelector("#mute-minutes").value;
                if (duration >= 0) {
                    webview.muteMember(uid, Number(duration) * 60);
                }
            });
        };
        document.querySelector(".menu-member .menu-member-kick").onclick = () => {
            showModalDialog(`确定要删除以下成员：<br>` + label, () => {
                webview.kickMember(uid);
            });
        };
        document.querySelector(".menu-member .menu-member-admin1").onclick = () => {
            webview.setAdmin(uid, true);
        };
        document.querySelector(".menu-member .menu-member-admin0").onclick = () => {
            webview.setAdmin(uid, false);
        };
    }
};

// 键盘Ctrl+Enter
window.onkeydown = (event) => {
    if (event.ctrlKey && event.keyCode === 13) {
        sendMsg();
    }
};

// 滚动到顶部加载消息
document.querySelector(".lite-chatbox").onscroll = () => {
    if (document.querySelector(".lite-chatbox").scrollTop === 0) {
        const nodeMap = document.querySelector(".cmsg")?.attributes;
        getChatHistory((webview.c2c ? nodeMap.time.value : nodeMap.id.value) ?? "");
    }
};

// 在文本框中粘贴时
document.querySelector(".input-content").onpaste = (ev) => {
    if (!ev.clipboardData || !ev.clipboardData.items) { // 剪切板无数据
        return;
    }
    // 禁用链接
    ev.preventDefault();
    Array.from(ev.clipboardData.items).map((item) => {
        if (item.kind === "string") { // 字符串类型
            if (item.type === "text/plain") { // 只粘贴纯文本
                item.getAsString((str) => {
                    document.querySelector(".input-content").insertAdjacentText("beforeend", str);
                });
            }
        } else if (item.kind === "file") { // 文件类型
            if (item.type.startsWith("image/")) { // 图片
                const reader = new FileReader();
                reader.onload = () => {
                    const img = new Image();
                    img.src = reader.result;
                    document.querySelector(".input-content").insertAdjacentElement("beforeend", img);
                };
                reader.readAsDataURL(item.getAsFile());
            }
        } else { // 其他类型
            reject(new Error("unsupported type!"));
        }
    });
};

// 鼠标拖动分割线时
document.querySelector(".boundary").onmousedown = (mouseEvent) => {
    const dy = mouseEvent.clientY;
    const upperHeight = document.querySelector(".lite-chatbox").offsetHeight;
    const downHeight = document.querySelector(".lite-chatinput").offsetHeight;
    document.onmousemove = (ev) => {
        const diff = ev.clientY - dy; // 移动的距离（上移为负，下移为正）
        if (100 < (upperHeight + diff) && 100 < (downHeight - diff)) { // 两个div的最小高度都为100px
            document.querySelector(".lite-chatbox").style.height = `calc(100% - ${downHeight - diff}px)`;
            document.querySelector(".lite-chatinput").style.height = (downHeight - diff) + "px";
            document.querySelectorAll(".lite-chatbox-tool").forEach((element) => {
                element.style.bottom = document.querySelector(".lite-chatinput").clientHeight + "px";
            });
        }
        // 鼠标释放
        document.onmouseup = () => {
            document.onmousedown = null;
            document.onmousemove = null;
        };
    };
};

function showModalDialog(title, cb) {
    document.querySelector(".modal-title").innerHTML = title;
    document.querySelector(".modal-dialog").style.display = "block";
    document.querySelector(".modal-dialog").style.top = window.innerHeight / 2 - 50 + "px";
    document.querySelector(".modal-dialog").style.left = window.innerWidth / 2 - 100 + "px";
    document.querySelector(".modal-confirm").onclick = cb;
}
function closeModalDialog() {
    document.querySelector(".modal-dialog").style.display = "none";
}
document.querySelector(".modal-confirm").addEventListener("click", closeModalDialog);

function triggerRightBar() {
    if (webview.c2c) {
        return;
    }
    if (document.querySelector(".content-right").style.display === "block") {
        document.querySelector(".content-right").style.display = "none";
    } else {
        document.querySelector(".content-right").style.display = "block";
    }
}

function triggerForwardMsg(obj) {
    const resid = obj.id;
    const elememt = obj.nextElementSibling;
    if (elememt.style.display === "block") {
        elememt.style.display = "none";
    } else {
        elememt.style.display = "block";
    }
    if (elememt.innerHTML === "" || elememt.innerHTML === "加载失败") {
        elememt.innerHTML = "...";
        webview.getForwardMsg(resid).then(data => {
            let html = "";
            for (let v of data.data) {
                html += `<p>👤${filterXss(v.nickname)}(${v.user_id}) ${webview.datetime(v.time)}</p>${parseMessage(v.message)}`;
            }
            if (!html) {
                html = "加载失败";
            }
            elememt.innerHTML = html;
        });
    }
}

// 初始化
(() => {
    if (!webview.c2c) {// 加载群资料、群员列表
        updateMemberList();
    } else { // 获取好友信息
        updateFriendInfo();
    }
    // 加载历史消息
    getChatHistory();
})();
