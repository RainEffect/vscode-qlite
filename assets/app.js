/**
 * 内置全局变量，封装了一些与宿主交互的方法
 * @type {import("./types").Webview}
 */
var webview;

/**
 * 群员列表
 * @type {Map<number, import("oicq").MemberInfo>}
 */
let memberInfoMap = new Map;

/**
 * 群资料
 * @type {import("oicq").GroupInfo}
 */
let groupInfo;

/**
 * 好友资料
 * @type {import("oicq").FriendInfo}
 */
let friendInfo;

/**
 * 发送状态
 */
let sending = false;

/**
 * 更新好友资料
 */
function updateFriendInfo() {
    webview.getSimpleInfo().then(value => { friendInfo = value; });
}

/**
 * 更新群和群友资料
 */
function updateGroupInfo() {
    webview.renew().then(value => { groupInfo = value; });
    webview.getMemberMap().then((memberMap) => {
        memberInfoMap = new Map;
        memberMap.forEach((member) => {
            memberInfoMap.set(member.user_id, member);
        });
    });
}

/**
 * XSS过滤
 * @param {string} str 要过滤的字符串
 * @returns {string} 过滤后的str
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
 * 生成昵称标签
 * @param {number} id 目标id
 * @returns {string} 加粗昵称元素
 */
function genLabel(id) {
    if (webview.c2c) {
        return `<b title="${id}">${filterXss(friend.nickname)}</b>`;
    } else {
        const member = memberInfoMap.get(id);
        let name = "";
        if (member) {
            name = filterXss(member.card ? member.card : member.nickname);
        }
        return `<b title="${id}">${name}</b>`;
    }
}

/**
 * 生成at元素
 * @param {string} qq at目标的qq或"all"
 * @returns {string} at的HTML
 */
function genAt(qq) {
    if (webview.c2c) {
        return "";
    }
    let label = "";
    if (qq === "all") {
        label = "全体成员";
    } else {
        const member = memberInfoMap.get(Number(qq));
        label = member ? filterXss(member.card ? member.card : member.nickname) : qq;
    }
    return `<a class="at" id="${qq}" href="javascript:void(0);">@${label}</a>`;
}

/**
 * 添加at元素到输入框
 * @param {string} qq at目标的qq或"all"
 */
function appendAt(qq) {
    document.querySelector(".input-content").insertAdjacentHTML("beforeend", genAt(qq));
}

/**
 * 构造表情元素
 * @param {number} id 表情序号
 * @param {boolean} addable true则点击表情会添加到输入框，false不会
 * @returns {string} 表情的HTML
 */
function genFace(id, addable = false) {
    return `<img class="face" src="${webview.faces_path + id}.png" id=${id} ${addable ? "onclick='appendFace(this)'" : ""}>`;
}

/**
 * 添加表情到输入框
 * @param {HTMLImageElement} face 表情元素
 */
function appendFace(face) {
    document.querySelector(".input-content").insertAdjacentHTML("beforeend", genFace(face.id));
}

/**
 * 构造图片元素
 * @param {string} src 图片url地址
 * @param {boolean} addable true则点击图片会添加到输入框，false不会
 * @returns {string} 图片的HTML
 */
function genImage(src, addable = false) {
    return `<img src="${src}" onload="drawImage(this)" ondblclick="enlargeImage(this)" ${addable ? "onclick='appendImage(this)'" : ""}>`;
}

/**
 * 添加图片到输入框
 * @param {HTMLImageElement} image 图片元素
 */
function appendImage(image) {
    document.querySelector(".input-content").insertAdjacentHTML("beforeend", genImage(image.src));
}

/**
 * 限制图片大小
 * @param {HTMLImageElement} img 图片元素
 */
function drawImage(img) {
    const limit = 400; // 长宽上限
    if (img.width > img.height) {
        img.style.maxWidth = `${limit}px`;
    } else {
        img.style.maxHeight = `${limit}px`;
    }
}

/**
 * 放大图片
 * @param {HTMLImageElement} img 图片元素
 */
function enlargeImage(img) {
    /** @type {HTMLDivElement} */
    const imgBox = document.querySelector(".large-img");
    imgBox.innerHTML = `<img src="${img.src}">`;
    imgBox.style.display = "flex";
}

/**
 * 加载转发消息
 * @param {HTMLElement} trigger 转发消息元素
 */
function triggerForwardMsg(trigger) {
    const forwardMsg = trigger.nextElementSibling;
    forwardMsg.style.display = forwardMsg.style.display === "none" ? "block" : "none";
    if (forwardMsg.innerHTML === "" || forwardMsg.innerHTML === "加载失败") {
        forwardMsg.innerHTML = "...";
        webview.getForwardMsg(trigger.id).then((msgList) => { // 尝试重新获取消息
            let html = "";
            msgList.forEach((msg) => {
                html += `<p>👤${filterXss(msg.nickname)}(${msg.user_id})} ${webview.datetime(msg.time)}</p>${parseMessage(msg.message)}`;
            });
            if (!html) {
                html = "加载失败";
            }
            forwardMsg.innerHTML = html;
        });
    }
}

/**
 * 生成消息元素
 * @param {import("oicq").MessageElem[]} msgList 消息元素列表
 * @returns {string} 消息的HTML
 */
function parseMessage(msgList) {
    let html = "";
    msgList.forEach((msg) => {
        switch (msg.type) {
            case "text": // 纯文本，替换链接
                html += filterXss(msg.text).replace(/(https?:\/\/[^\s]+)/g, "<a href='$1'>$1</a>");
                break;
            case "at": // @群友
                html += genAt(msg.qq);
                break;
            case "face": // QQ表情
            case "sface":
                html += msg.id > 324 ? `[${msg.text || "QQ表情"}]` : genFace(msg.id);
                break;
            case "bface": // 原创表情
                html += msg.text ? `[${filterXss(msg.text)}]` : "[原创表情]";
                break;
            case "image": // 图片
            case "flash": // 闪照
                if (!webview.c2c) {
                    msg.url = msg.url.replace(/\/[0-9]+\//, "/0/").replace(/[0-9]+-/g, "0-");
                }
                html += genImage(msg.url);
                break;
            case "record": // 语音
                // 语音消息不支援HTML播放, 因为HTML不支援 .amr / .silk 格式 
                html = `<a href="${msg.url}" target="_blank">[语音消息${msg.seconds ? `(${msg.seconds}s)` : ""}]</a>`;
                break;
            case "video": // 视频
                html = `<span onclick="javascript:var s=this.nextElementSibling.style;s.display=s.display==='none'?'block':'none';">[视频消息]</span>
                    <video height=200 style="display:none;" src="${msg.url}" controls>`;
                break;
            case "xml":
                const dom = new DOMParser().parseFromString(msg.data, "text/xml");
                if (dom.querySelector("msg")?.getAttribute("serviceID") === "35") {
                    try {
                        const resid = /resid="[^"]+"/.exec(msg.data)[0].replace("resid=\"", "").replace("\"", "");
                        html = `<span onclick="triggerForwardMsg(this)" id="${resid}">[合并转发]</span>
                        <span class="msg-forward"></span>`;
                    } catch {
                        html = `<span onclick="javascript:var s=this.nextElementSibling.style;s.display=s.display==='none'?'block':'none';">[嵌套转发]</span>
                        <span style="display:none">${filterXss(msg.data)}</span>`;
                    }
                } else {
                    if (dom.querySelector("msg")?.getAttribute("action") === "web") { //判断是否为链接分享
                        const title = dom.querySelector("msg").getAttribute("brief");
                        const url = dom.querySelector("msg").getAttribute("url");
                        html = `<a href="${filterXss(url)}">${filterXss(title)}</a><br>` + filterXss(dom.querySelector("summary")?.innerHTML);
                    } else {
                        html = `<span onclick="javascript:var s=this.nextElementSibling.style;s.display=s.display==='none'?'block':'none';">[XML卡片消息]</span>
                        <span style="display:none">${filterXss(msg.data)}</span>`;
                    }
                }
                break;
            case "json":
                const jsonCardHandler = {
                    "com.tencent.mannounce": (data) => { // 群公告
                        const mannounce = data.meta.mannounce;
                        const title = decodeURIComponent(mannounce.title.toString("base64"));
                        const content = decodeURIComponent(mannounce.text.toString("base64"));
                        return `<span class="jsonMsgTitle">${filterXss(title)}</span>
                        <span class="jsonMsgContent">${filterXss(content)}</span>`;
                    },
                    "com.tencent.miniapp_01": (data) => { // app小组件分享
                        const { desc: title, preview, qqdocurl: url, title: platform } = data.meta.detail_1;
                        const btn = `<span onclick="javascript:var s=this.nextElementSibling.style;s.display=s.display==='none'?'block':'none';">[${platform}分享]</span>`;
                        const img = preview.startsWith('http') ? preview : `https://${preview}`;
                        const content = `<span style="display:none;">
                            <a href="${url}" target="_blank">${title}</a><br>
                            <a href="${img}" target="_blank">[封面]</a>
                        </span>`;
                        return `${btn}${content}`;
                    },
                    "com.tencent.structmsg": (data) => {
                        const prompt = data.prompt;
                        const { title, preview, jumpUrl: url, tag: platform, desc } = data.meta.news;
                        const btn = `<span onclick="javascript:var s=this.nextElementSibling.style;s.display=s.display==='none'?'block':'none';">${prompt}[${platform}]</span>`;
                        const content = `<span style="display:none;">
                            <a href="${url}" target="_blank">${title}</a>${title === desc ? '' : `<h5>${desc}</h5>`}<br>
                            <a href="${preview}" target="_blank">[封面]</a>
                        </span>`;
                        return `${btn}${content}`;
                    }
                };
                try {
                    const jsonObj = JSON.parse(msg.data);
                    if (jsonCardHandler[jsonObj.app] instanceof Function) {
                        html = jsonCardHandler[jsonObj.app](jsonObj);
                    } else {
                        html = `<span onclick="javascript:var s=this.nextElementSibling.style;s.display=s.display==='none'?'block':'none';">[JSON卡片消息]</span>
                        <span style="display:none">${filterXss(JSON.stringify(jsonObj, null, 4))}</span>`;
                    }
                } catch { }
                break;
            case "file": // 文件
                html = `<a class="file" href="${msg.url}" target="_blank">文件：${filterXss(msg.name)}(${msg.size / 1e6}MB)</a>`;
                break;
            case "rps": // 石头剪刀布
                const fingers = {
                    1: "石头",
                    2: "剪刀",
                    3: "布"
                };
                html += `[猜拳：${fingers[msg.id] ?? msg.id}]`;
                break;
            case "dice": // 骰骰子
                html += `[骰子：${msg.id}]`;
                break;
            case "shake": // 窗口抖动
                html = "[窗口抖动]";
                break;
            case "poke": // 戳一戳
                html = "[戳一戳]";
                break;
        }
    });
    return html;
}

/**
 * 生成带头像、昵称、时间戳和消息本体的完整消息
 * @param {ipmort("oicq").PrivateMessage | import("oicq").GroupMessage} msg 私聊/群聊消息
 * @returns 一条完整的消息的HTML
 */
function genUserMessage(msg) {
    // TODO: 重复消息判断只在chatbox的子元素中查找
    if (document.getElementById(msg.seq)) { // 重复消息
        return "";
    }
    // 获取头衔和昵称
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
        <img class="headIcon radius" src="${webview.getUserAvatarUrlSmall(msg.sender.user_id)}">
        <span class="name" uid="${msg.sender.user_id}" title="${msg.sender.user_id} ${webview.datetime(msg.time)}">
            <span>${title}</span>
            <span ondblclick="appendAt(${msg.sender.user_id})">${webview.c2c ? "" : name}</span>
            <span>${webview.timestamp(msg.time)}</span>
        </span>
        <span class="content">${parseMessage(msg.message)}</span>
    </div>`;
}

/**
 * 生成聊天通知
 * @param {import("oicq").GroupNoticeEvent | import("oicq").PrivateMessageEvent} event 私聊/群聊通知
 * @returns 通知的HTML
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
 * 添加新消息元素到聊天窗口末尾
 * @param {string} msg HTML格式的消息
 */
function appendMessage(msg) {
    const chatbox = document.querySelector(".chat-box");
    chatbox.insertAdjacentHTML("beforeend", msg);
    if (chatbox.scrollHeight - chatbox.scrollTop < chatbox.clientHeight * 1.5) { // 浏览历史记录时收到新消息不滑动窗口
        chatbox.scroll(0, chatbox.scrollHeight);
    }
}

/**
 * 获取聊天记录
 * @param {number | undefined} seq 群聊为消息序号，默认从最后一条发言往前；私聊为时间，默认从当前时间往前
 * @param {number} count 获取的消息条数，默认为20条，最大20条
 */
function getChatHistory(seq, count = 20) {
    webview.getChatHistory(seq, count).then((msgList) => {
        let html = "", msgMark = [];
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
        const chatbox = document.querySelector(".chat-box");
        chatbox.insertAdjacentHTML("afterbegin", html);
        if (seq) { // 上划获取历史记录，窗口停留在加载消息处
            window.location.hash = "#" + msgList[msgList.length - 1].seq;
        } else { // 初次加载历史记录，窗口滑动到底部
            chatbox.scroll(0, chatbox.scrollHeight);
        }
    });
}

/**
 * 发送消息
 */
function sendMessage() {
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
            segment = {
                type: "text",
                text: value.textContent
            };
        } else if (value.nodeName === "IMG") { // 图片
            if (value.className === "face") { // qq表情
                segment = {
                    type: "face",
                    id: Number(value.id)
                };
            } else { // 图片
                const file = value.currentSrc; // .startsWith("https") ? value.currentSrc : value.currentSrc.split(";")[1].replace(",", "://");
                segment = {
                    type: "image",
                    file: file,
                    url: file
                };
            }
        } else if (value.nodeName === "A") { // at
            segment = {
                type: "at",
                qq: value.id === "all" ? value.id : Number(value.id)
            };
        } else { // 暂不支持的类型
            segment = "";
        }
        messageList.push(segment);
    });
    // 调用上层方法
    webview.sendMsg(messageList).then(value => {
        if (value.seq && webview.c2c) {
            // const html = `<div class="cright cmsg", id="${value.seq}" time="${value.time}">
            //     <img class="headIcon radius" src="${webview.getUserAvatarUrlSmall(webview.self_uin)}" />
            //     <span class="name" title="${webview.nickname}(${webview.self_uin}) ${webview.datetime()}">
            //         ${webview.timestamp()}
            //     </span>
            //     <span class="content">${document.querySelector(".input-content").innerHTML}</span>
            // </div>`;
            document.querySelector(".chat-box").insertAdjacentHTML("beforeend", genUserMessage({
                message: messageList,
                sender: {
                    nickname: webview.nickname,
                    user_id: webview.self_uin,
                },
                seq: value.seq,
                time: value.time
            }));
        }
    }).finally(() => {
        sending = false;
        document.querySelector(".send").disabled = false;
        document.querySelector(".input-content").textContent = "";
        document.querySelector(".chat-box").scroll(0, document.querySelector(".chat-box").scrollHeight);
    });
}

// 主体框架
document.querySelector("body").insertAdjacentHTML("beforeend",
    `<div class="chat-box"></div>
    <div class="large-img" onclick="this.style.display='none';"></div>
    <div class="chat-tool stamp-box" style="display: none;"></div>
    <div class="chat-tool face-box" style="display: none;"></div>
    <div class="chat-tool at-box" style="display: none;"></div>
    <div class="chat-input">
        <hr class="boundary">
        <button class="tool-button show-stamp-box" type="button" title="漫游表情">🧡</button>
        <button class="tool-button show-face-box" type="button" title="QQ表情">😀</button>
        <button class="tool-button show-at-box" type="button" title="@ AT" display="${webview.c2c ? 'none' : 'flex'}">@</button>
        <div class="input-content" contenteditable="true"></div>
        <button class="send" onclick="sendMessage()">发送</button>
    </div>`
);

// 监听消息事件
webview.on("message", (event) => {
    appendMessage(genUserMessage(event.detail));
});

// 监听通知事件
webview.on("notice", (event) => {
    appendMessage(genSystemMessage(event.detail));
});

// 滑动消息窗口时
document.querySelector(".chat-box").onscroll = () => {
    if (document.querySelector(".chat-box").scrollTop === 0) { // 滑动到顶部加载历史消息
        const msgNode = document.querySelector(".cmsg").attributes;
        getChatHistory((webview.c2c ? msgNode.time.value : msgNode.id.value) ?? "");
    }
};

// 点击分割线时
document.querySelector(".boundary").onmousedown = (mouseEvent) => {
    const dy = mouseEvent.clientY; // 获取按下时鼠标的y坐标
    const upperHeight = document.querySelector(".chat-box").offsetHeight;
    const downHeight = document.querySelector(".chat-input").offsetHeight;
    document.onmousemove = (ev) => { // 拖动鼠标时
        const diff = ev.clientY - dy; // 移动的距离（上移为负，下移为正）
        if (100 < (upperHeight + diff) && 100 < (downHeight - diff)) { // 两个div的最小高度都为100px
            document.querySelector(".chat-box").style.height = `calc(100% - ${downHeight - diff}px)`;
            document.querySelector(".chat-input").style.height = (downHeight - diff) + "px";
            document.querySelectorAll(".chat-tool").forEach((element) => {
                element.style.bottom = document.querySelector(".chat-input").clientHeight + "px";
            });
        }
        document.onmouseup = () => { // 鼠标释放
            document.onmousedown = null;
            document.onmousemove = null;
        };
    };
};

// 界面点击时
document.querySelector("body").onclick = ev => {
    if (!ev.target.className.includes("show-stamp-box")) { // 关闭漫游表情栏
        document.querySelector(".stamp-box").style.display = "none";
    }
    if (!ev.target.className.includes("show-face-box")) { // 关闭QQ表情栏
        document.querySelector(".face-box").style.display = "none";
    }
    if (!ev.target.className.includes("show-at-box")) { // 关闭AT列表
        document.querySelector(".at-box").style.display = "none";
    }
};

// 打开漫游表情栏
document.querySelector(".show-stamp-box").onclick = () => {
    document.querySelector(".stamp-box").style.display = "block";
    if (!document.querySelector(".stamp-box img")) {
        webview.getRoamingStamp().then((stampList) => {
            stampList.forEach((stampUrl) => {
                document.querySelector(".stamp-box").insertAdjacentHTML("afterbegin", genImage(stampUrl, true));
            });
        });
    }
};

// 打开QQ表情栏
document.querySelector(".show-face-box").onclick = () => {
    document.querySelector(".face-box").style.display = "block";
    if (!document.querySelector(".face-box img")) {
        for (let i = 0; i < 325; i++) {
            if (i === 275 || (i > 247 && i < 260)) {
                continue;
            }
            document.querySelector(".face-box").insertAdjacentHTML("beforeend", genFace(i, true));
        }
    }
};

// 打开AT列表
document.querySelector(".show-at-box").onclick = () => {
    document.querySelector(".at-box").style.display = "block";
    if (!document.querySelector(".at-box div")) {
        // 成员按昵称排序，方便查找
        const memberList = [...memberInfoMap.values()].sort((a, b) => {
            const nameA = a.card ? a.card : a.nickname;
            const nameB = b.card ? b.card : b.nickname;
            return nameA.localeCompare(nameB, "zh-CN");
        });
        memberList.forEach((memberInfo) => {
            document.querySelector(".at-box").insertAdjacentHTML("beforeend", `<div title="${memberInfo.user_id}" onclick="appendAt(${memberInfo.user_id})">${memberInfo.card ? memberInfo.card : memberInfo.nickname}</div>`);
        });
        document.querySelector(".at-box").insertAdjacentHTML("afterbegin", `<div title="all" onclick="appendAt('all')">全体成员</div>`);
    }
};

// 粘贴到输入框时
document.querySelector(".input-content").onpaste = (ev) => {
    if (!ev.clipboardData || !ev.clipboardData.items) { // 剪切板无数据
        return;
    }
    ev.preventDefault(); // 删除链接格式
    Array.from(ev.clipboardData.items).map((item) => {
        if (item.kind === "string") { // 文字
            if (item.type === "text/plain") { // 只粘贴纯文本
                item.getAsString((str) => {
                    document.querySelector(".input-content").insertAdjacentText("beforeend", str);
                });
            }
        } else if (item.kind === "file") { // 文件
            if (item.type.startsWith("image")) { // 图片
                const reader = new FileReader();
                reader.onload = () => {
                    document.querySelector(".input-content").insertAdjacentHTML("beforeend", genImage(reader.result));
                };
                reader.readAsDataURL(item.getAsFile());
            }
        } else { // 其他
            new Error("unsupported type!");
        }
    });
};

// Enter发送消息，Shift+Enter换行
window.onkeydown = (event) => {
    if (event.keyCode !== 13) {
        return;
    }
    if (!event.shiftKey) {
        sendMessage();
    }
};

// 加载群/好友信息，获取历史消息
(() => {
    // 私聊获取好友信息，群聊获取群友信息
    webview.c2c ? updateFriendInfo() : updateGroupInfo();
    // 加载历史消息
    getChatHistory();
})();