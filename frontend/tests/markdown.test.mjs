import assert from 'node:assert/strict';
import test from 'node:test';

import {
    renderMarkdown,
    setMarkdownContent
} from '../js/components/markdown.js';

test('renderMarkdown parses before sanitizing with HTML-only settings', () => {
    const calls = [];
    const parser = {
        parse(content, options) {
            calls.push(['parse', content, options]);
            return `<p>${content}</p><script>alert(1)</script>`;
        }
    };
    const sanitizer = {
        sanitize(html, options) {
            calls.push(['sanitize', html, options]);
            return '<p>安全内容</p>';
        }
    };

    const result = renderMarkdown('**安全内容**', { parser, sanitizer });

    assert.equal(result, '<p>安全内容</p>');
    assert.equal(calls[0][0], 'parse');
    assert.equal(calls[1][0], 'sanitize');
    assert.deepEqual(calls[0][2], { async: false, breaks: true, gfm: true });
    assert.deepEqual(calls[1][2], {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['style'],
        FORBID_ATTR: ['style']
    });
});

test('renderMarkdown reports unavailable browser dependencies', () => {
    assert.equal(renderMarkdown('hello', { parser: null, sanitizer: null }), null);
});

test('setMarkdownContent writes only sanitized HTML', () => {
    const container = { innerHTML: '', textContent: '' };
    const parser = { parse: () => '<strong>hello</strong>' };
    const sanitizer = { sanitize: () => '<strong>safe</strong>' };

    setMarkdownContent(container, '**hello**', { parser, sanitizer });

    assert.equal(container.innerHTML, '<strong>safe</strong>');
    assert.equal(container.textContent, '');
});

test('setMarkdownContent falls back to plain text when sanitizing fails', () => {
    const container = { innerHTML: '', textContent: '' };
    const parser = { parse: () => '<img src=x onerror=alert(1)>' };
    const sanitizer = {
        sanitize() {
            throw new Error('sanitizer unavailable');
        }
    };

    setMarkdownContent(container, '<img src=x onerror=alert(1)>', { parser, sanitizer });

    assert.equal(container.innerHTML, '');
    assert.equal(container.textContent, '<img src=x onerror=alert(1)>');
});
