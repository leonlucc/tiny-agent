/**
 * 将模型返回的 Markdown 转为经过安全过滤的 HTML。
 * 依赖由 index.html 中锁定版本的 marked 与 DOMPurify 提供。
 */

const MARKED_OPTIONS = {
    async: false,
    breaks: true,
    gfm: true
};

const PURIFY_OPTIONS = {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style'],
    FORBID_ATTR: ['style']
};

/**
 * 先解析 Markdown，再过滤生成的 HTML。依赖不可用时返回 null，交由调用方降级为纯文本。
 */
function renderMarkdown(
    content,
    {
        parser = globalThis.marked,
        sanitizer = globalThis.DOMPurify
    } = {}
) {
    if (typeof parser?.parse !== 'function' || typeof sanitizer?.sanitize !== 'function') {
        return null;
    }

    const html = parser.parse(content || '', MARKED_OPTIONS);
    if (typeof html !== 'string') {
        return null;
    }
    return sanitizer.sanitize(html, PURIFY_OPTIONS);
}

/**
 * 安全地更新模型消息容器；解析或过滤异常时按纯文本展示（fail closed）。
 */
function setMarkdownContent(container, content, dependencies) {
    const text = content || '';

    try {
        const safeHTML = renderMarkdown(text, dependencies);
        if (safeHTML !== null) {
            container.innerHTML = safeHTML;
            return;
        }
    } catch {
        // Markdown 渲染不应中断流式会话，且异常时不能写入未经清洗的 HTML。
    }

    container.textContent = text;
}

export { renderMarkdown, setMarkdownContent };
