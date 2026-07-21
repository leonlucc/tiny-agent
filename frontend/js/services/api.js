/**
 * API 服务：封装 Tiny Agent 后端接口。
 */

// 使用扁平化常量替代嵌套对象
const CHAT_STREAM_ENDPOINT = '/api/chat/stream';
const HEALTH_ENDPOINT = '/api/health';

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
     * @param {string} message 消息内容
     * @returns {Promise<ReadableStreamDefaultReader<Uint8Array>>} 流式响应读取器
     */
    async chatStream(message) {
        const response = await this.request(CHAT_STREAM_ENDPOINT, {
            method: 'POST',
            body: JSON.stringify({ message })
        });

        if (!response.body) {
            throw new Error('响应不包含流数据');
        }

        return response.body.getReader();
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

const apiClient = new APIClient();

export { apiClient, APIClient };
