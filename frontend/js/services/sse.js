/**
 * SSE 工具：从响应流中读取 JSON 事件；服务端使用 [DONE] 结束流。
 */
async function* readSSEStream(reader) {
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let completed = false;

    try {
        while (!completed) {
            const { value, done } = await reader.read();
            if (done) {
                buffer += decoder.decode();
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split(/\r?\n\r?\n/);
            buffer = parts.pop() || '';

            for (const part of parts) {
                const eventData = collectEventData(part);
                if (!eventData) continue;
                if (eventData === '[DONE]') {
                    completed = true;
                    break;
                }

                yield parseEventData(eventData);
            }
        }

        if (!completed) {
            const eventData = collectEventData(buffer);
            if (eventData === '[DONE]') {
                completed = true;
            } else if (eventData) {
                yield parseEventData(eventData);
            }
        }

        if (!completed) {
            throw new Error('SSE 流意外中断：未收到完成标记');
        }
    } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
    }
}

/** 将 SSE data 解析为业务事件；协议损坏时交由应用层统一处理。 */
function parseEventData(eventData) {
    try {
        return JSON.parse(eventData);
    } catch (error) {
        throw new Error(`无法解析 SSE 事件: ${error.message}`, { cause: error });
    }
}

function collectEventData(eventBlock) {
    return eventBlock
        .split(/\r?\n/)
        .filter(line => line.startsWith('data:'))
        .map(line => line.replace(/^data:\s?/, ''))
        .join('\n')
        .trim();
}

export { readSSEStream };
