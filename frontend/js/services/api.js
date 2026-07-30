/**
 * API 服务：封装 Tiny Agent 后端接口。
 */

// 后端接口路径
const CHAT_STREAM_ENDPOINT = '/api/chat/stream';
const HEALTH_ENDPOINT = '/api/health';
const SESSIONS_ENDPOINT = '/api/sessions';

/**
 * 封装所有后端接口调用。
 */
class APIClient {
    /**
     * 发送通用请求并统一处理错误响应。
     * @param {string} endpoint 接口路径
     * @param {RequestInit & { errorMessage?: string }} options 请求配置
     * @returns {Promise<Response>} fetch Response 对象
     */
    async request(endpoint, options = {}) {
        const { errorMessage = '请求失败', ...fetchOptions } = options;
        const response = await fetch(endpoint, {
            ...fetchOptions,
            headers: {
                'Content-Type': 'application/json',
                ...fetchOptions.headers
            }
        });

        if (!response.ok) {
            const detail = await this.readErrorDetail(response);
            const error = new Error(`${errorMessage}: ${detail}`);
            error.status = response.status;
            throw error;
        }

        return response;
    }

    async readErrorDetail(response) {
        try {
            const data = await response.clone().json();
            const detail = data.detail || data.message;
            if (!detail) return response.statusText;
            return typeof detail === 'string' ? detail : JSON.stringify(detail);
        } catch {
            return response.statusText;
        }
    }

    /**
     * 发送消息并返回流式响应读取器。
     * @param {string} sessionId 会话 ID
     * @param {string} message 消息内容
     * @returns {Promise<ReadableStreamDefaultReader<Uint8Array>>} 流式响应读取器
     */
    async chatStream(sessionId, message) {
        const response = await this.request(CHAT_STREAM_ENDPOINT, {
            method: 'POST',
            body: JSON.stringify({ session_id: sessionId, message })
        });

        if (!response.body) {
            throw new Error('响应不包含流数据');
        }

        return response.body.getReader();
    }

    async listSessions() {
        const response = await this.request(SESSIONS_ENDPOINT, {
            method: 'GET',
            errorMessage: '获取会话列表失败'
        });
        return response.json();
    }

    async createSession() {
        const response = await this.request(SESSIONS_ENDPOINT, {
            method: 'POST',
            errorMessage: '创建会话失败'
        });
        return response.json();
    }

    async getSession(sessionId) {
        const response = await this.request(`${SESSIONS_ENDPOINT}/${encodeURIComponent(sessionId)}`, {
            method: 'GET',
            errorMessage: '获取会话详情失败'
        });
        return response.json();
    }

    async renameSession(sessionId, name) {
        const response = await this.request(`${SESSIONS_ENDPOINT}/${encodeURIComponent(sessionId)}`, {
            method: 'PUT',
            body: JSON.stringify({ name }),
            errorMessage: '重命名会话失败'
        });
        return response.json();
    }

    async deleteSession(sessionId) {
        const response = await this.request(`${SESSIONS_ENDPOINT}/${encodeURIComponent(sessionId)}`, {
            method: 'DELETE',
            errorMessage: '删除会话失败'
        });
        return response.json();
    }

    /**
     * 检查后端连接状态。
     * @returns {Promise<boolean>} 是否连接成功
     */
    async checkConnection() {
        try {
            await this.request(HEALTH_ENDPOINT, {
                method: 'GET'
            });
            return true;
        } catch {
            return false;
        }
    }
}

export { APIClient };
