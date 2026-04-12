// ============================================
// MEMORY SYNC MODULE
// Uses localStorage to sync shared memories
// across all pages (index map + share-memory map)
// ============================================

const MemorySync = (function () {
    const STORAGE_KEY = 'cuet_shared_memories';

    // Get all user-shared memories from localStorage
    function getSharedMemories() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error reading shared memories:', e);
            return [];
        }
    }

    // Save a new memory to localStorage
    function saveMemory(memory) {
        const memories = getSharedMemories();
        memory.id = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        memory.date = getRelativeTime(new Date());
        memory.timestamp = Date.now();
        memories.unshift(memory); // newest first
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));

        // Dispatch a custom event so other open tabs can react
        window.dispatchEvent(new CustomEvent('memoryAdded', { detail: memory }));

        // Also use storage event for cross-tab sync
        // (storage event fires automatically on other tabs)
        return memory;
    }

    // Delete a memory
    function deleteMemory(id) {
        let memories = getSharedMemories();
        memories = memories.filter(m => m.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
        window.dispatchEvent(new CustomEvent('memoryDeleted', { detail: { id } }));
    }

    // Get relative time string
    function getRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return 'Just now';
        if (minutes < 60) return `${minutes} min ago`;
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
        return date.toLocaleDateString();
    }

    // Listen for changes from other tabs
    function onSync(callback) {
        // Cross-tab sync via storage event
        window.addEventListener('storage', function (e) {
            if (e.key === STORAGE_KEY) {
                callback(getSharedMemories());
            }
        });

        // Same-tab sync via custom event
        window.addEventListener('memoryAdded', function (e) {
            callback(getSharedMemories());
        });

        window.addEventListener('memoryDeleted', function (e) {
            callback(getSharedMemories());
        });
    }

    return {
        getSharedMemories,
        saveMemory,
        deleteMemory,
        onSync
    };
})();

// ============================================
// REPORT SYNC MODULE
// Stores reported memories in localStorage and
// syncs updates across tabs.
// ============================================
const ReportSync = (function () {
    const STORAGE_KEY = 'cuet_reported_memories';

    function getReportedMemories() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Error reading reported memories:', e);
            return [];
        }
    }

    function saveReportedMemories(items) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        window.dispatchEvent(new CustomEvent('reportUpdated'));
    }

    function hasUserReported(memoryId, reporterId) {
        if (!memoryId || !reporterId) return false;
        const reports = getReportedMemories();
        const item = reports.find((r) => r.memoryId === memoryId);
        if (!item) return false;
        return item.reports.some((report) => report.reportedBy && report.reportedBy.id === reporterId);
    }

    function reportMemory({ memoryId, memorySnapshot, reportedBy, reason }) {
        if (!memoryId) {
            return { ok: false, message: 'Memory ID is required.' };
        }

        if (!reportedBy || !reportedBy.id || !reportedBy.name) {
            return { ok: false, message: 'Reporter identity is required.' };
        }

        const trimmedReason = (reason || '').trim();

        const reports = getReportedMemories();
        let item = reports.find((entry) => entry.memoryId === memoryId);

        if (!item) {
            item = {
                memoryId,
                memorySnapshot: memorySnapshot || null,
                reports: [],
                updatedAt: Date.now(),
            };
            reports.push(item);
        }

        const isDuplicate = item.reports.some((entry) => entry.reportedBy && entry.reportedBy.id === reportedBy.id);
        if (isDuplicate) {
            return { ok: false, message: 'You already reported this memory.' };
        }

        item.memorySnapshot = memorySnapshot || item.memorySnapshot;
        item.reports.push({
            reportId: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            reportedBy,
            reason: trimmedReason || 'No reason provided',
            timestamp: Date.now(),
        });
        item.updatedAt = Date.now();

        saveReportedMemories(reports);
        return { ok: true, message: 'Report submitted successfully.', item };
    }

    function clearReports(memoryId) {
        const reports = getReportedMemories().filter((item) => item.memoryId !== memoryId);
        saveReportedMemories(reports);
    }

    function getReportCount(memoryId) {
        const item = getReportedMemories().find((r) => r.memoryId === memoryId);
        return item ? item.reports.length : 0;
    }

    function onSync(callback) {
        window.addEventListener('storage', (e) => {
            if (e.key === STORAGE_KEY) {
                callback(getReportedMemories());
            }
        });

        window.addEventListener('reportUpdated', () => {
            callback(getReportedMemories());
        });
    }

    return {
        getReportedMemories,
        reportMemory,
        clearReports,
        getReportCount,
        hasUserReported,
        onSync,
    };
})();

// ============================================
// PROFILE SYNC MODULE
// Keeps user profile updates in sync across pages/tabs.
// ============================================
const ProfileSync = (function () {
    const STORAGE_KEY = 'cuetUser';

    function getProfile() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error('Error reading profile:', e);
            return null;
        }
    }

    function saveProfile(profilePatch) {
        const current = getProfile() || {};
        const updated = { ...current, ...profilePatch };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('profileUpdated', { detail: updated }));
        return updated;
    }

    function onSync(callback) {
        window.addEventListener('storage', (e) => {
            if (e.key === STORAGE_KEY) {
                callback(getProfile());
            }
        });

        window.addEventListener('profileUpdated', () => {
            callback(getProfile());
        });
    }

    return {
        getProfile,
        saveProfile,
        onSync,
    };
})();
