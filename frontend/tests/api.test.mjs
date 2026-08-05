import assert from 'node:assert/strict';
import test from 'node:test';

import { APIClient } from '../js/services/api.js';

/**
 * 创建一个模拟的 fetch 函数，记录调用并返回可自定义的响应。
 * 设计要点：
 * 1. fetch 返回值符合 Response 接口
 * 2. 对 fetch 的调用历史进行记录，便于后续断言
 */
function createFetchMock() {
    const calls = [];
    let nextResponse = null;
    let nextError = null;

    const proxied = async function (input, init = {}) {
        calls.push({ input, init });
        if (nextError) {
            const err = nextError;
            nextError = null;
            throw err;
        }
        return nextResponse || createMockResponse({ ok: true });
    };

    proxied.setResponse = function (overrides = {}) {
        nextResponse = createMockResponse(overrides);
    };
    proxied.setNetworkError = function (message = 'Network Error') {
        nextError = new Error(message);
    };
    proxied.getCalls = () => calls;
    proxied.getLastCall = () => calls[calls.length - 1];
    proxied.reset = () => {
        calls.length = 0;
        nextResponse = null;
        nextError = null;
    };
    return proxied;
}

function createMockResponse({
    ok = true,
    status = 200,
    statusText = 'OK',
    jsonValue = {},
    bodyReader = null,
    jsonFn = null  // allow overriding json() to throw
} = {}) {
    return {
        ok,
        status,
        statusText,
        headers: {},
        json: jsonFn || (async () => jsonValue),
        clone() {
            return createMockResponse({
                ok, status, statusText, jsonValue, bodyReader, jsonFn,
                _clone: true
            });
        },
        get body() {
            if (bodyReader === null) return null;
            return {
                getReader() {
                    return bodyReader;
                }
            };
        }
    };
}

/**
 * 注入全局 fetch 模拟的测试包装器。
 */
async function withMockFetch(testFn) {
    const originalFetch = globalThis.fetch;
    const mock = createFetchMock();
    globalThis.fetch = mock;
    try {
        await testFn(mock);
    } finally {
        globalThis.fetch = originalFetch;
        mock.reset();
    }
}


/* ================================
 * request() 方法测试
 * ================================ */

test('APIClient.request includes default JSON content-type header', async () => {
    await withMockFetch(async (fetchMock) => {
        // Arrange
        fetchMock.setResponse({ ok: true, status: 200 });
        const client = new APIClient();

        // Act
        await client.request('/api/x', { method: 'POST', body: '{}' });

        // Assert
        const call = fetchMock.getLastCall();
        assert.equal(call.init.headers['Content-Type'], 'application/json');
    });
});

test('APIClient.request uses default headers when no user headers provided', async () => {
    await withMockFetch(async (fetchMock) => {
        // Arrange
        fetchMock.setResponse({ ok: true, status: 200 });
        const client = new APIClient();

        // Act
        await client.request('/api/x', { method: 'GET' });

        // Assert
        const call = fetchMock.getLastCall();
        assert.deepEqual(call.init.headers, { 'Content-Type': 'application/json' });
    });
});

test('APIClient.request merges user-provided headers without overriding Content-Type', async () => {
    await withMockFetch(async (fetchMock) => {
        // Arrange
        fetchMock.setResponse({ ok: true, status: 200 });
        const client = new APIClient();

        // Act
        await client.request('/api/x', {
            method: 'GET',
            headers: { 'X-Custom': 'custom-value' }
        });

        // Assert
        const call = fetchMock.getLastCall();
        assert.equal(call.init.headers['X-Custom'], 'custom-value');
        assert.equal(call.init.headers['Content-Type'], 'application/json');
    });
});

test('APIClient.request throws structured error on 4xx with JSON detail string', async () => {
    await withMockFetch(async (fetchMock) => {
        // Arrange
        fetchMock.setResponse({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            jsonValue: { detail: '会话不存在' }
        });
        const client = new APIClient();

        // Act & Assert
        let caughtError = null;
        try {
            await client.request('/api/sessions/x', {
                method: 'GET',
                errorMessage: '获取会话失败'
            });
        } catch (e) {
            caughtError = e;
        }
        assert.ok(caughtError !== null, 'Expected request to throw but it did not');
        assert.equal(caughtError.status, 404);
        assert.match(caughtError.message, /获取会话失败/);
        assert.match(caughtError.message, /会话不存在/);
    });
});

test('APIClient.request uses message field when detail absent but message exists', async () => {
    await withMockFetch(async (fetchMock) => {
        // Arrange
        fetchMock.setResponse({
            ok: false,
            status: 400,
            jsonValue: { message: '参数错误' }
        });
        const client = new APIClient();

        // Act & Assert
        let caught = null;
        try {
            await client.request('/api/x', { errorMessage: '失败' });
        } catch (e) { caught = e; }
        assert.ok(caught, 'Expected error');
        assert.match(caught.message, /参数错误/);
    });
});

test('APIClient.request falls back to statusText when JSON has neither detail nor message', async () => {
    await withMockFetch(async (fetchMock) => {
        // Arrange
        fetchMock.setResponse({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            jsonValue: {}
        });
        const client = new APIClient();

        // Act & Assert
        let caught = null;
        try {
            await client.request('/api/x', { errorMessage: '调用失败' });
        } catch (e) { caught = e; }
        assert.ok(caught, 'Expected error');
        assert.match(caught.message, /Internal Server Error/);
    });
});

test('APIClient.readErrorDetail falls back to statusText when response is not JSON', async () => {
    await withMockFetch(async (_fetchMock) => {
        // Arrange - replace global fetch with one that returns a non-JSON response
        const nonJsonResp = createMockResponse({
            ok: false,
            status: 502,
            statusText: 'Bad Gateway',
            jsonFn: async () => { throw new SyntaxError('Invalid JSON'); }
        });
        globalThis.fetch = () => Promise.resolve(nonJsonResp);
        const client = new APIClient();

        // Act & Assert
        let caught = null;
        try {
            await client.request('/api/x', { errorMessage: '网关错误' });
        } catch (e) { caught = e; }
        assert.ok(caught, 'Expected error');
        assert.match(caught.message, /Bad Gateway/);
    });
});

test('APIClient.readErrorDetail stringifies non-string detail (array)', async () => {
    await withMockFetch(async (fetchMock) => {
        // Arrange
        fetchMock.setResponse({
            ok: false,
            status: 422,
            jsonValue: {
                detail: [{ loc: ['body'], msg: '字段错误', type: 'value_error' }]
            }
        });
        const client = new APIClient();

        // Act & Assert
        let caught = null;
        try {
            await client.request('/api/x', { errorMessage: '验证失败' });
        } catch (e) { caught = e; }
        assert.ok(caught, 'Expected error');
        assert.match(caught.message, /字段错误/);
    });
});

/* ================================
 * 业务接口方法测试
 * ================================ */

test('APIClient.listSessions calls GET /api/sessions', async () => {
    await withMockFetch(async (fetchMock) => {
        // Arrange
        const sessions = [
            { session_id: 's1', session_name: '会话1' },
            { session_id: 's2', session_name: '会话2' }
        ];
        fetchMock.setResponse({ ok: true, status: 200, jsonValue: sessions });
        const client = new APIClient();

        // Act
        const result = await client.listSessions();

        // Assert
        assert.deepEqual(result, sessions);
        const call = fetchMock.getLastCall();
        assert.equal(call.input, '/api/sessions');
        assert.equal(call.init.method, 'GET');
    });
});

test('APIClient.createSession calls POST /api/sessions', async () => {
    await withMockFetch(async (fetchMock) => {
        // Arrange
        const session = { session_id: 's3', session_name: '新会话-1', messages: [] };
        fetchMock.setResponse({ ok: true, status: 201, jsonValue: session });
        const client = new APIClient();

        // Act
        const result = await client.createSession();

        // Assert
        assert.deepEqual(result, session);
        const call = fetchMock.getLastCall();
        assert.equal(call.input, '/api/sessions');
        assert.equal(call.init.method, 'POST');
    });
});

test('APIClient.getSession URL-encodes sessionId path', async () => {
    await withMockFetch(async (fetchMock) => {
        // Arrange
        fetchMock.setResponse({ ok: true, status: 200, jsonValue: { session_id: 'id with spaces' } });
        const client = new APIClient();

        // Act
        await client.getSession('id with spaces');

        // Assert
        const call = fetchMock.getLastCall();
        assert.equal(call.input, '/api/sessions/id%20with%20spaces');
        assert.equal(call.init.method, 'GET');
    });
});

test('APIClient.renameSession sends PUT with JSON body', async () => {
    await withMockFetch(async (fetchMock) => {
        // Arrange
        fetchMock.setResponse({
            ok: true, status: 200,
            jsonValue: { session_id: 's1', session_name: '新名字' }
        });
        const client = new APIClient();

        // Act
        await client.renameSession('s1', '新名字');

        // Assert
        const call = fetchMock.getLastCall();
        assert.equal(call.input, '/api/sessions/s1');
        assert.equal(call.init.method, 'PUT');
        assert.equal(call.init.body, JSON.stringify({ name: '新名字' }));
    });
});

test('APIClient.deleteSession calls DELETE endpoint', async () => {
    await withMockFetch(async (fetchMock) => {
        // Arrange
        fetchMock.setResponse({ ok: true, status: 200, jsonValue: { success: true } });
        const client = new APIClient();

        // Act
        const result = await client.deleteSession('s1');

        // Assert
        assert.deepEqual(result, { success: true });
        const call = fetchMock.getLastCall();
        assert.equal(call.init.method, 'DELETE');
        assert.equal(call.input, '/api/sessions/s1');
    });
});

test('APIClient.checkConnection returns true when health ok', async () => {
    await withMockFetch(async (fetchMock) => {
        // Arrange
        fetchMock.setResponse({ ok: true, status: 200, jsonValue: { status: 'ok' } });
        const client = new APIClient();

        // Act
        const okResult = await client.checkConnection();

        // Assert
        assert.equal(okResult, true);
        const call = fetchMock.getLastCall();
        assert.equal(call.input, '/api/health');
    });
});

test('APIClient.checkConnection returns false on network error', async () => {
    await withMockFetch(async (fetchMock) => {
        // Arrange
        fetchMock.setNetworkError('连接被拒绝');
        const client = new APIClient();

        // Act
        const failResult = await client.checkConnection();

        // Assert - should catch the error and return false
        assert.equal(failResult, false);
    });
});

test('APIClient.checkConnection returns false on HTTP error response', async () => {
    await withMockFetch(async (fetchMock) => {
        // Arrange
        fetchMock.setResponse({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            jsonValue: {}
        });
        const client = new APIClient();

        // Act
        const failResult = await client.checkConnection();

        // Assert
        assert.equal(failResult, false);
    });
});

test('APIClient.chatStream returns body reader on success', async () => {
    await withMockFetch(async (_fetchMock) => {
        // Arrange
        const fakeReader = { read: async () => ({ done: true }) };
        const response = createMockResponse({
            ok: true, status: 200,
            bodyReader: fakeReader
        });
        globalThis.fetch = () => Promise.resolve(response);
        const client = new APIClient();

        // Act
        const reader = await client.chatStream('session-1', '你好');

        // Assert
        assert.equal(reader, fakeReader);
    });
});

test('APIClient.chatStream validates payload sent to server', async () => {
    await withMockFetch(async (fetchMock) => {
        // Arrange
        const fakeReader = { read: async () => ({ done: true }) };
        fetchMock.setResponse({ ok: true, status: 200, bodyReader: fakeReader });
        const client = new APIClient();

        // Act
        await client.chatStream('session-1', 'Hello AI');

        // Assert
        const call = fetchMock.getLastCall();
        assert.equal(call.input, '/api/chat/stream');
        assert.equal(call.init.method, 'POST');
        assert.equal(
            call.init.body,
            JSON.stringify({ session_id: 'session-1', message: 'Hello AI' })
        );
    });
});

test('APIClient.chatStream throws when response has no body', async () => {
    await withMockFetch(async (_fetchMock) => {
        // Arrange - response with explicit null body
        const response = createMockResponse({ ok: true, status: 200, bodyReader: null });
        Object.defineProperty(response, 'body', { value: null, writable: false });
        globalThis.fetch = () => Promise.resolve(response);
        const client = new APIClient();

        // Act & Assert
        let caught = null;
        try {
            await client.chatStream('session-1', '你好');
        } catch (e) { caught = e; }
        assert.ok(caught, 'Expected error');
        assert.match(caught.message, /响应不包含流数据/);
    });
});
