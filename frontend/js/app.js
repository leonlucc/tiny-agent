/**
 * Tiny Agent 前端入口 */

import { readSSEStream } from './sse-stream.js';
import {
    initChatUI,
    renderChat,
    addMessage,
    showAssistantError,
    createTypingIndicator,
    createStreamingAssistantMessage,
    updateStreamingAssistantMessage,
    finalizeStreamingAssistantMessage
} from './chat-ui.js';

const appState = {
    isTyping: false
};

const DOMElements = {
    chatContainer: null,
    messageInput: null,
    sendButton: null,
    emptyState: null,
    connectionLabel: null,
    assistantMessageTemplate: null,
    connectionDot: null
};

function init() {
    cacheDOMElements();
    initChatUI({
        chatContainer: DOMElements.chatContainer,
        emptyState: DOMElements.emptyState,
        assistantMessageTemplate: DOMElements.assistantMessageTemplate
    });
    setupEventListeners();
    renderChat(null);
    resizeComposer();
    syncComposerState();
    checkConnection();
}

function cacheDOMElements() {
    DOMElements.chatContainer = document.getElementById('chat-container');
    DOMElements.messageInput = document.getElementById('message-input');
    DOMElements.sendButton = document.getElementById('send-button');
    DOMElements.emptyState = document.getElementById('empty-state');
    DOMElements.connectionLabel = document.querySelector('[data-connection-label]');
    DOMElements.assistantMessageTemplate = document.getElementById('assistant-message-template');
    DOMElements.connectionDot = document.querySelector('.connection-dot');
}

async function checkConnection() {
    try {
        const response = await fetch('/api/health', { cache: 'no-store' });
        updateConnectionStatus(response.ok);
    } catch {
        updateConnectionStatus(false);
    }
}

function updateConnectionStatus(isConnected) {
    DOMElements.connectionDot.classList.toggle('disconnected', !isConnected);
    DOMElements.connectionLabel.textContent = isConnected ? '已连接' : '连接断开';
}

function syncComposerState() {
    DOMElements.sendButton.disabled = !DOMElements.messageInput.value.trim() || appState.isTyping;
}

function resizeComposer() {
    DOMElements.messageInput.style.height = 'auto';
    DOMElements.messageInput.style.height = DOMElements.messageInput.scrollHeight + 'px';
}

async function sendMessage() {
    const content = DOMElements.messageInput.value.trim();
    if (!content || appState.isTyping) return;

    addMessage({ role: 'user', content });
    DOMElements.messageInput.value = '';
    appState.isTyping = true;
    resizeComposer();
    syncComposerState();

    const typingIndicator = createTypingIndicator();
    let streamRefs = null;

    try {
        const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: content })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || response.statusText);
        }
        if (!response.body) {
            throw new Error('响应不包含流数据');
        }

        streamRefs = createStreamingAssistantMessage({ hidden: true });
        const reader = response.body.getReader();
        let streamedContent = '';
        let streamedReasoning = '';
        let hasShownAssistantMessage = false;

        const showAssistantMessage = () => {
            if (hasShownAssistantMessage) return;
            hasShownAssistantMessage = true;
            typingIndicator.remove();
            streamRefs.el.hidden = false;
        };

        for await (const data of readSSEStream(reader)) {
            if (data.type === 'error') {
                throw new Error(data.message || '流式输出失败');
            }

            if (data.type === 'reasoning' && data.chunk) {
                streamedReasoning += data.chunk;
                showAssistantMessage();
                updateStreamingAssistantMessage(streamRefs, { reasoning: streamedReasoning });
            }

            if (data.type === 'content' && data.chunk) {
                streamedContent += data.chunk;
                showAssistantMessage();
                updateStreamingAssistantMessage(streamRefs, { content: streamedContent });
            }
        }

        if (hasShownAssistantMessage) {
            finalizeStreamingAssistantMessage(streamRefs, streamedContent);
        } else {
            typingIndicator.remove();
            streamRefs.el.remove();
            showAssistantError('抱歉，未收到有效回复。');
        }
    } catch (error) {
        if (typingIndicator.parentNode) {
            typingIndicator.remove();
        }
        if (streamRefs?.el?.parentNode) {
            streamRefs.el.remove();
        }
        showAssistantError(`抱歉，处理您的请求时出错: ${error.message}`);
        checkConnection();
    } finally {
        appState.isTyping = false;
        syncComposerState();
        DOMElements.messageInput.focus();
    }
}

function setupEventListeners() {
    DOMElements.sendButton.addEventListener('click', sendMessage);

    DOMElements.messageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    DOMElements.messageInput.addEventListener('input', () => {
        resizeComposer();
        syncComposerState();
    });
}

export { init };
