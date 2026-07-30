/**
 * 侧边栏组件：渲染会话列表并把用户操作回传给 app.js。
 */

const dom = {
    sidebar: null,
    sidebarToggle: null,
    mobileToggle: null,
    sidebarBackdrop: null,
    newSessionButton: null,
    sessionList: null,
    sessionDialog: null,
    sessionDialogForm: null,
    sessionDialogTitle: null,
    sessionDialogDescription: null,
    sessionNameField: null,
    sessionNameInput: null,
    sessionDialogCancel: null,
    sessionDialogConfirm: null
};

const callbacks = {
    onCreate: null,
    onSelect: null,
    onRename: null,
    onDelete: null
};

let isBusy = false;
let openMenuSessionId = null;
let pendingAction = null;

function initSidebar({
    sidebar,
    sidebarToggle,
    mobileToggle,
    sidebarBackdrop,
    newSessionButton,
    sessionList,
    sessionDialog,
    sessionDialogForm,
    sessionDialogTitle,
    sessionDialogDescription,
    sessionNameField,
    sessionNameInput,
    sessionDialogCancel,
    sessionDialogConfirm,
    onCreate,
    onSelect,
    onRename,
    onDelete
}) {
    dom.sidebar = sidebar;
    dom.sidebarToggle = sidebarToggle;
    dom.mobileToggle = mobileToggle;
    dom.sidebarBackdrop = sidebarBackdrop;
    dom.newSessionButton = newSessionButton;
    dom.sessionList = sessionList;
    dom.sessionDialog = sessionDialog;
    dom.sessionDialogForm = sessionDialogForm;
    dom.sessionDialogTitle = sessionDialogTitle;
    dom.sessionDialogDescription = sessionDialogDescription;
    dom.sessionNameField = sessionNameField;
    dom.sessionNameInput = sessionNameInput;
    dom.sessionDialogCancel = sessionDialogCancel;
    dom.sessionDialogConfirm = sessionDialogConfirm;
    callbacks.onCreate = onCreate;
    callbacks.onSelect = onSelect;
    callbacks.onRename = onRename;
    callbacks.onDelete = onDelete;

    dom.newSessionButton.addEventListener('click', () => {
        if (!isBusy) {
            callbacks.onCreate();
            if (isMobile()) closeMobileSidebar();
        }
    });
    dom.sidebarToggle.addEventListener('click', toggleSidebar);
    dom.mobileToggle.addEventListener('click', toggleMobileSidebar);
    dom.sidebarBackdrop.addEventListener('click', closeMobileSidebar);
    dom.sessionList.addEventListener('click', handleSessionListClick);
    dom.sessionDialogForm.addEventListener('submit', submitSessionDialog);
    dom.sessionDialogCancel.addEventListener('click', closeSessionDialog);
    dom.sessionDialog.addEventListener('close', () => {
        pendingAction = null;
    });
    document.addEventListener('click', closeMenuFromOutside);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeSessionMenu();
            closeMobileSidebar();
        }
    });
    window.addEventListener('resize', handleViewportChange);
}

function renderSessions(sessions, currentSessionId) {
    dom.sessionList.replaceChildren();

    if (!sessions.length) {
        const empty = document.createElement('p');
        empty.className = 'session-list-empty';
        empty.textContent = '暂无会话';
        dom.sessionList.appendChild(empty);
        return;
    }

    const fragment = document.createDocumentFragment();
    sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-item';
        item.classList.toggle('active', session.session_id === currentSessionId);
        item.dataset.sessionId = session.session_id;

        const selectButton = document.createElement('button');
        selectButton.className = 'session-select-button';
        selectButton.type = 'button';
        selectButton.dataset.action = 'select';
        selectButton.disabled = isBusy;
        selectButton.title = session.session_name;
        const icon = document.createElement('i');
        icon.className = 'fas fa-comment';
        icon.setAttribute('aria-hidden', 'true');

        const sessionDetails = document.createElement('span');
        sessionDetails.className = 'session-details';

        const sessionName = document.createElement('span');
        sessionName.className = 'session-name';
        sessionName.textContent = session.session_name;

        const sessionDate = document.createElement('span');
        sessionDate.className = 'session-date';
        sessionDate.textContent = formatSessionDate(session.created_at);

        sessionDetails.append(sessionName, sessionDate);
        selectButton.append(icon, sessionDetails);

        const moreButton = document.createElement('button');
        moreButton.className = 'session-more-button';
        moreButton.type = 'button';
        moreButton.dataset.action = 'menu';
        moreButton.disabled = isBusy;
        moreButton.setAttribute('aria-label', `${session.session_name}的更多操作`);
        moreButton.setAttribute('aria-expanded', String(openMenuSessionId === session.session_id));
        moreButton.innerHTML = '<i class="fas fa-ellipsis-h" aria-hidden="true"></i>';

        item.append(selectButton, moreButton);
        if (openMenuSessionId === session.session_id) {
            item.appendChild(createSessionMenu());
        }
        fragment.appendChild(item);
    });
    dom.sessionList.appendChild(fragment);
    positionOpenSessionMenu();
}

/** 将后端 YYYYMMDDHHmmSS 日期格式化为 MM/DD。 */
function formatSessionDate(value) {
    if (!value || value.length !== 14) return '';
    return `${value.slice(4, 6)}/${value.slice(6, 8)}`;
}

function createSessionMenu() {
    const menu = document.createElement('div');
    menu.className = 'session-menu';
    menu.setAttribute('role', 'menu');

    const renameButton = document.createElement('button');
    renameButton.type = 'button';
    renameButton.dataset.action = 'rename';
    renameButton.setAttribute('role', 'menuitem');
    renameButton.innerHTML = '<i class="fas fa-pen" aria-hidden="true"></i><span>重命名</span>';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'danger';
    deleteButton.dataset.action = 'delete';
    deleteButton.setAttribute('role', 'menuitem');
    deleteButton.innerHTML = '<i class="fas fa-trash" aria-hidden="true"></i><span>删除</span>';

    menu.append(renameButton, deleteButton);
    return menu;
}

/** 列表底部空间不足时让菜单向上展开，避免被滚动容器裁剪。 */
function positionSessionMenu(item, menu) {
    menu.classList.remove('open-up');
    const listRect = dom.sessionList.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const spaceBelow = listRect.bottom - itemRect.bottom;
    const spaceAbove = itemRect.top - listRect.top;

    if (spaceBelow < menu.offsetHeight && spaceAbove > spaceBelow) {
        menu.classList.add('open-up');
    }
}

function positionOpenSessionMenu() {
    const item = dom.sessionList.querySelector(
        `.session-item[data-session-id="${CSS.escape(openMenuSessionId || '')}"]`
    );
    const menu = item?.querySelector('.session-menu');
    if (item && menu) positionSessionMenu(item, menu);
}

function handleSessionListClick(event) {
    const actionButton = event.target.closest('[data-action]');
    const sessionItem = event.target.closest('.session-item');
    if (!actionButton || !sessionItem || isBusy) return;

    const sessionId = sessionItem.dataset.sessionId;
    const sessionName = sessionItem.querySelector('.session-name').textContent;
    const action = actionButton.dataset.action;

    if (action === 'menu') {
        openMenuSessionId = openMenuSessionId === sessionId ? null : sessionId;
        updateOpenMenu();
        return;
    }

    closeSessionMenu();
    if (action === 'select') {
        callbacks.onSelect(sessionId);
        if (isMobile()) closeMobileSidebar();
    } else if (action === 'rename') {
        openRenameDialog(sessionId, sessionName);
    } else if (action === 'delete') {
        openDeleteDialog(sessionId, sessionName);
    }
}

function isMobile() {
    return window.innerWidth <= 768;
}

function toggleSidebar(event) {
    event.stopPropagation();
    closeSessionMenu();
    if (isMobile()) {
        closeMobileSidebar();
        return;
    }

    const isCollapsed = dom.sidebar.classList.toggle('collapsed');
    dom.sidebarToggle.classList.toggle('active', isCollapsed);
    dom.sidebarToggle.setAttribute('aria-expanded', String(!isCollapsed));
    dom.sidebarToggle.setAttribute(
        'aria-label',
        isCollapsed ? '展开侧边栏' : '收起侧边栏'
    );
}

function toggleMobileSidebar(event) {
    event.stopPropagation();
    dom.sidebar.classList.remove('collapsed');
    dom.sidebarToggle.classList.remove('active');
    const isOpen = dom.sidebar.classList.toggle('open');
    dom.sidebarToggle.setAttribute('aria-expanded', String(isOpen));
    dom.sidebarToggle.setAttribute(
        'aria-label',
        isOpen ? '关闭侧边栏' : '收起侧边栏'
    );
    dom.sidebarBackdrop.classList.toggle('active', isOpen);
    dom.mobileToggle.setAttribute('aria-expanded', String(isOpen));
    dom.mobileToggle.setAttribute(
        'aria-label',
        isOpen ? '关闭侧边栏' : '打开侧边栏'
    );
    document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeMobileSidebar() {
    if (!isMobile() && !dom.sidebar.classList.contains('open')) return;
    dom.sidebar.classList.remove('collapsed', 'open');
    dom.sidebarToggle.classList.remove('active');
    dom.sidebarToggle.setAttribute('aria-expanded', 'true');
    dom.sidebarToggle.setAttribute('aria-label', '收起侧边栏');
    dom.sidebarBackdrop.classList.remove('active');
    dom.mobileToggle.setAttribute('aria-expanded', 'false');
    dom.mobileToggle.setAttribute('aria-label', '打开侧边栏');
    document.body.style.overflow = '';
}

function handleViewportChange() {
    if (!isMobile()) closeMobileSidebar();
}

function openRenameDialog(sessionId, sessionName) {
    pendingAction = { type: 'rename', sessionId, sessionName };
    dom.sessionDialogTitle.textContent = '重命名会话';
    dom.sessionDialogDescription.textContent = '请输入新的会话名称。';
    dom.sessionNameField.hidden = false;
    dom.sessionNameInput.value = sessionName;
    dom.sessionDialogConfirm.textContent = '保存';
    dom.sessionDialogConfirm.classList.remove('danger');
    dom.sessionDialog.showModal();
    dom.sessionNameInput.select();
}

function openDeleteDialog(sessionId, sessionName) {
    pendingAction = { type: 'delete', sessionId, sessionName };
    dom.sessionDialogTitle.textContent = '删除会话';
    dom.sessionDialogDescription.textContent = `确定删除会话“${sessionName}”吗？此操作无法撤销。`;
    dom.sessionNameField.hidden = true;
    dom.sessionDialogConfirm.textContent = '删除';
    dom.sessionDialogConfirm.classList.add('danger');
    dom.sessionDialog.showModal();
}

function submitSessionDialog(event) {
    event.preventDefault();
    if (!pendingAction || isBusy) return;

    const action = pendingAction;
    if (action.type === 'rename') {
        const newName = dom.sessionNameInput.value.trim();
        if (!newName) {
            dom.sessionNameInput.focus();
            return;
        }
        if (newName !== action.sessionName) {
            callbacks.onRename(action.sessionId, newName);
        }
    } else {
        callbacks.onDelete(action.sessionId);
    }
    closeSessionDialog();
}

function closeSessionDialog() {
    if (dom.sessionDialog.open) dom.sessionDialog.close();
    pendingAction = null;
}

function updateOpenMenu() {
    dom.sessionList.querySelectorAll('.session-item').forEach(item => {
        const moreButton = item.querySelector('.session-more-button');
        const shouldOpen = item.dataset.sessionId === openMenuSessionId;
        item.querySelector('.session-menu')?.remove();
        moreButton.setAttribute('aria-expanded', String(shouldOpen));
        if (shouldOpen) {
            const menu = createSessionMenu();
            item.appendChild(menu);
            positionSessionMenu(item, menu);
        }
    });
}

function closeSessionMenu() {
    if (openMenuSessionId === null) return;
    openMenuSessionId = null;
    updateOpenMenu();
}

function closeMenuFromOutside(event) {
    if (!event.target.closest('.session-item')) closeSessionMenu();
}

function setSidebarBusy(busy) {
    isBusy = busy;
    dom.newSessionButton.disabled = busy;
    dom.sessionList.querySelectorAll('button').forEach(button => {
        button.disabled = busy;
    });
    if (busy) closeSessionMenu();
}

export { initSidebar, renderSessions, setSidebarBusy };
