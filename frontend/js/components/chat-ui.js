/**
 * 聊天区组件：只负责根据 app.js 的指令更新界面，不持有业务状态。
 */

const dom = {
    chatContainer: null,
    assistantMessageTemplate: null,
    typingIndicatorTemplate: null,
    messageInput: null,
    sendButton: null,
    connectionStatus: null
};

let onSend = null;

/**
 * 初始化聊天 UI，接收 DOM 引用和回调函数。
 */
function initChatUI({
    chatContainer,
    messageInput,
    sendButton,
    assistantMessageTemplate,
    typingIndicatorTemplate,
    connectionStatus,
    onSend: sendCallback
}) {
    dom.chatContainer = chatContainer;
    dom.messageInput = messageInput;
    dom.sendButton = sendButton;
    dom.assistantMessageTemplate = assistantMessageTemplate;
    dom.typingIndicatorTemplate = typingIndicatorTemplate;
    dom.connectionStatus = connectionStatus;
    onSend = sendCallback;

    bindComposerEvents();
    resizeComposer();
    syncComposerState();
}

/** 根据输入内容与忙碌状态同步发送按钮的禁用状态 */
function syncComposerState() {
    dom.sendButton.disabled = dom.messageInput.disabled || !dom.messageInput.value.trim();
}

/** 根据内容自动调整输入框高度，支持多行输入 */
function resizeComposer() {
    dom.messageInput.style.height = 'auto';
    dom.messageInput.style.height = `${dom.messageInput.scrollHeight}px`;
}

/** 将当前输入内容提交给应用调度中心 */
function submitComposer() {
    const content = dom.messageInput.value.trim();
    if (!content || dom.messageInput.disabled) return;
    onSend(content);
}

/** 绑定输入区的局部交互事件（点击发送、回车发送、输入监听） */
function bindComposerEvents() {
    dom.sendButton.addEventListener('click', submitComposer);

    dom.messageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submitComposer();
        }
    });

    dom.messageInput.addEventListener('input', () => {
        resizeComposer();
        syncComposerState();
    });
}

/** 清空输入框并恢复初始高度 */
function clearComposer() {
    dom.messageInput.value = '';
    resizeComposer();
    syncComposerState();
}

/** 设置输入区忙碌状态（禁用/启用输入框） */
function setComposerBusy(isBusy) {
    dom.messageInput.disabled = isBusy;
    syncComposerState();
}

/** 聚焦输入框 */
function focusComposer() {
    dom.messageInput.focus();
}

/** 更新后端连接状态的图标与文案 */
function setConnectionStatus(isConnected) {
    const connectionDot = dom.connectionStatus.querySelector('.connection-dot');
    const connectionLabel = dom.connectionStatus.querySelector('[data-connection-label]');

    connectionDot.classList.toggle('disconnected', !isConnected);
    connectionLabel.textContent = isConnected ? '已连接' : '连接断开';
}

let scrollScheduled = false;

/** 节流滚动到底部，通过 requestAnimationFrame 避免频繁触发 */
function scheduleScrollToBottom() {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(() => {
        scrollScheduled = false;
        dom.chatContainer.scrollTop = dom.chatContainer.scrollHeight;
    });
}

/** 追加消息到聊天区并触发节流滚动 */
function appendMessage(element) {
    dom.chatContainer.appendChild(element);
    scheduleScrollToBottom();
}

/** 创建 assistant 消息元素（历史、流式、错误消息统一入口） */
function createAssistantMessageElement({ content = '', reasoning = '' } = {}) {
    const el = dom.assistantMessageTemplate.content.firstElementChild.cloneNode(true);
    const messageContent = el.querySelector('.message-content');
    const thinkingSection = el.querySelector('.thinking-section');
    const thinkingContent = el.querySelector('.thinking-content');

    if (reasoning) {
        thinkingSection.hidden = false;
        thinkingContent.textContent = reasoning;
    }

    if (content) {
        messageContent.textContent = content;
    }

    return { el, messageContent, thinkingSection, thinkingContent };
}

/** 创建用户消息元素 */
function createUserMessageElement(message) {
    const el = document.createElement('div');
    el.className = 'message user-message';
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = message;
    el.appendChild(content);
    return el;
}

/** 更新流式 assistant 消息（流式阶段用纯文本展示） */
function updateAssistantMessage(refs, { content, reasoning }) {
    if (reasoning) {
        refs.thinkingSection.hidden = false;
        refs.thinkingContent.textContent = reasoning;
    }
    if (content !== undefined) {
        refs.messageContent.textContent = content;
    }
    scheduleScrollToBottom();
}

/** 流式结束后保留纯文本显示 */
function finalizeAssistantMessage(refs, content) {
    if (content) {
        refs.messageContent.textContent = content;
    }
    scheduleScrollToBottom();
}

/** 创建并显示"正在思考"指示器 */
function createTypingIndicator() {
    const indicator = dom.typingIndicatorTemplate.content.firstElementChild.cloneNode(true);
    appendMessage(indicator);
    return indicator;
}

/**
 * 创建一次 assistant 回复的 UI 生命周期，隐藏具体 DOM 引用。
 * @returns {{update: Function, complete: Function, dispose: Function}}
 */
function createAssistantResponseView() {
    const typingIndicator = createTypingIndicator();
    const refs = createAssistantMessageElement();
    refs.el.hidden = true;
    appendMessage(refs.el);
    let shown = false;

    const show = () => {
        if (shown) return;
        shown = true;
        typingIndicator.remove();
        refs.el.hidden = false;
    };

    return {
        update(parts) {
            show();
            updateAssistantMessage(refs, parts);
        },
        complete(content) {
            show();
            finalizeAssistantMessage(refs, content);
        },
        dispose() {
            typingIndicator.remove();
            refs.el.remove();
        }
    };
}

/** 在聊天区显示 assistant 风格的错误消息 */
function showAssistantError(message) {
    appendMessage(createAssistantMessageElement({ content: message }).el);
}

/** 追加用户消息到聊天区（自动移除空状态） */
function addUserMessage(message) {
    const emptyState = dom.chatContainer.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    appendMessage(createUserMessageElement(message));
}

export {
    initChatUI,
    addUserMessage,
    clearComposer,
    focusComposer,
    setComposerBusy,
    setConnectionStatus,
    showAssistantError,
    createAssistantResponseView
};