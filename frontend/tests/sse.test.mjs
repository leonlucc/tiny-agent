import assert from 'node:assert/strict';
import test from 'node:test';

import { readSSEStream } from '../js/services/sse.js';

function createReader(payload) {
    const encoded = new TextEncoder().encode(payload);
    return new ReadableStream({
        start(controller) {
            controller.enqueue(encoded);
            controller.close();
        }
    }).getReader();
}

test('readSSEStream accepts a stream with a completion marker', async () => {
    const reader = createReader(
        'data: {"type":"content","chunk":"完成"}\n\n' +
        'data: [DONE]\n\n'
    );

    const events = [];
    for await (const event of readSSEStream(reader)) {
        events.push(event);
    }

    assert.deepEqual(events, [{ type: 'content', chunk: '完成' }]);
});

test('readSSEStream rejects a truncated stream', async () => {
    const reader = createReader(
        'data: {"type":"content","chunk":"部分内容"}\n\n'
    );

    await assert.rejects(
        async () => {
            for await (const _event of readSSEStream(reader)) {
                // Consume the stream.
            }
        },
        /未收到完成标记/
    );
});
