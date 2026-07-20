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

/** 向元素追加图标和文本 */
function appendIconText(element, iconClass, text) {
    const icon = document.createElement('i');
    icon.className = iconClass;
    element.append(icon, document.createTextNode(text));
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

/** 显示通知消息（错误、系统等通用逻辑） */
function showNotice(className, iconClass, message, { fadeOut = false, autoHide = false } = {}) {
    if (className === 'error-message') {
        const existingError = document.querySelector('.error-message');
        if (existingError) existingError.remove();
    }

    const notice = document.createElement('div');
    notice.className = className;
    appendIconText(notice, iconClass, message);
    appendMessage(notice);

    if (autoHide) {
        setTimeout(() => {
            if (fadeOut) {
                notice.style.opacity = '0';
                setTimeout(() => notice.remove(), 300);
            } else {
                notice.style.display = 'none';
            }
        }, fadeOut ? 3000 : 5000);
    }
}

/** 显示错误提示横幅 */
function showError(message) {
    showNotice('error-message', 'fas fa-exclamation-circle', message, { autoHide: true });
}

/** 显示系统操作成功提示 */
function showSystemMessage(message) {
    showNotice('system-message', 'fas fa-check-circle', message, { autoHide: true, fadeOut: true });
}

/** 在聊天区显示 assistant 风格的错误消息 */
function showAssistantError(message) {
    appendMessage(createAssistantMessageElement({ content: message }).el);
}

/** 更新消息下方的令牌用量计数 */
function updateTokenCounter(messageElement, tokensUsed) {
    const existingCounter = messageElement.querySelector('.token-counter');
    if (existingCounter) existingCounter.remove();

    if (tokensUsed > 0) {
        const tokenCounter = document.createElement('div');
        tokenCounter.className = 'token-counter';
        appendIconText(tokenCounter, 'fas fa-microchip', `令牌使用: ${tokensUsed}`);
        messageElement.appendChild(tokenCounter);
    }
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
    showError,
    showSystemMessage,
    showAssistantError,
    createTypingIndicator,
    createStreamingAssistantMessage,
    updateStreamingAssistantMessage,
    finalizeStreamingAssistantMessage,
    updateTokenCounter
};
