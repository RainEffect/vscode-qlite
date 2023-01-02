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

// 监听消息和通知
webview.on("message", (event) => {
    appendMsg(genUserMessage(event.detail));
});
webview.on("notice", (event) => {
    appendMsg(genSystemMessage(event.detail));
});

function appendMsg(msg) {
    if (document.querySelector(".content-left").scrollTop + document.querySelector(".content-left").offsetHeight + 100 > document.querySelector(".content-left").scrollHeight) {
        var flag = 1;
    }
    document.querySelector("#lite-chatbox").insertAdjacentHTML("beforeend", msg);
    if (flag) {
        document.querySelector(".content-left").scroll(0, document.querySelector(".content-left").scrollHeight);
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
 * 获取历史聊天记录
 * @param {number} param 群聊为条数，默认从最后一条发言往前；私聊为时间，默认从当前时间往前
 * @param {number} count 获取的条数
 */
function getChatHistory(param, count = 20) {
    webview.getChatHistory(param, count).then((msgList) => {
        let html = "";
        let tmp = [];
        for (let msg of msgList) {
            if (webview.c2c) { // 私聊以time为标识
                if (msg.time !== param && !tmp.includes(msg.time)) {
                    tmp.push(msg.time);
                    html += genUserMessage(msg);
                }
            } else { // 群聊以seq为标识
                if (msg.seq !== param && !tmp.includes(msg.seq)) {
                    tmp.push(msg.seq);
                    html += genUserMessage(msg);
                }
            }
        }
        if (!html) {
            return;
        }
        document.querySelector("#lite-chatbox").insertAdjacentHTML("afterbegin", html);
        if (param) {
            window.location.hash = "#" + msgList[0].seq;
        } else {
            document.querySelector(".content-left").scroll(0, document.querySelector(".content-left").scrollHeight);
        }
    });
}

let sending = false;
const pastedImageBufferSize = 10_000_000;
/**
 * @type {{ placeholder: string, cqcode: string, url: string }[]}
 */
const pastedImageMappings = [];

/**
 * 发送消息
 */
function sendMsg() {
    let message = `${document.querySelector("#content").value}`;
    if (sending || !message) {
        return;
    }
    sending = true;
    document.querySelector("#send").disabled = true;

    // 把粘贴的图片占位符重新转换为 CQ 码
    const splitted = [];
    let messageHtml = '';
    while (true) {
        let begin = Infinity;
        /** @type {typeof pastedImageMappings[0]} */
        let found;
        for (const x of pastedImageMappings) {
            const index = message.indexOf(x.placeholder);
            if (index !== -1 && index < begin) {
                found = x;
                begin = index;
            }
        }

        if (begin === Infinity) {
            messageHtml += filterXss(message);
            splitted.push(message);
            break;
        }
        const before = message.slice(0, begin);

        splitted.push(before);
        splitted.push(found.cqcode);
        message = message.slice(begin + found.placeholder.length);

        messageHtml += filterXss(before);
        messageHtml += `<a href="${found.url}" target="_blank" onmouseenter="previewImage(this)">粘贴的图片</a>`;
    }
    // 真正的消息，已经把把图片占位符转换成了 CQ 码
    const realMessage = splitted.join("");

    // 计算目前的空间占用，清理比较老的图片
    let currentSize = 0;
    let clearIndex = pastedImageMappings.length - 1;
    for (; clearIndex >= 0; --clearIndex) {
        const size = pastedImageMappings[clearIndex].cqcode.length / 4 * 3;
        currentSize += size;
        if (currentSize >= pastedImageBufferSize) {
            break;
        }
    }
    if (clearIndex > 0) {
        const removed = pastedImageMappings.splice(0, clearIndex);
        for (const { url } of removed) {
            URL.revokeObjectURL(url);
        }
        console.log(`Removed ${removed.length} items`);
    }

    webview.sendMsg(realMessage).then((msgRet) => {
        // if (msgRet.retcode > 1) {
        //     let msg = msgRet.error?.message;
        //     if (msg?.includes("禁言")) {
        //         if (ginfo.shutup_time_me * 1000 > Date.now()) {
        //             msg += " (至" + webview.datetime(ginfo.shutup_time_me) + ")";
        //         } else if (ginfo.shutup_time_whole) {
        //             msg += " (全员禁言)";
        //         }
        //     } else if (msgRet.retcode === 104) {
        //         msg = "断线了，发送失败";
        //     }
        //     document.querySelector("#lite-chatbox").insertAdjacentHTML(
        //         "beforeend",
        //         `<div class="tips">
        //             <span class="tips-danger">Error: ${msg}</span>
        //         </div>`
        //     );
        //     return;
        // }
        if (webview.c2c && msgRet.seq) {
            const html = `<a class="seq" id="${msgRet.seq}"></a>
            <div class="cright cmsg">
                <img class="headIcon radius" onmouseenter="previewImage(this)" src="${webview.getUserAvaterUrlSmall(webview.self_uin)}" />
                <span class="name" title="${webview.nickname}(${webview.self_uin}) ${webview.datetime()}">
                    ${webview.c2c ? "" : webview.nickname} ${webview.timestamp()}
                </span>
                <span class="content">${messageHtml}</span>
            </div>`;
            document.querySelector("#lite-chatbox").insertAdjacentHTML("beforeend", html);
        }
        document.querySelector("#content").value = "";
        currentTextareaContent = "";
    }).catch(() => {
        document.querySelector("#content").value = "";
        currentTextareaContent = "";
    }).finally(() => {
        sending = false;
        document.querySelector("#send").disabled = false;
        document.querySelector(".content-left").scroll(0, document.querySelector(".content-left").scrollHeight);
    });
}

/**
 * 生成系统消息
 * @param {import("oicq").GroupNoticeEvent | import("oicq").FriendNoticeEvent} event 
 */
function genSystemMessage(event) {
    let msg = "";
    if (event instanceof import("oicq").FriendNoticeEvent) {
        switch (typeof event) {
            case oicq.FriendPokeEvent:
                msg = `${event.operator_id} ${event.action} ${event.target_id} ${event.suffix}`;
                break;
            case oicq.FriendRecallEvent:
                msg = `有人想撤回 <a href="#${event.seq}">一条消息</>`;
                appendRecalledText(event.seq);
                break;
        }
    } else if (event instanceof import("oicq").GroupNoticeEvent) {
        switch (typeof event) {
            case oicq.GroupRecallEvent:
                msg = `${genLabel(event.operator_id)} 撤回了 ${event.user_id === event.operator_id ? "自己" : genLabel(event.user_id)} 的<a href="#${event.seq}" onclick="document.getElementById(${seq})?.nextElementSibling.animate([{'background':'var(--vscode-sideBar-background)'}],{duration: 3000})">一条消息</>`;
                appendRecalledText(event.seq);
                break;
            case oicq.GroupIncreaseEvent:
                msg = `${filterXss(event.nickname)}(${event.user_id}) 加入了群聊`;
                updateMemberList();
                break;
            case oicq.MemberDecreaseEvent:
                if (event.dismiss) {
                    msg = `该群已被解散`;
                    break;
                }
                if (event.operator_id === event.user_id) {
                    msg = `${genLabel(event.user_id)} 退出了群聊`;
                } else {
                    msg = `${genLabel(event.operator_id)} 踢出了 ${genLabel(event.user_id)}`;
                }
                updateMemberList();
                break;
            case oicq.GroupAdminEvent:
                msg = `${genLabel(event.user_id)} ${event.set ? "成为了" : "被取消了"}管理员`;
                updateMemberList();
                break;
            case oicq.GroupTransferEvent:
                msg = `${genLabel(event.operator_id)} 将群主转让给了 ${genLabel(event.user_id)}`;
                updateMemberList();
                break;
            case oicq.GroupMuteEvent:
                if (event.user_id > 0) {
                    msg = `${genLabel(event.operator_id)} 禁言 ${event.user_id === 80000000 ? "匿名用户(" + event.nickname + ")" : genLabel(event.user_id)} ${~~(event.duration / 60)}分钟`;
                } else {
                    msg = `${genLabel(event.operator_id)} ${event.duration > 0 ? "开启" : "关闭"}了全员禁言`;
                }
                updateMemberList();
                break;
            case oicq.GroupPokeEvent:
                msg = `${genLabel(event.operator_id)} ${event.action} ${genLabel(event.user_id)} ${event.suffix}`;
                break;
            // case "setting":
            //     if (event.group_name) {
            //         msg = `群名已变更为 ` + event.group_name;
            //     }
            //     break;
        }
    }
    if (!msg) {
        return "";
    }
    return `<div class="tips" title="${weview.datetime(event.time)}">
        <span>${msg}</span>
    </div>`;
}

/**
 * 生成标签
 * @param {number} user_id 
 */
function genLabel(user_id) {
    const member = members?.get(user_id);
    if (!member) {
        return user_id;
    }
    return `<b title="${filterXss(member.nickname)} (${user_id})">${filterXss(member.card ? member.card : member.nickname)}</b>`;
}

/**
 * 转义message_id中的特殊字符
 * @param {string} message_id 
 */
function filterMsgIdSelector(message_id) {
    return message_id.replace(/\//g, "\\/").replace(/\=/g, "\\=").replace(/\+/g, "\\+");
}

/**
 * @param {number} seq 
 */
function appendRecalledText(seq) {
    document.querySelector("a[id=" + seq + "]+div span")?.append(" (已撤回)");
}

/**
 * 生成一般消息
 * @param {import("oicq").PrivateMessage | import("oicq").GroupMessage} msg
 */
function genUserMessage(msg) {
    if (document.getElementById(msg.seq)) {
        return "";
    }
    let title = "";
    if (msg.sub_type === "anonymous") {
        title = `<span class="htitle member">匿名</span>`;
    } else if (msg.sender.role === "owner" || msg.sender.role === "admin") {
        title = `<span class="htitle ${msg.sender.role}">${msg.sender.role}</span>`;
    }
    return `<a class="seq" id="${msg.seq}"></a>
    <div class="${msg.sender.user_id === webview.self_uin ? "cright" : "cleft"} cmsg">
        <img class="headIcon radius" onmouseenter="previewImage(this)" src="${webview.getUserAvaterUrlSmall(msg.sender.user_id)}" />
        <span uid="${msg.sender.user_id}" ondblclick="addAt(${msg.sender.user_id})" class="name" title="${filterXss(msg.sender.nickname)}(${msg.sender.user_id}) ${webview.datetime(msg.time)}">
            ${webview.c2c ? "" : '<b class="operation">...</b>'}
            ${title}${filterXss(msg.sender.card ? msg.sender.card : msg.sender.nickname)} ${webview.timestamp(msg.time)}
        </span>
        <span class="content">${parseMessage(msg.message)}</span>
    </div>`;
}

const xssMap = {
    "&": "&amp;",
    "\"": "&quot;",
    "<": "&lt;",
    ">": "&gt;",
    " ": "&nbsp;",
    "\t": "&emsp;",
};

/**
 * xss过滤
 * @param {string} str 
 */
function filterXss(str) {
    str = str.replace(/[&"<>\t ]/g, (s) => {
        return xssMap[s];
    });
    str = str.replace(/\r\n/g, "<br>").replace(/\r/g, "<br>").replace(/\n/g, "<br>");
    return str;
}

/**
 * 生成消息字符串
 * @param {import("oicq").MessageElem[]} message 
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
                    msg += `<img class="face" ondblclick="addFace(${v.id})" src="${webview.faces_path + v.id}.png">`;
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
                let split = v.file.split("-");
                let width = parseInt(split[1]), height = parseInt(split[2]);
                msg += `<a href="${v.url}&file=${v.file}&vscodeDragFlag=1" target="_blank" onmouseenter="previewImage(this,${width},${height})">${v.type === "image" ? "图片" : "闪照"}</a>`;
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
                        msg = `<a href="javascript:void(0)" onclick="triggerForwardMsg(this)" id="${resid}">[合并转发]</a><span class="msg-forward"></span>`;
                    } catch {
                        msg = `<a href="javascript:void(0)" onclick="javascript:var s=this.nextElementSibling.style;if(s.display=='block')s.display='none';else s.display='block'">[嵌套转发]</a><span style="display:none">${filterXss(v.data)}</span>`;
                    }
                } else {
                    if (dom.querySelector("msg")?.getAttribute("action") === "web") { //判断是否为链接分享
                        const title = dom.querySelector("msg").getAttribute("brief");
                        const url = dom.querySelector("msg").getAttribute("url");
                        msg = `<a href="${filterXss(url)}">${filterXss(title)}</a><br>` + filterXss(dom.querySelector("summary")?.innerHTML);
                    } else {
                        msg = `<a href="javascript:void(0)" onclick="javascript:var s=this.nextElementSibling.style;if(s.display=='block')s.display='none';else s.display='block'">[XML卡片消息]</a><span style="display:none">${filterXss(v.data)}</span>`;
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
                        msg = `<a href="javascript:void(0)" onclick="javascript:var s=this.nextElementSibling.style;if(s.display=='block')s.display='none';else s.display='block'">[JSON卡片消息]</a><span style="display:none">${filterXss(JSON.stringify(jsonObj, null, 4))}</span>`;
                    }
                } catch { }
                break;
            case "file":
                msg = `<a href="${v.url}" target="_blank">文件: ${filterXss(v.name)} (${v.size / 1e6}MB)</a>`;
                break;
            case "reply":
                if (message[1]?.type === "at" && message[3]?.type === "at" && message[1]?.qq === message[3]?.qq) {
                    message.splice(1, 2);
                }
                msg += `<a href="#${v.id}" onclick="document.querySelector('#${filterMsgIdSelector(v.id).replace(/\\/g, "\\\\")}')?.nextElementSibling.animate([{'background':'var(--vscode-sideBar-background)'}],{duration: 3000})">[回复]</a>`;
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

/**
 * 加入at元素到输入框
 * @param {number | "all"} uid 
 */
function addAt(uid) {
    if (webview.c2c) {
        return;
    }
    const cqcode = `[CQ:at,qq=${uid}] `;
    addStr2Textarea(cqcode);
}

/**
 * 加入表情到输入框
 * @param {number} id 
 */
function addFace(id) {
    const cqcode = `[CQ:face,id=${id}]`;
    addStr2Textarea(cqcode);
}

/**
 * 加入图片到输入框
 * @param {string} file 
 */
function addImage(file) {
    const cqcode = `[CQ:image,file=${file},type=face]`;
    addStr2Textarea(cqcode);
}

function addStr2Textarea(str) {
    currentTextareaContent += str;
    document.querySelector("#content").value = currentTextareaContent;
    document.querySelector("#content").focus();
}

function setTextareaText(str) {
    currentTextareaContent = str;
    document.querySelector("#content").value = currentTextareaContent;
    document.querySelector("#content").focus();
}

function insertStr2Textarea(str) {
    const textArea = document.querySelector("#content");
    if (textArea.selectionStart || textArea.selectionStart === '0') {
        const begin = textArea.selectionStart;
        const end = textArea.selectionEnd || textArea.selectionStart;
        setTextareaText(textArea.value.substring(0, begin) + str + textArea.value.substring(end));
        textArea.selectionStart = textArea.selectionEnd = begin + str.length;
    }
    else {
        addStr2Textarea(str);
    }
}

let currentTextareaContent = "";

document.querySelector("body").insertAdjacentHTML("beforeend",
    `<div class="content-left"><div class="lite-chatbox">
        <div class="tips">
            <span ondblclick='getChatHistory(document.querySelector(".seq")?.attributes.id.value ?? "");'>双击加载历史消息</span>
        </div>
    </div>
    <div class="lite-chatbox" id="lite-chatbox"></div>
    <div style="width: 100%; height: 30px;"></div>
    <img id="img-preview" style="z-index: 999;">
    <div class="menu-msg">
        <div class="menu-msg-reply">回复</div>
        <div class="menu-msg-at">@ TA</div>
        <div class="menu-msg-poke">戳一戳</div>
        <div class="menu-msg-recall">撤回消息</div>
        <div class="menu-msg-mute">禁言</div>
        <div class="menu-msg-kick">从本群中删除</div>
    </div>
    <div class="modal-dialog">
        <div class="modal-title"></div>
        <div class="modal-button">
            <button class="modal-confirm">确定</button><button onclick="closeModalDialog()">取消</button>
        </div>
    </div>
    <div id="footer">
        <textarea id="content" rows="4" placeholder="在此输入消息..."></textarea>
        <button id="send" onclick="sendMsg()">发送</button>Ctrl+Enter
        <span id="show-stamp-box" class="insert-button">🧡</span>
        <div class="stamp-box box"></div>
        <span id="show-face-box" class="insert-button">😀</span>
        <div class="face-box box"></div>
        <span id="show-emoji-box" class="insert-button">颜</span>
        <div class="emoji-box box"></div>
        <span id="insert-pic" class="insert-button" title="也可以直接粘贴图片">🖼️</span>
        ${webview.c2c ? "" : '<span id="to-bottom" onclick="triggerRightBar()">显示/隐藏侧栏</span>'}
    </div>
    </div>
    <div class="content-right">
        <div class="group-info">
            <img class="headIcon radius" src="${webview.getGroupAvaterUrlSmall(webview.target_uin)}">
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

const idPreviewElement = document.querySelector("#img-preview");
const idShowStampBox = document.querySelector('#show-stamp-box');
const idShowFaceBox = document.querySelector('#show-face-box');
const idShowEmojiBox = document.querySelector('#show-emoji-box');

// add face to document
let tmpFaceStep = 0;
for (let i = 0; i <= 324; ++i) {
    if (i === 275 || (i > 247 && i < 260)) {
        continue;
    }
    ++tmpFaceStep;
    let html = `<img onclick="addFace(${i})" style="margin:5px;cursor:pointer" width="28" height="28" src="${webview.faces_path + i + ".png"}">`;
    document.querySelector('.face-box').insertAdjacentHTML("beforeend", html);
}
document.querySelector("body").addEventListener("click", (e) => {
    document.querySelector('.face-box').style.display = 'none';
    document.querySelector('.emoji-box').style.display = 'none';
    document.querySelector('.stamp-box').style.display = 'none';
    document.querySelector('.menu-msg').style.display = 'none';
    document.querySelector('.menu-member').style.display = 'none';
    if (e.target === idShowStampBox) {
        document.querySelector('.stamp-box').style.display = 'block';
        // if (!document.querySelector('.stamp-box img')) {
        //     // add stamp to document
        //     webview.getRoamingStamp().then((data) => {
        //         if (data.retcode === 0) {
        //             let tmpStampStep = 0;
        //             for (let i = data.data.length - 1; i >= 0; --i) {
        //                 ++tmpStampStep;
        //                 const url = data.data[i];
        //                 let html = `<img onclick="addImage('${url}')" src="${url}">` + (tmpStampStep % 6 === 0 ? "<br>" : "");
        //                 document.querySelector('.stamp-box').insertAdjacentHTML("beforeend", html);
        //             }
        //         }
        //     });
        // }
    } else if (e.target === idShowFaceBox) {
        document.querySelector('.face-box').style.display = 'block';
    } else if (e.target === idShowEmojiBox) {
        document.querySelector('.emoji-box').style.display = 'block';
    } else if (e.target.classList.contains("operation")) {
        const seq = e.target.parentNode.parentNode.previousElementSibling.id;
        document.querySelector('.menu-msg').style.left = e.target.getBoundingClientRect().x + 12 + "px";
        document.querySelector('.menu-msg').style.top = e.target.getBoundingClientRect().y + "px";
        document.querySelector('.menu-msg').style.display = 'block';
        document.querySelector('.menu-msg .menu-msg-at').onclick = e.target.parentNode.ondblclick;
        document.querySelector('.menu-msg .menu-msg-reply').onclick = () => {
            addStr2Textarea(`[CQ:reply,id=${seq}]`);
            e.target.parentNode.ondblclick();
        };
        // document.querySelector('.menu-msg .menu-msg-recall').onclick = () => {
        //     showModalDialog("确定撤回此消息？", () => {
        //         webview.getChatHistory(webview.c2c ?  : seq, 1).then((value) => {webview.recallMsg(value[0]);});
        //     });
        // };
        const uid = Number(e.target.parentNode.attributes.uid.value);
        const member = members.get(uid);
        const label = filterXss(member?.card || member?.nickname || "未知用户") + "(" + uid + ")";
        document.querySelector('.menu-msg .menu-msg-mute').onclick = () => {
            showModalDialog(`禁言以下成员 <input id="mute-minutes" size="1" maxlength="5" value="10"> 分钟<br>` + label, () => {
                const duration = document.querySelector("#mute-minutes").value;
                if (duration >= 0) {
                    webview.muteMember(uid, Number(duration) * 60);
                }
            });
        };
        document.querySelector('.menu-msg .menu-msg-kick').onclick = () => {
            showModalDialog(`确定要删除以下成员：<br>` + label, () => {
                webview.kickMember(uid);
            });
        };
        document.querySelector('.menu-msg .menu-msg-poke').onclick = () => {
            webview.poke();
        };
    } else if (e.target.classList.contains("group-member")) {
        document.querySelector('.menu-member').style.left = e.target.getBoundingClientRect().x + 50 + "px";
        document.querySelector('.menu-member').style.top = e.target.getBoundingClientRect().y + 10 + "px";
        document.querySelector('.menu-member').style.display = 'block';
        const uid = Number(e.target.attributes.uid.value);
        const member = members.get(uid);
        const label = filterXss(member?.card || member?.nickname || "未知用户") + "(" + uid + ")";
        document.querySelector('.menu-member .menu-member-poke').onclick = () => {
            webview.pokeMember(uid);
        };
        document.querySelector('.menu-member .menu-member-at').onclick = () => {
            addAt(uid);
        };
        document.querySelector('.menu-member .menu-member-mute').onclick = () => {
            showModalDialog(`禁言以下成员 <input id="mute-minutes" size="1" maxlength="5" value="10"> 分钟<br>` + label, () => {
                const duration = document.querySelector("#mute-minutes").value;
                if (duration >= 0) {
                    webview.muteMember(uid, Number(duration) * 60);
                }
            });
        };
        document.querySelector('.menu-member .menu-member-kick').onclick = () => {
            showModalDialog(`确定要删除以下成员：<br>` + label, () => {
                webview.kickMember(uid);
            });
        };
        document.querySelector('.menu-member .menu-member-admin1').onclick = () => {
            webview.setAdmin(uid, true);
        };
        document.querySelector('.menu-member .menu-member-admin0').onclick = () => {
            webview.setAdmin(uid, false);
        };
    }
});
document.querySelector("#insert-pic").addEventListener("click", () => {
    const cqcode = `[CQ:image,file=替换为本地图片或网络URL路径]`;
    addStr2Textarea(cqcode);
});

let tmpEmojiStep = 0;
function addEmoji2Box(from, to) {
    for (let i = from; i <= to; ++i) {
        ++tmpEmojiStep;
        let str = String.fromCodePoint(i);
        let html = `<span onclick="addStr2Textarea('${str}')" style="cursor:pointer">` + str + "</span>";
        document.querySelector('.emoji-box').insertAdjacentHTML("beforeend", html);
    }
}
addEmoji2Box(0x1F600, 0x1F64F);
addEmoji2Box(0x1F90D, 0x1F945);
addEmoji2Box(0x1F400, 0x1F4FF);
addEmoji2Box(0x1F300, 0x1F320);
addEmoji2Box(0x1F32D, 0x1F394);
addEmoji2Box(0x1F3A0, 0x1F3FA);
addEmoji2Box(0x1F680, 0x1F6C5);
addEmoji2Box(0x1F004, 0x1F004);

/**
 * 图片预览
 * @param {Element} obj 
 */
function previewImage(obj, width, height) {
    const url = obj.href ?? obj.src.replace("100", "640");
    if (width > 0 && width <= 200) {
        width = width + "px";
        height = "auto";
    } else if (height > 0 && height <= 200) {
        width = "auto";
        height = height + "px";
    } else if (height > 200 && width > 200) {
        if (width >= height) {
            width = "auto";
            height = "200px";
        } else {
            width = "200px";
            height = "auto";
        }
    } else {
        width = "200px";
        height = "auto";
    }
    idPreviewElement.style.width = width;
    idPreviewElement.style.height = height;
    let left = obj.getBoundingClientRect().x + 20;
    if (left + 150 > window.innerWidth) {
        left -= 200;
    }
    let top = obj.getBoundingClientRect().y - 5;
    idPreviewElement.src = url;
    idPreviewElement.style.left = left + "px";
    idPreviewElement.style.top = top + "px";
    idPreviewElement.style.display = "block";
    obj.onmouseleave = () => idPreviewElement.style.display = "none";
}

// Ctrl+Enter
window.onkeydown = function (event) {
    if (event.ctrlKey && event.keyCode === 13) {
        sendMsg();
    }
};

//滚动到顶部加载消息
document.querySelector(".content-left").onscroll = function () {
    if (document.querySelector(".content-left").scrollTop === 0) {
        getChatHistory(document.querySelector(".seq")?.attributes.id.value ?? "");
    }
};

//表情、图片拖动
document.querySelector("#content").oninput = function () {
    const content = this.value;
    const diff = content.substr(currentTextareaContent.length);
    if (diff.startsWith(webview.faces_path)) {
        const faceId = diff.substr(webview.faces_path.length).split(".")[0];
        const cqcode = `[CQ:face,id=${faceId}]`;
        addStr2Textarea(cqcode);
    } else if (diff.endsWith("&vscodeDragFlag=1")) {
        const file = new URL(diff).searchParams.get("file");
        const cqcode = `[CQ:image,file=${file},type=face]`;
        addStr2Textarea(cqcode);
    } else {
        currentTextareaContent = content;
    }
};

// 粘贴图片
document.querySelector("#content").addEventListener("paste", async ev => {
    /** @type {DataTransfer} */
    const clipboardData = (ev.clipboardData || ev.originalEvent.clipboardData);
    const pasted = await Promise.all(Array.from(clipboardData.items).map(item => {
        if (item.kind !== "file") {
            // 处理富文本会比较麻烦，交给 textarea 自己去处理吧（
            // 可是，这样其实有个问题，假如同时复制了交错的文字与图片
            // 那么顺序将会被打乱 - 首先是 textarea 自己粘贴的文字，之后才是图片
            // 该怎么办才好呀 qwq
            return Promise.resolve('');
        }
        if (!item.type.startsWith("image/")) {
            return Promise.resolve(`（暂不支持的文件类型：${item.type}）`);
        }

        return new Promise((resolve, reject) => {
            const blob = item.getAsFile();
            const url = URL.createObjectURL(blob);

            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(",")[1];
                const cqcode = `[CQ:image,file=base64://${base64}]`;
                const placeholder = `[粘贴的图片 ${url}]`;
                pastedImageMappings.push({ placeholder, cqcode, url });
                resolve(placeholder);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }));
    const text = pasted.join("");
    insertStr2Textarea(text);
});

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

//init
(() => {
    if (!webview.c2c) {
        //加载群资料、群员列表
        updateMemberList();
    }
    //加载历史消息
    getChatHistory();
})();
