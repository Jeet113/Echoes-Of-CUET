const API_BASE = 'http://localhost:5000/api/memories';

let memoriesById = new Map();
let confirmResolver = null;

function getUser() {
    try {
        const raw = localStorage.getItem('cuetUser');
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function enforceAdminAuth() {
    const user = getUser();
    if (!user || user.role !== 'admin') {
        alert('Admin access required.');
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function setupNavigation() {
    // Disable approval workflow sections in UI.
    document.querySelectorAll('[data-section="approved"], [data-section="rejected"]').forEach((el) => {
        el.style.display = 'none';
    });
    ['approved', 'rejected'].forEach((id) => {
        const section = document.getElementById(id);
        if (section) section.style.display = 'none';
    });

    document.querySelectorAll('.nav-item[data-section]').forEach((item) => {
        item.addEventListener('click', (event) => {
            event.preventDefault();
            const sectionId = item.dataset.section;

            document.querySelectorAll('.nav-item[data-section]').forEach((nav) => nav.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.content-section').forEach((section) => section.classList.remove('active'));
            const target = document.getElementById(sectionId);
            if (target) target.classList.add('active');
        });
    });
}

function setupSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menuToggle');
    const sidebarClose = document.getElementById('sidebarClose');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => sidebar.classList.add('open'));
    }

    if (sidebarClose && sidebar) {
        sidebarClose.addEventListener('click', () => sidebar.classList.remove('open'));
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toastMessage');
    if (!toast || !msg) return;
    msg.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
}

function getConfirmElements() {
    return {
        overlay: document.getElementById('adminConfirmOverlay'),
        title: document.getElementById('adminConfirmTitle'),
        message: document.getElementById('adminConfirmMessage'),
        close: document.getElementById('adminConfirmClose'),
        cancel: document.getElementById('adminConfirmCancel'),
        ok: document.getElementById('adminConfirmOk'),
    };
}

function closeConfirmModal(result) {
    const { overlay } = getConfirmElements();
    if (!overlay) return;

    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (confirmResolver) {
        confirmResolver(result);
        confirmResolver = null;
    }
}

function openConfirmModal({ title, message, okText = 'Continue' }) {
    const { overlay, title: titleEl, message: messageEl, ok } = getConfirmElements();
    if (!overlay || !titleEl || !messageEl || !ok) {
        return Promise.resolve(false);
    }

    titleEl.textContent = title || 'Confirm Action';
    messageEl.textContent = message || 'Are you sure you want to continue?';
    ok.textContent = okText;

    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    return new Promise((resolve) => {
        confirmResolver = resolve;
    });
}

function setupConfirmModal() {
    const { overlay, close, cancel, ok } = getConfirmElements();
    if (!overlay) return;

    if (close) close.addEventListener('click', () => closeConfirmModal(false));
    if (cancel) cancel.addEventListener('click', () => closeConfirmModal(false));
    if (ok) ok.addEventListener('click', () => closeConfirmModal(true));

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeConfirmModal(false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && overlay.classList.contains('active')) {
            closeConfirmModal(false);
        }
    });
}

function safeText(value, fallback = '') {
    if (value === undefined || value === null) return fallback;
    return String(value);
}

function formatDate(value) {
    if (!value) return 'N/A';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
}

async function apiGet(path) {
    const response = await fetch(`${API_BASE}${path}`);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Request failed');
    }
    return data;
}

async function apiDelete(path) {
    const response = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Request failed');
    }
    return data;
}

function updateDashboardStats(totalMemories, reportedMemories, totalReports) {
    const totalEl = document.getElementById('statTotalMemories');
    const reportedEl = document.getElementById('statPendingMemories');
    const reportsEl = document.getElementById('statApprovedMemories');
    const hiddenEl = document.getElementById('statRejectedMemories');
    const badge = document.getElementById('pendingNavBadge');

    if (totalEl) totalEl.textContent = String(totalMemories);
    if (reportedEl) reportedEl.textContent = String(reportedMemories);
    if (reportsEl) reportsEl.textContent = String(totalReports);
    if (hiddenEl) hiddenEl.textContent = '0';
    if (badge) badge.textContent = String(reportedMemories);

    const statLabels = document.querySelectorAll('.stat-info p');
    if (statLabels[0]) statLabels[0].textContent = 'Total Memories';
    if (statLabels[1]) statLabels[1].textContent = 'Reported Memories';
    if (statLabels[2]) statLabels[2].textContent = 'Total Reports';
    if (statLabels[3]) statLabels[3].textContent = 'Cleared Today';
}

function renderReportedMemories() {
    const grid = document.getElementById('pendingGrid');
    if (!grid) return;

    if (typeof ReportSync === 'undefined') {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><h3>Report system unavailable</h3></div>';
        return;
    }

    const reportedItems = ReportSync.getReportedMemories();
    const totalReports = reportedItems.reduce((sum, item) => sum + item.reports.length, 0);

    updateDashboardStats(memoriesById.size, reportedItems.length, totalReports);

    if (!reportedItems.length) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <h3>No reported memories</h3>
                <p>Everything looks clean right now.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = reportedItems.map((item) => {
        const memory = memoriesById.get(item.memoryId) || item.memorySnapshot || {};
        const imageUrl = memory.imageUrl || memory.image || null;
        const reportRows = item.reports.map((report) => `
            <div class="meta-item" style="display:block;">
                <strong>${safeText(report.reportedBy?.name, 'Unknown')}</strong>
                <span style="display:block; margin-top:3px;">${safeText(report.reason, 'No reason')}</span>
                <span style="display:block; opacity:0.75; margin-top:2px;">${formatDate(report.timestamp)}</span>
            </div>
        `).join('');

        return `
            <div class="memory-card" data-id="${item.memoryId}">
                <div class="memory-image ${imageUrl ? '' : 'no-image'}">
                    ${imageUrl ? `<img src="${imageUrl}" alt="${safeText(memory.title, 'Memory image')}">` : '<div class="placeholder-icon">📷</div>'}
                    <span class="memory-status pending">${item.reports.length} report${item.reports.length > 1 ? 's' : ''}</span>
                </div>
                <div class="memory-content">
                    <h3>${safeText(memory.title, 'Unknown memory')}</h3>
                    <p class="memory-story">${safeText(memory.description || memory.story, 'Memory content not found')}</p>
                    <div class="memory-meta">
                        <div class="meta-item"><span>ID: ${safeText(item.memoryId)}</span></div>
                        <div class="meta-item"><span>Reports: ${item.reports.length}</span></div>
                    </div>
                    <div style="margin-bottom: 1rem; border-top:1px solid rgba(148, 210, 189, 0.12); padding-top:0.75rem;">
                        ${reportRows}
                    </div>
                    <div class="memory-actions">
                        <button class="btn-delete" data-action="delete-memory" data-id="${item.memoryId}">Delete Memory</button>
                        <button class="btn-view" data-action="keep-memory" data-id="${item.memoryId}">Keep Memory</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function refreshMemoriesFromBackend() {
    const list = await apiGet('/all');
    const normalized = Array.isArray(list) ? list : [];
    memoriesById = new Map(normalized.map((memory) => [memory._id, memory]));
}

async function handleDeleteMemory(memoryId) {
    const confirmed = await openConfirmModal({
        title: 'Delete Memory',
        message: 'Delete this memory permanently? This action cannot be undone.',
        okText: 'Delete',
    });
    if (!confirmed) return;

    await apiDelete(`/admin/${memoryId}`);
    if (typeof ReportSync !== 'undefined') {
        ReportSync.clearReports(memoryId);
    }

    showToast('Memory deleted and reports removed.');
    await refreshMemoriesFromBackend();
    renderReportedMemories();
}

async function handleKeepMemory(memoryId) {
    const confirmed = await openConfirmModal({
        title: 'Keep Memory',
        message: 'Keep this memory and clear all reports?',
        okText: 'Keep',
    });
    if (!confirmed) return;

    if (typeof ReportSync !== 'undefined') {
        ReportSync.clearReports(memoryId);
    }

    showToast('Reports cleared. Memory kept.');
    renderReportedMemories();
}

function setupReportedActions() {
    document.body.addEventListener('click', async (event) => {
        const target = event.target.closest('[data-action][data-id]');
        if (!target) return;

        const action = target.dataset.action;
        const memoryId = target.dataset.id;
        if (!action || !memoryId) return;

        try {
            target.disabled = true;
            if (action === 'delete-memory') {
                await handleDeleteMemory(memoryId);
            } else if (action === 'keep-memory') {
                await handleKeepMemory(memoryId);
            }
        } catch (error) {
            console.error(error);
            if (error.name === 'TypeError' || /failed to fetch|network|offline/i.test(error.message || '')) {
                alert('Server Offline: Please make sure backend is running on http://localhost:5000.');
            } else {
                alert(error.message || 'Failed to complete admin action.');
            }
        } finally {
            target.disabled = false;
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!enforceAdminAuth()) return;

    setupNavigation();
    setupSidebarToggle();
    setupConfirmModal();
    setupReportedActions();

    try {
        await refreshMemoriesFromBackend();
        renderReportedMemories();

        if (typeof ReportSync !== 'undefined') {
            ReportSync.onSync(() => {
                renderReportedMemories();
            });
        }
    } catch (error) {
        console.error(error);
        if (error.name === 'TypeError' || /failed to fetch|network|offline/i.test(error.message || '')) {
            alert('Server Offline: Could not load reported memories.');
            return;
        }
        alert(error.message || 'Failed to load reported memories.');
    }
});
