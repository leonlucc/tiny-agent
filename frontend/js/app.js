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
    renderMessages,
    setComposerBusy,
    setConnectionStatus,
    showAssistantError,
    showEmptyState,
    createAssistantResponseView
} from './components/chat-ui.js';
import {
    initSidebar,
    renderSessions,
    setSidebarBusy
} from './components/sidebar.js';

const apiClient = new APIClient();
const appDOM = {
    currentChatTitle: null
};

const appState = {
    sessions: [],
    currentSession: null,
    isTyping: false,
    isSessionLoading: false
};

async function init() {
    const refs = collectDOMElements();
    appDOM.currentChatTitle = refs.currentChatTitle;
    initChatUI({ ...refs, onSend: sendMessage });
    initSidebar({
        ...refs,
        onCreate: createSession,
        onSelect: selectSession,
        onRename: renameSession,
        onDelete: deleteSession
    });
    setComposerBusy(true);
    showEmptyState('正在加载会话...');

    checkConnection();
    await loadSessions();
}

document.addEventListener('DOMContentLoaded', init);

/** 统一收集 DOM，再注入 UI 组件，避免各模块重复查询全局文档。 */
function collectDOMElements() {
    return {
        chatContainer: document.getElementById('chat-container'),
        emptyStateTemplate: document.getElementById('empty-state-template'),
        messageInput: document.getElementById('message-input'),
        sendButton: document.getElementById('send-button'),
        userMessageTemplate: document.getElementById('user-message-template'),
        assistantMessageTemplate: document.getElementById('assistant-message-template'),
        typingIndicatorTemplate: document.getElementById('typing-indicator-template'),
        connectionStatus: document.getElementById('connection-status'),
        currentChatTitle: document.getElementById('current-chat-title'),
        sidebar: document.getElementById('sidebar'),
        sidebarToggle: document.getElementById('sidebar-toggle'),
        mobileToggle: document.getElementById('mobile-toggle'),
        sidebarBackdrop: document.getElementById('sidebar-backdrop'),
        newSessionButton: document.getElementById('new-session-button'),
        sessionList: document.getElementById('session-list'),
        sessionDialog: document.getElementById('session-dialog'),
        sessionDialogForm: document.getElementById('session-dialog-form'),
        sessionDialogTitle: document.getElementById('session-dialog-title'),
        sessionDialogDescription: document.getElementById('session-dialog-description'),
        sessionNameField: document.getElementById('session-name-field'),
        sessionNameInput: document.getElementById('session-name-input'),
        sessionDialogCancel: document.getElementById('session-dialog-cancel'),
        sessionDialogConfirm: document.getElementById('session-dialog-confirm')
    };
}

async function loadSessions() {
    setSessionLoading(true);
    try {
        appState.sessions = await apiClient.listSessions();
        renderSessionList();

        if (appState.sessions.length) {
            await selectSession(appState.sessions[0].session_id, { keepLoading: true });
        } else {
            await createSession({ keepLoading: true });
        }
    } catch (error) {
        showEmptyState('会话加载失败，请检查后端服务后刷新页面');
        showOperationError(error);
    } finally {
        setSessionLoading(false);
    }
}

async function createSession(options = {}) {
    if (!canOperateSession(options.keepLoading)) return;
    if (!options.keepLoading) setSessionLoading(true);

    try {
        const session = await apiClient.createSession();
        appState.sessions = [
            session,
            ...appState.sessions.filter(item => item.session_id !== session.session_id)
        ];
        setCurrentSession(session);
        focusComposer();
    } catch (error) {
        if (!appState.currentSession) {
            showEmptyState('创建会话失败，请稍后重试');
        }
        showOperationError(error);
    } finally {
        if (!options.keepLoading) setSessionLoading(false);
    }
}

async function selectSession(sessionId, options = {}) {
    if (!canOperateSession(options.keepLoading)) return;
    if (appState.currentSession?.session_id === sessionId && !options.keepLoading) {
        return;
    }
    if (!options.keepLoading) setSessionLoading(true);

    try {
        const session = await apiClient.getSession(sessionId);
        appState.sessions = appState.sessions.map(item =>
            item.session_id === sessionId ? session : item
        );
        setCurrentSession(session);
    } catch (error) {
        if (error.status === 404) {
            appState.sessions = appState.sessions.filter(item => item.session_id !== sessionId);
            renderSessionList();
        }
        if (!appState.currentSession) {
            showEmptyState('会话加载失败，请选择其他会话');
        }
        showOperationError(error);
    } finally {
        if (!options.keepLoading) setSessionLoading(false);
    }
}

async function renameSession(sessionId, name) {
    if (!canOperateSession()) return;
    setSessionLoading(true);

    try {
        const updatedSession = await apiClient.renameSession(sessionId, name);
        appState.sessions = appState.sessions.map(item =>
            item.session_id === sessionId ? updatedSession : item
        );
        if (appState.currentSession?.session_id === sessionId) {
            appState.currentSession = updatedSession;
            updateCurrentTitle();
        }
        renderSessionList();
    } catch (error) {
        showOperationError(error);
    } finally {
        setSessionLoading(false);
    }
}

async function deleteSession(sessionId) {
    if (!canOperateSession()) return;
    setSessionLoading(true);

    try {
        await apiClient.deleteSession(sessionId);
        appState.sessions = appState.sessions.filter(item => item.session_id !== sessionId);

        if (appState.currentSession?.session_id === sessionId) {
            appState.currentSession = null;
            const nextSession = appState.sessions[0];
            if (nextSession) {
                const session = await apiClient.getSession(nextSession.session_id);
                appState.sessions = appState.sessions.map(item =>
                    item.session_id === session.session_id ? session : item
                );
                setCurrentSession(session);
            } else {
                updateCurrentTitle();
                showEmptyState('点击左侧“新建会话”开始对话');
            }
        }
        renderSessionList();
    } catch (error) {
        showOperationError(error);
    } finally {
        setSessionLoading(false);
    }
}

function setCurrentSession(session) {
    appState.currentSession = session;
    renderSessionList();
    updateCurrentTitle();
    renderMessages(session.messages);
}

function renderSessionList() {
    renderSessions(appState.sessions, appState.currentSession?.session_id);
}

function updateCurrentTitle() {
    appDOM.currentChatTitle.textContent =
        appState.currentSession?.session_name || '请选择会话';
}

function canOperateSession(allowLoading = false) {
    return !appState.isTyping && (allowLoading || !appState.isSessionLoading);
}

function setSessionLoading(isLoading) {
    appState.isSessionLoading = isLoading;
    syncInteractionState();
}

function syncInteractionState() {
    const isBusy = appState.isTyping || appState.isSessionLoading;
    setSidebarBusy(isBusy);
    setComposerBusy(isBusy || !appState.currentSession);
}

function showOperationError(error) {
    window.alert(error.message);
    checkConnection();
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
    const session = appState.currentSession;
    if (!content || appState.isTyping || appState.isSessionLoading || !session) return;

    addUserMessage(content);
    clearComposer();
    appState.isTyping = true;
    syncInteractionState();

    const responseView = createAssistantResponseView();

    try {
        const reader = await apiClient.chatStream(session.session_id, content);
        let streamedContent = '';
        let streamedReasoning = '';
        let hasShownAssistantMessage = false;

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

        if (hasShownAssistantMessage) {
            responseView.complete(streamedContent);
            session.messages.push(
                { role: 'user', content },
                {
                    role: 'assistant',
                    content: streamedContent,
                    reasoning: streamedReasoning || null
                }
            );
        } else {
            responseView.dispose();
            showAssistantError('抱歉，未收到有效回复。');
        }
    } catch (error) {
        responseView.dispose();
        showAssistantError(`抱歉，处理您的请求时出错: ${error.message}`);
        checkConnection();
    } finally {
        appState.isTyping = false;
        syncInteractionState();
        focusComposer();
    }
}
