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

test('renderMarkdown returns null when parser lacks parse function', () => {
    const fakeParser = { render: () => '' }; // no parse method
    const sanitizer = { sanitize: () => '' };
    assert.equal(renderMarkdown('content', { parser: fakeParser, sanitizer }), null);
});

test('renderMarkdown returns null when sanitizer lacks sanitize function', () => {
    const parser = { parse: () => '' };
    const fakeSanitizer = { clean: () => '' }; // no sanitize method
    assert.equal(renderMarkdown('content', { parser, sanitizer: fakeSanitizer }), null);
});

test('renderMarkdown returns null when parser returns non-string', () => {
    const parser = { parse: () => 12345 };
    const sanitizer = { sanitize: () => '<p>ok</p>' };
    assert.equal(renderMarkdown('content', { parser, sanitizer }), null);
});

test('renderMarkdown passes empty content through correctly', () => {
    const calls = [];
    const parser = {
        parse(content, options) {
            calls.push(['parse', content]);
            return '<p></p>';
        }
    };
    const sanitizer = {
        sanitize(html) {
            calls.push(['sanitize', html]);
            return html;
        }
    };

    renderMarkdown('', { parser, sanitizer });

    assert.equal(calls[0][1], '');
});

test('renderMarkdown treats undefined content as empty string', () => {
    const calls = [];
    const parser = {
        parse(content) {
            calls.push(content);
            return '';
        }
    };
    const sanitizer = { sanitize: (html) => html };

    renderMarkdown(undefined, { parser, sanitizer });

    assert.equal(calls[0], '');
});

test('setMarkdownContent catches parse error and falls back to text', () => {
    const container = { innerHTML: '', textContent: '' };
    const parser = {
        parse() {
            throw new Error('parser exploded');
        }
    };
    const sanitizer = { sanitize: () => '<p>safe</p>' };

    setMarkdownContent(container, '**hello**', { parser, sanitizer });

    // Should fall back to plain text
    assert.equal(container.innerHTML, '');
    assert.equal(container.textContent, '**hello**');
});

test('setMarkdownContent treats null content as empty string', () => {
    const container = { innerHTML: '', textContent: '' };
    const parser = { parse: () => '<p>ok</p>' };
    const sanitizer = { sanitize: (html) => html };

    setMarkdownContent(container, null, { parser, sanitizer });

    assert.equal(container.innerHTML, '<p>ok</p>');
    assert.equal(container.textContent, '');
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
