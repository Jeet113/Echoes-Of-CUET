const MEMORY_API_BASE = 'https://echoes-of-cuet-1.onrender.com/api/memories';
const AUTH_API_BASE = 'https://echoes-of-cuet-1.onrender.com/api/auth';

let memories = [];
let users = [];
let confirmResolver = null;

function getUser() {
    try {
        const raw = localStorage.getItem('cuetUser');
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function getToken() {
    return localStorage.getItem('authToken') || '';
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

function authHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    };
}

async function apiGet(url, useAuth = false) {
    const response = await fetch(url, {
        headers: useAuth ? authHeaders() : undefined,
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Request failed');
    }

    return data;
}

async function apiPatch(url, body = {}, useAuth = false) {
    const response = await fetch(url, {
        method: 'PATCH',
        headers: useAuth ? authHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Request failed');
    }

    return data;
}

async function apiDelete(url, useAuth = false) {
    const response = await fetch(url, {
        method: 'DELETE',
        headers: useAuth ? authHeaders() : undefined,
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Request failed');
    }

    return data;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toastMessage');
    if (!toast || !msg) return;
    msg.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
}

function setupNavigation() {
    document.querySelectorAll('[data-section="approved"], [data-section="rejected"], [data-section="settings"]').forEach((el) => {
        el.style.display = 'none';
    });

    ['approved', 'rejected', 'settings'].forEach((id) => {
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
}

function updateHeaderAdmin() {
    const user = getUser();
    if (!user) return;

    const nameEl = document.querySelector('.user-name');
    const avatarEl = document.querySelector('.user-avatar');

    if (nameEl) nameEl.textContent = user.name || 'Admin';
    if (avatarEl) {
        const initials = (user.name || 'Admin')
            .split(' ')
            .map((part) => part.charAt(0))
            .join('')
            .slice(0, 2)
            .toUpperCase();
        avatarEl.textContent = initials || 'AD';
    }
}

function formatDate(value) {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString();
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function updateDashboardStats() {
    const totalMemories = memories.length;
    const totalUsers = users.filter((user) => user.role !== 'admin').length;
    const reportedMemories = memories.filter((memory) => Array.isArray(memory.reports) && memory.reports.length > 0).length;
    const totalReports = memories.reduce((sum, memory) => sum + (Array.isArray(memory.reports) ? memory.reports.length : 0), 0);

    const totalEl = document.getElementById('statTotalMemories');
    const reportedEl = document.getElementById('statPendingMemories');
    const usersEl = document.getElementById('statApprovedMemories');
    const reportsEl = document.getElementById('statRejectedMemories');
    const badge = document.getElementById('pendingNavBadge');

    if (totalEl) totalEl.textContent = String(totalMemories);
    if (reportedEl) reportedEl.textContent = String(reportedMemories);
    if (usersEl) usersEl.textContent = String(totalUsers);
    if (reportsEl) reportsEl.textContent = String(totalReports);
    if (badge) badge.textContent = String(reportedMemories);

    const statLabels = document.querySelectorAll('.stat-info p');
    if (statLabels[0]) statLabels[0].textContent = 'Total Memories';
    if (statLabels[1]) statLabels[1].textContent = 'Reported Memories';
    if (statLabels[2]) statLabels[2].textContent = 'Registered Users';
    if (statLabels[3]) statLabels[3].textContent = 'Total Reports';
}

function renderRecentActivity() {
    const list = document.getElementById('adminActivityList');
    if (!list) return;

    const rows = memories
        .slice()
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 8);

    if (!rows.length) {
        list.innerHTML = '<div class="empty-state"><h3>No activity yet</h3><p>Memories will appear here once users start posting.</p></div>';
        return;
    }

    list.innerHTML = rows
        .map((memory) => {
            const reportsCount = Array.isArray(memory.reports) ? memory.reports.length : 0;
            const reportBadge = reportsCount > 0 ? `<span style="color:#ff9b9b;"> � ${reportsCount} report${reportsCount > 1 ? 's' : ''}</span>` : '';

            return `
                <div class="activity-item">
                    <div class="activity-icon new">??</div>
                    <div class="activity-content">
                        <p><strong>${escapeHtml(memory.userName || 'CUET User')}</strong> posted <strong>${escapeHtml(memory.title || 'Untitled')}</strong>${reportBadge}</p>
                        <span>${escapeHtml(formatDate(memory.createdAt))}</span>
                    </div>
                </div>
            `;
        })
        .join('');
}

function renderPopularLocations() {
    const list = document.getElementById('adminLocationList');
    if (!list) return;

    const grouped = new Map();
    memories.forEach((memory) => {
        const key = String(memory.title || 'Untitled').trim() || 'Untitled';
        grouped.set(key, (grouped.get(key) || 0) + 1);
    });

    const items = Array.from(grouped.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (!items.length) {
        list.innerHTML = '<div class="empty-state"><h3>No location data</h3><p>Location trends will appear after memories are added.</p></div>';
        return;
    }

    const max = items[0][1] || 1;

    list.innerHTML = items
        .map(([name, count], index) => {
            const width = Math.max(8, Math.round((count / max) * 100));
            return `
                <div class="location-item">
                    <div class="location-rank">${index + 1}</div>
                    <div class="location-info">
                        <h4>${escapeHtml(name)}</h4>
                        <div class="location-bar">
                            <div class="bar-fill" style="width: ${width}%"></div>
                        </div>
                    </div>
                    <span class="location-count">${count}</span>
                </div>
            `;
        })
        .join('');
}

function renderReportedMemories() {
    const grid = document.getElementById('pendingGrid');
    if (!grid) return;

    const reported = memories
        .filter((memory) => Array.isArray(memory.reports) && memory.reports.length > 0)
        .sort((a, b) => (b.reports?.length || 0) - (a.reports?.length || 0));

    if (!reported.length) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <h3>No reported memories</h3>
                <p>Everything looks clean right now.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = reported
        .map((memory) => {
            const reports = Array.isArray(memory.reports) ? memory.reports : [];
            const imageUrl = memory.imageUrl || '';
            const reportRows = reports
                .map((report) => `
                    <div class="meta-item" style="display:block;">
                        <strong>${escapeHtml(report.userName || 'Unknown')}</strong>
                        <span style="display:block; margin-top:3px;">${escapeHtml(report.reason || 'No reason')}</span>
                        <span style="display:block; opacity:0.75; margin-top:2px;">${escapeHtml(formatDate(report.at))}</span>
                    </div>
                `)
                .join('');

            return `
                <div class="memory-card" data-id="${memory._id}">
                    <div class="memory-image ${imageUrl ? '' : 'no-image'}">
                        ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(memory.title || 'Memory image')}">` : '<div class="placeholder-icon">??</div>'}
                        <span class="memory-status pending">${reports.length} report${reports.length > 1 ? 's' : ''}</span>
                    </div>
                    <div class="memory-content">
                        <h3>${escapeHtml(memory.title || 'Untitled memory')}</h3>
                        <p class="memory-story">${escapeHtml(memory.description || 'No description')}</p>
                        <div class="memory-meta">
                            <div class="meta-item"><span>Author: ${escapeHtml(memory.userName || 'CUET User')}</span></div>
                            <div class="meta-item"><span>Posted: ${escapeHtml(formatDate(memory.createdAt))}</span></div>
                        </div>
                        <div style="margin-bottom: 1rem; border-top:1px solid rgba(148, 210, 189, 0.12); padding-top:0.75rem;">
                            ${reportRows}
                        </div>
                        <div class="memory-actions">
                            <button class="btn-delete" data-action="delete-memory" data-id="${memory._id}">Delete Memory</button>
                            <button class="btn-view" data-action="keep-memory" data-id="${memory._id}">Keep Memory</button>
                        </div>
                    </div>
                </div>
            `;
        })
        .join('');
}

function renderUsersTable() {
    const body = document.getElementById('adminUsersTableBody');
    if (!body) return;

    const regularUsers = users.filter((user) => user.role !== 'admin');

    if (!regularUsers.length) {
        body.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; color:#94d2bd; padding:1rem;">No registered users found.</td>
            </tr>
        `;
        return;
    }

    body.innerHTML = regularUsers
        .map((user) => {
            const initials = (user.name || 'U')
                .split(' ')
                .map((part) => part.charAt(0))
                .join('')
                .slice(0, 2)
                .toUpperCase();

            return `
                <tr>
                    <td>
                        <div class="user-cell">
                            <div class="user-avatar-sm">${escapeHtml(initials || 'U')}</div>
                            <span>${escapeHtml(user.name || 'CUET User')}</span>
                        </div>
                    </td>
                    <td>${escapeHtml(user.email || '-')}</td>
                    <td>${escapeHtml(user.department || '-')}</td>
                    <td>${escapeHtml(user.batch || '-')}</td>
                    <td><span class="count-badge">${Number(user.memoryCount || 0)}</span></td>
                    <td>${escapeHtml(formatDate(user.createdAt))}</td>
                </tr>
            `;
        })
        .join('');
}

async function refreshAllData() {
    const [memoryList, userData] = await Promise.all([
        apiGet(`${MEMORY_API_BASE}/all`),
        apiGet(`${AUTH_API_BASE}/admin/users`, true),
    ]);

    memories = Array.isArray(memoryList) ? memoryList : [];
    users = Array.isArray(userData?.users) ? userData.users : [];
}

async function handleDeleteMemory(memoryId) {
    const confirmed = await openConfirmModal({
        title: 'Delete Memory',
        message: 'Delete this memory permanently? This action cannot be undone.',
        okText: 'Delete',
    });
    if (!confirmed) return;

    await apiDelete(`${MEMORY_API_BASE}/admin/${memoryId}`);
    showToast('Memory deleted successfully.');
    await refreshAllData();
    renderAll();
}

async function handleKeepMemory(memoryId) {
    const confirmed = await openConfirmModal({
        title: 'Keep Memory',
        message: 'Keep this memory and clear all reports?',
        okText: 'Keep',
    });
    if (!confirmed) return;

    await apiPatch(`${MEMORY_API_BASE}/admin/${memoryId}/clear-reports`);
    showToast('Reports cleared. Memory kept.');
    await refreshAllData();
    renderAll();
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
            if (/access denied|forbidden|expired|token/i.test(error.message || '')) {
                alert('Admin session expired. Please login again.');
                window.location.href = 'login.html';
                return;
            }
            if (error.name === 'TypeError' || /failed to fetch|network|offline/i.test(error.message || '')) {
                alert('Server Offline: Please make sure backend is running on https://echoes-of-cuet-1.onrender.com.');
            } else {
                alert(error.message || 'Failed to complete admin action.');
            }
        } finally {
            target.disabled = false;
        }
    });
}

function renderAll() {
    updateDashboardStats();
    renderRecentActivity();
    renderPopularLocations();
    renderReportedMemories();
    renderUsersTable();
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!enforceAdminAuth()) return;

    setupNavigation();
    setupSidebarToggle();
    setupConfirmModal();
    setupReportedActions();
    updateHeaderAdmin();

    try {
        await refreshAllData();
        renderAll();
    } catch (error) {
        console.error(error);
        if (/access denied|forbidden|expired|token/i.test(error.message || '')) {
            alert('Admin session expired. Please login again.');
            window.location.href = 'login.html';
            return;
        }
        if (error.name === 'TypeError' || /failed to fetch|network|offline/i.test(error.message || '')) {
            alert('Server Offline: Could not load admin dashboard data.');
            return;
        }
        alert(error.message || 'Failed to load admin dashboard data.');
    }
});
