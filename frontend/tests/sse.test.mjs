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

test('readSSEStream yields multiple events in order', async () => {
    const reader = createReader(
        'data: {"type":"reasoning","chunk":"A"}\n\n' +
        'data: {"type":"content","chunk":"B"}\n\n' +
        'data: {"type":"content","chunk":"C"}\n\n' +
        'data: [DONE]\n\n'
    );

    const events = [];
    for await (const event of readSSEStream(reader)) {
        events.push(event);
    }

    assert.deepEqual(events, [
        { type: 'reasoning', chunk: 'A' },
        { type: 'content', chunk: 'B' },
        { type: 'content', chunk: 'C' }
    ]);
});

test('readSSEStream rejects on malformed JSON event', async () => {
    const reader = createReader(
        'data: this is not json\n\n' +
        'data: [DONE]\n\n'
    );

    await assert.rejects(
        async () => {
            for await (const _event of readSSEStream(reader)) {
                // consume
            }
        },
        /无法解析 SSE 事件/
    );
});

test('readSSEStream skips empty data blocks (comment lines)', async () => {
    const reader = createReader(
        ': this is a comment\n\n' +
        'data: {"type":"content","chunk":"only valid"}\n\n' +
        'data: [DONE]\n\n'
    );

    const events = [];
    for await (const event of readSSEStream(reader)) {
        events.push(event);
    }

    assert.deepEqual(events, [{ type: 'content', chunk: 'only valid' }]);
});

test('readSSEStream handles chunked UTF-8 content', async () => {
    // Split a multi-byte UTF-8 character (中) into two separate chunks
    // 中 = 0xE4 0xB8 0xAD  (3 bytes)
    const content = 'data: {"type":"content","chunk":"中文字符测试"}\n\ndata: [DONE]\n\n';
    const encoded = new TextEncoder().encode(content);

    // Split at the middle of a UTF-8 byte sequence
    const chunk1 = encoded.subarray(0, 30);  // cut in middle
    const chunk2 = encoded.subarray(30);

    let step = 0;
    const reader = new ReadableStream({
        start(controller) {
            // enqueue first chunk then schedule second in microtask
            controller.enqueue(chunk1);
            queueMicrotask(() => {
                controller.enqueue(chunk2);
                controller.close();
            });
        }
    }).getReader();

    const events = [];
    for await (const event of readSSEStream(reader)) {
        events.push(event);
    }

    assert.deepEqual(events, [{ type: 'content', chunk: '中文字符测试' }]);
});

test('readSSEStream correctly parses trailing DONE in buffer after reader done', async () => {
    // Send exactly one chunk, with the completion marker
    const reader = createReader(
        'data: [DONE]\n\n'
    );

    const events = [];
    for await (const event of readSSEStream(reader)) {
        events.push(event);
    }

    assert.deepEqual(events, []);
});

test('readSSEStream accepts \\r\\n line endings', async () => {
    const reader = createReader(
        'data: {"type":"content","chunk":"crlf test"}\r\n\r\n' +
        'data: [DONE]\r\n\r\n'
    );

    const events = [];
    for await (const event of readSSEStream(reader)) {
        events.push(event);
    }

    assert.deepEqual(events, [{ type: 'content', chunk: 'crlf test' }]);
});

test('readSSEStream releases reader lock even when stream errors', async () => {
    // Create a reader that errors mid-read
    let released = false;
    let cancelled = false;
    const reader = new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode('data: partial'));
        },
        pull(controller) {
            controller.error(new Error('stream broken'));
        }
    }).getReader();

    const originalRelease = reader.releaseLock.bind(reader);
    reader.releaseLock = function () {
        released = true;
        return originalRelease();
    };
    const originalCancel = reader.cancel.bind(reader);
    reader.cancel = function () {
        cancelled = true;
        return originalCancel();
    };

    try {
        for await (const _e of readSSEStream(reader)) {
            // consume
        }
    } catch {
        // expected
    }

    // Give microtasks a chance to run
    await new Promise(resolve => setTimeout(resolve, 0));
    // releaseLock should always be called in finally block
    assert.equal(released, true);
});
