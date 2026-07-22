/**
 * 应用入口：集中管理应用状态、DOM 引用和交互调度。
 */

import { readSSEStream } from './services/sse.js';
import { APIClient } from './services/api.js';
import {
    initChatUI,
    addUserMessage,
    clearComposer,
    focusComposer,
    setComposerBusy,
    setConnectionStatus,
    showAssistantError,
    createAssistantResponseView
} from './components/chat-ui.js';

const apiClient = new APIClient();

const appState = {
    isTyping: false
};

function init() {
    const refs = collectDOMElements();
    initChatUI({ ...refs, onSend: sendMessage });
    checkConnection();
}

document.addEventListener('DOMContentLoaded', init);

/** 统一收集 DOM，再注入 UI 组件，避免各模块重复查询全局文档。 */
function collectDOMElements() {
    return {
        chatContainer: document.getElementById('chat-container'),
        messageInput: document.getElementById('message-input'),
        sendButton: document.getElementById('send-button'),
        userMessageTemplate: document.getElementById('user-message-template'),
        assistantMessageTemplate: document.getElementById('assistant-message-template'),
        typingIndicatorTemplate: document.getElementById('typing-indicator-template'),
        connectionStatus: document.getElementById('connection-status')
    };
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
    addUserMessage(content);
    clearComposer();
    appState.isTyping = true;
    setComposerBusy(true);

    const responseView = createAssistantResponseView();

    try {
        const reader = await apiClient.chatStream(content);
        let streamedContent = '';
        let streamedReasoning = '';
        let hasShownAssistantMessage = false;

        // SSE 工具负责协议解析；应用层只处理约定的业务事件类型。
        for await (const data of readSSEStream(reader)) {
            if (data.type === 'error') {
                throw new Error(data.message || '流式输出失败');
            }

            if (data.type === 'reasoning' && data.chunk) {
                streamedReasoning += data.chunk;
                hasShownAssistantMessage = true;
                responseView.update({ reasoning: streamedReasoning });
            }

            if (data.type === 'content' && data.chunk) {
                streamedContent += data.chunk;
                hasShownAssistantMessage = true;
                responseView.update({ content: streamedContent });
            }
        }

        // 流正常结束但没有有效数据时，移除占位节点并给出明确反馈。
        if (hasShownAssistantMessage) {
            responseView.complete(streamedContent);
        } else {
            responseView.dispose();
            showAssistantError('抱歉，未收到有效回复。');
        }
    } catch (error) {
        responseView.dispose();
        showAssistantError(`抱歉，处理您的请求时出错: ${error.message}`);
        checkConnection();
    } finally {
        // 无论请求成功或失败，都恢复输入区供下一次发送。
        appState.isTyping = false;
        setComposerBusy(false);
        focusComposer();
    }
}
