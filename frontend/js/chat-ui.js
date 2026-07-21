/**
 * 聊天 UI 模块 - 消息渲染与聊天区域管理
 */

const dom = {
    chatContainer: null,
    emptyState: null,
    assistantMessageTemplate: null
};

/** 初始化聊天 UI 所需的 DOM 引用 */
function initChatUI(refs) {
    dom.chatContainer = refs.chatContainer;
    dom.emptyState = refs.emptyState;
    dom.assistantMessageTemplate = refs.assistantMessageTemplate;
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
    showAssistantError,
    createTypingIndicator,
    createStreamingAssistantMessage,
    updateStreamingAssistantMessage,
    finalizeStreamingAssistantMessage
};
