/**
 * SSE 工具：从响应流中读取 JSON 事件；服务端使用 [DONE] 结束流。
 */
async function* readSSEStream(reader) {
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() || '';

        for (const part of parts) {
            const eventData = collectEventData(part);
            if (!eventData) continue;
            if (eventData === '[DONE]') return;

            try {
                yield JSON.parse(eventData);
            } catch (error) {
                console.error('SSE解析错误:', error, '数据:', eventData);
            }
        }
    }

    const eventData = collectEventData(buffer);
    if (eventData && eventData !== '[DONE]') {
        try {
            yield JSON.parse(eventData);
        } catch (error) {
            console.error('SSE剩余数据解析错误:', error);
        }
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
