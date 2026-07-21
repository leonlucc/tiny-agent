/**
 * 应用入口：集中管理应用状态、DOM 引用和交互调度。
 */

import { readSSEStream } from './services/sse.js';
import { apiClient } from './services/api.js';
import {
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
} from './components/chat-ui.js';

// 应用级状态保持最小化；输入内容和 DOM 展示状态由 chat-ui 管理。
const appState = {
    isTyping: false
};

// 页面启动时统一收集 DOM，再注入 UI 组件，避免各模块重复查询全局文档。
const DOMElements = {
    chatContainer: null,
    messageInput: null,
    sendButton: null,
    emptyState: null,
    assistantMessageTemplate: null,
    connectionStatus: null
};

/** 初始化应用并建立 UI 事件到应用调度函数的连接。 */
function init() {
    cacheDOMElements();
    initChatUI({
        chatContainer: DOMElements.chatContainer,
        emptyState: DOMElements.emptyState,
        assistantMessageTemplate: DOMElements.assistantMessageTemplate,
        messageInput: DOMElements.messageInput,
        sendButton: DOMElements.sendButton,
        connectionStatus: DOMElements.connectionStatus,
        onSend: sendMessage
    });
    renderChat(null);
    checkConnection();
}

document.addEventListener('DOMContentLoaded', init);

/** 缓存 HTML 中预定义的页面节点。 */
function cacheDOMElements() {
    DOMElements.chatContainer = document.getElementById('chat-container');
    DOMElements.messageInput = document.getElementById('message-input');
    DOMElements.sendButton = document.getElementById('send-button');
    DOMElements.emptyState = document.getElementById('empty-state');
    DOMElements.assistantMessageTemplate = document.getElementById('assistant-message-template');
    DOMElements.connectionStatus = document.getElementById('connection-status');
}

/** 检测后端服务是否可用，并将结果交给 UI 展示。 */
async function checkConnection() {
    const isConnected = await apiClient.checkConnection();
    setConnectionStatus(isConnected);
}

/**
 * 发送单条用户消息，并统一调度 API、SSE 解析和界面增量更新。
 * @param {string} content chat-ui 回调传入的非空消息内容
 */
async function sendMessage(content) {
    if (!content || appState.isTyping) return;

    // 请求期间锁定输入区，防止同时发起多个流式请求。
    addMessage({ role: 'user', content });
    clearComposer();
    appState.isTyping = true;
    setComposerBusy(true);

    const typingIndicator = createTypingIndicator();
    let streamRefs = null;

    try {
        // assistant 容器先隐藏，收到首个有效数据块后再替换思考指示器。
        streamRefs = createStreamingAssistantMessage({ hidden: true });
        const reader = await apiClient.chatStream(content);
        let streamedContent = '';
        let streamedReasoning = '';
        let hasShownAssistantMessage = false;

        // reasoning 和 content 都可能成为首个事件，因此共用一次性展示逻辑。
        const showAssistantMessage = () => {
            if (hasShownAssistantMessage) return;
            hasShownAssistantMessage = true;
            typingIndicator.remove();
            streamRefs.el.hidden = false;
        };

        // SSE 工具负责协议解析；应用层只处理约定的业务事件类型。
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

        // 流正常结束但没有有效数据时，移除占位节点并给出明确反馈。
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
        // 无论请求成功或失败，都恢复输入区供下一次发送。
        appState.isTyping = false;
        setComposerBusy(false);
        focusComposer();
    }
}

export { init };
