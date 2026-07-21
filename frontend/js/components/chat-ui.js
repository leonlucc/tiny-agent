/**
 * 聊天区组件：只负责根据 app.js 的指令更新界面，不持有业务状态。
 */

const dom = {
    chatContainer: null,
    emptyState: null,
    assistantMessageTemplate: null,
    messageInput: null,
    sendButton: null,
    connectionStatus: null
};

let onSend = null;
let composerBusy = false;

/** 初始化聊天 UI 所需的 DOM 引用 */
function initChatUI(refs) {
    dom.chatContainer = refs.chatContainer;
    dom.emptyState = refs.emptyState;
    dom.assistantMessageTemplate = refs.assistantMessageTemplate;
    dom.messageInput = refs.messageInput;
    dom.sendButton = refs.sendButton;
    dom.connectionStatus = refs.connectionStatus;
    onSend = refs.onSend;

    bindComposerEvents();
    resizeComposer();
    syncComposerState();
}

/** 根据输入内容与忙碌状态同步发送按钮 */
function syncComposerState() {
    dom.sendButton.disabled = composerBusy || !dom.messageInput.value.trim();
}

/** 根据内容自动调整输入框高度 */
function resizeComposer() {
    dom.messageInput.style.height = 'auto';
    dom.messageInput.style.height = `${dom.messageInput.scrollHeight}px`;
}

/** 将当前输入内容提交给应用调度中心 */
function submitComposer() {
    const content = dom.messageInput.value.trim();
    if (!content || composerBusy) return;
    onSend(content);
}

/** 绑定输入区的局部交互 */
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

/** 设置输入区忙碌状态 */
function setComposerBusy(isBusy) {
    composerBusy = isBusy;
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

/** 滚动聊天容器到底部 */
function scrollToBottom() {
    dom.chatContainer.scrollTop = dom.chatContainer.scrollHeight;
}

/** 节流滚动到底部，避免流式更新时频繁触发 */
function scheduleScrollToBottom() {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(() => {
        scrollScheduled = false;
        scrollToBottom();
    });
}

/** 追加消息到聊天区并滚到底部 */
function appendMessage(element) {
    dom.chatContainer.appendChild(element);
    scrollToBottom();
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

/** 根据消息对象创建 DOM 元素 */
function createMessageElement(message) {
    if (message.role === 'user') {
        const el = document.createElement('div');
        el.className = 'message user-message';
        const content = document.createElement('div');
        content.className = 'message-content';
        content.textContent = message.content;
        el.appendChild(content);
        return el;
    }

    return createAssistantMessageElement({
        content: message.content,
        reasoning: message.reasoning || ''
    }).el;
}

/** 创建流式 assistant 消息容器并追加到聊天区 */
function createStreamingAssistantMessage({ hidden = false } = {}) {
    const refs = createAssistantMessageElement();
    refs.el.hidden = hidden;
    appendMessage(refs.el);
    return refs;
}

/** 更新流式 assistant 消息（流式阶段用纯文本展示） */
function updateStreamingAssistantMessage(refs, { content, reasoning }) {
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
function finalizeStreamingAssistantMessage(refs, content) {
    if (content) {
        refs.messageContent.textContent = content;
    }
    scrollToBottom();
}

/** 创建并显示"正在思考"指示器 */
function createTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'typing-dot';
        indicator.appendChild(dot);
    }
    const label = document.createElement('span');
    label.textContent = '正在思考...';
    indicator.appendChild(label);
    appendMessage(indicator);
    return indicator;
}

/** 在聊天区显示 assistant 风格的错误消息 */
function showAssistantError(message) {
    appendMessage(createAssistantMessageElement({ content: message }).el);
}

/** 渲染整个会话的聊天消息列表 */
function renderChat(session) {
    dom.chatContainer.innerHTML = '';

    if (!session || !session.messages || session.messages.length === 0) {
        dom.chatContainer.appendChild(dom.emptyState.cloneNode(true));
        return;
    }

    session.messages.forEach(message => {
        dom.chatContainer.appendChild(createMessageElement(message));
    });

    scrollToBottom();
}

/** 追加单条消息到聊天区（自动移除空状态） */
function addMessage(message) {
    const emptyState = dom.chatContainer.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    appendMessage(createMessageElement(message));
}

export {
    initChatUI,
    renderChat,
    addMessage,
    clearComposer,
    focusComposer,
    setComposerBusy,
    setConnectionStatus,
    showAssistantError,
    createTypingIndicator,
    createStreamingAssistantMessage,
    updateStreamingAssistantMessage,
    finalizeStreamingAssistantMessage
};
