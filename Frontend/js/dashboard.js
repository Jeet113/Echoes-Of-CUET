const MAX_PROFILE_IMAGE_SIZE = 2 * 1024 * 1024;
const MAX_COVER_IMAGE_SIZE = 4 * 1024 * 1024;
const DEFAULT_COVER_IMAGE = 'Photos/Golchottor.jpg';
let dashboardUser = null;
let pendingProfileImageUrl = '';
let pendingCoverImageUrl = '';
let pendingProfileImageFile = null;
let pendingCoverImageFile = null;

function getUser() {
    try {
        const raw = localStorage.getItem('cuetUser');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function getAuthToken() {
    return localStorage.getItem('authToken') || '';
}

function getDisplayName(user) {
    if (!user) return 'CUET User';
    if (user.firstName || user.lastName) return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (user.name) return user.name;
    return user.email ? user.email.split('@')[0] : 'CUET User';
}

function getDefaultAvatarDataUri(name) {
    const initial = (name || 'U').trim().charAt(0).toUpperCase() || 'U';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%' height='100%' fill='%230A9396'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='white' font-family='Poppins, sans-serif' font-size='52' font-weight='700'>${initial}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getProfileImage(user) {
    return (user && user.profileImage) || getDefaultAvatarDataUri(getDisplayName(user));
}

function getCoverImage(user) {
    return (user && user.coverImage) || DEFAULT_COVER_IMAGE;
}

function setupMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.querySelector('.nav-links');
    if (!menuBtn || !navLinks) return;
    menuBtn.addEventListener('click', () => navLinks.classList.toggle('active'));
    navLinks.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => navLinks.classList.remove('active')));
}

function renderProfileHeader(user) {
    const name = getDisplayName(user);
    const bio = (user.bio || '').trim() || 'Add your bio to tell your CUET story.';
    const avatar = getProfileImage(user);

    const profileName = document.getElementById('dashProfileName');
    const profileBio = document.getElementById('dashProfileBio');
    const profileImage = document.getElementById('dashProfileImage');
    const navAvatar = document.getElementById('dashNavAvatar');
    const coverImage = document.getElementById('dashCoverImage');
    const currentCover = getCoverImage(user);

    if (profileName) profileName.textContent = name;
    if (profileBio) profileBio.textContent = bio;
    if (profileImage) {
        profileImage.src = avatar;
        profileImage.onerror = function () {
            this.src = getDefaultAvatarDataUri(name);
        };
    }
    if (navAvatar) {
        navAvatar.src = avatar;
        navAvatar.onerror = function () {
            this.src = getDefaultAvatarDataUri(name);
        };
    }
    if (coverImage) {
        coverImage.src = currentCover;
        coverImage.onerror = function () {
            this.src = DEFAULT_COVER_IMAGE;
        };
    }

    const dashName = document.getElementById('dashName');
    const dashEmail = document.getElementById('dashEmail');
    const dashDept = document.getElementById('dashDept');
    const dashBatch = document.getElementById('dashBatch');
    if (dashName) dashName.textContent = name;
    if (dashEmail) dashEmail.textContent = user.email || '-';
    if (dashDept) dashDept.textContent = user.department || user.dept || '-';
    if (dashBatch) dashBatch.textContent = user.batch || '-';
}

function mapApiMemory(memory) {
    return {
        id: memory._id,
        title: memory.title || 'Untitled',
        description: memory.description || 'No description',
        imageUrl: memory.imageUrl || null,
        category: memory.category || 'general',
        lat: Number(memory.lat),
        lng: Number(memory.lng),
        createdAt: memory.createdAt || null,
        userId: memory.userId || '',
        userName: memory.userName || 'CUET User',
        userProfileImage: memory.userProfileImage || '',
    };
}

function isMyMemory(memory, user) {
    const userId = String(user._id || user.id || user.email || '');
    return memory.userId && userId && String(memory.userId) === userId;
}

function renderPosts(memories, user) {
    const list = document.getElementById('dashRecentPosts');
    const empty = document.getElementById('dashNoPosts');
    if (!list) return;

    list.innerHTML = '';
    if (!memories.length) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');

    memories.slice(0, 12).forEach((memory) => {
        const card = document.createElement('div');
        const avatar = memory.userProfileImage || getProfileImage(user);
        card.className = 'dash-post';
        card.innerHTML = `
            <div class="dash-post-user">
                <img src="${avatar}" alt="${memory.userName}" onerror="this.src='${getDefaultAvatarDataUri(memory.userName)}'">
                <div>
                    <h4>${memory.userName}</h4>
                    <p>${memory.createdAt ? new Date(memory.createdAt).toLocaleDateString() : 'Recently shared'}</p>
                </div>
            </div>
            <h4>${memory.title}</h4>
            <p>${memory.description}</p>
            <p>${memory.category} • ${Number.isFinite(memory.lat) && Number.isFinite(memory.lng) ? `${memory.lat.toFixed(4)}, ${memory.lng.toFixed(4)}` : 'No coordinates'}</p>
        `;
        list.appendChild(card);
    });
}

async function fetchAndRenderDashboardMemories(user) {
    const myCount = document.getElementById('dashMyMemoryCount');
    const communityCount = document.getElementById('dashCommunityCount');

    try {
        const response = await fetch('https://echoes-of-cuet-1.onrender.com/api/memories/all');
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to load memories');

        const allMemories = (Array.isArray(data) ? data : []).map(mapApiMemory);
        const myMemories = allMemories.filter((m) => isMyMemory(m, user));

        if (myCount) myCount.textContent = String(myMemories.length);
        if (communityCount) communityCount.textContent = String(allMemories.length);

        renderPosts(myMemories, user);
    } catch (error) {
        console.error(error);
        alert('Server Offline: Could not load dashboard memories.');
    }
}

function openProfileModal() {
    const overlay = document.getElementById('profileModalOverlay');
    const nameInput = document.getElementById('profileNameInput');
    const bioInput = document.getElementById('profileBioInput');
    const departmentInput = document.getElementById('profileDepartmentInput');
    const batchInput = document.getElementById('profileBatchInput');
    const preview = document.getElementById('profileModalPreview');
    const coverPreview = document.getElementById('profileCoverPreview');

    if (!overlay || !dashboardUser) return;

    pendingProfileImageUrl = dashboardUser.profileImage || '';
    pendingCoverImageUrl = dashboardUser.coverImage || '';
    pendingProfileImageFile = null;
    pendingCoverImageFile = null;

    if (nameInput) nameInput.value = getDisplayName(dashboardUser);
    if (bioInput) bioInput.value = dashboardUser.bio || '';
    if (departmentInput) departmentInput.value = dashboardUser.department || dashboardUser.dept || '';
    if (batchInput) batchInput.value = dashboardUser.batch || '';
    if (preview) preview.src = getProfileImage(dashboardUser);
    if (coverPreview) {
        coverPreview.src = pendingCoverImageUrl || DEFAULT_COVER_IMAGE;
        coverPreview.onerror = function () {
            this.src = DEFAULT_COVER_IMAGE;
        };
    }

    const profileInput = document.getElementById('profileImageInput');
    const coverInput = document.getElementById('coverImageInput');
    if (profileInput) profileInput.value = '';
    if (coverInput) coverInput.value = '';

    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeProfileModal() {
    const overlay = document.getElementById('profileModalOverlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function resizeImageToDataUrl(file, maxSize = 512) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function uploadImageToCloudinary(file, kind) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('kind', kind);

    const response = await fetch('https://echoes-of-cuet-1.onrender.com/api/memories/upload-image', {
        method: 'POST',
        body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Failed to upload image.');
    }

    return data.url;
}

function setupProfileEditor() {
    const openBtn = document.getElementById('openEditProfileBtn');
    const openCoverBtn = document.getElementById('openEditCoverBtn');
    const avatarTrigger = document.getElementById('profileAvatarTrigger');
    const overlay = document.getElementById('profileModalOverlay');
    const closeBtn = document.getElementById('profileModalClose');
    const cancelBtn = document.getElementById('profileCancelBtn');
    const saveBtn = document.getElementById('profileSaveBtn');
    const imageInput = document.getElementById('profileImageInput');
    const coverInput = document.getElementById('coverImageInput');
    const preview = document.getElementById('profileModalPreview');
    const coverPreview = document.getElementById('profileCoverPreview');

    if (openBtn) openBtn.addEventListener('click', openProfileModal);
    if (openCoverBtn) {
        openCoverBtn.addEventListener('click', () => {
            openProfileModal();
            if (coverInput) {
                setTimeout(() => coverInput.click(), 80);
            }
        });
    }
    if (avatarTrigger) avatarTrigger.addEventListener('click', openProfileModal);
    if (closeBtn) closeBtn.addEventListener('click', closeProfileModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeProfileModal);

    if (overlay) {
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) closeProfileModal();
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && overlay && overlay.classList.contains('active')) {
            closeProfileModal();
        }
    });

    if (imageInput) {
        imageInput.addEventListener('change', async (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                alert('Please choose an image file.');
                imageInput.value = '';
                return;
            }
            if (file.size > MAX_PROFILE_IMAGE_SIZE) {
                alert('Profile image must be under 2MB.');
                imageInput.value = '';
                return;
            }

            try {
                const resized = await resizeImageToDataUrl(file, 512);
                pendingProfileImageFile = file;
                pendingProfileImageUrl = resized;
                if (preview) preview.src = resized;
            } catch (e) {
                alert('Failed to process profile image. Please try another one.');
            }
        });
    }

    if (coverInput) {
        coverInput.addEventListener('change', async (event) => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                alert('Please choose an image file.');
                coverInput.value = '';
                return;
            }
            if (file.size > MAX_COVER_IMAGE_SIZE) {
                alert('Cover image must be under 4MB.');
                coverInput.value = '';
                return;
            }

            try {
                const resized = await resizeImageToDataUrl(file, 1400);
                pendingCoverImageFile = file;
                pendingCoverImageUrl = resized;
                if (coverPreview) coverPreview.src = resized;
            } catch (e) {
                alert('Failed to process cover image. Please try another one.');
            }
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const nameInput = document.getElementById('profileNameInput');
            const bioInput = document.getElementById('profileBioInput');
            const departmentInput = document.getElementById('profileDepartmentInput');
            const batchInput = document.getElementById('profileBatchInput');

            const fullName = (nameInput?.value || '').trim();
            if (!fullName) {
                alert('Name is required.');
                return;
            }

            let profileImageUrl = dashboardUser.profileImage || '';
            let coverImageUrl = dashboardUser.coverImage || '';

            try {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';

                if (pendingProfileImageFile) {
                    profileImageUrl = await uploadImageToCloudinary(pendingProfileImageFile, 'profile');
                }
                if (pendingCoverImageFile) {
                    coverImageUrl = await uploadImageToCloudinary(pendingCoverImageFile, 'cover');
                }
            } catch (error) {
                alert(error.message || 'Failed to upload profile images.');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Profile';
                return;
            }

            const patch = {
                name: fullName,
                bio: (bioInput?.value || '').trim(),
                department: (departmentInput?.value || '').trim(),
                batch: (batchInput?.value || '').trim(),
                profileImage: profileImageUrl,
                coverImage: coverImageUrl,
            };

            try {
                const token = getAuthToken();
                if (!token) {
                    throw new Error('Please log in again to update profile.');
                }

                const response = await fetch('https://echoes-of-cuet-1.onrender.com/api/auth/profile', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(patch),
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to update profile.');
                }

                const updatedUser = {
                    ...dashboardUser,
                    ...(data.user || {}),
                    role: dashboardUser.role || 'user',
                };

                if (typeof ProfileSync !== 'undefined') {
                    dashboardUser = ProfileSync.saveProfile(updatedUser);
                } else {
                    dashboardUser = updatedUser;
                    localStorage.setItem('cuetUser', JSON.stringify(dashboardUser));
                }

                renderProfileHeader(dashboardUser);
                closeProfileModal();
            } catch (error) {
                alert(error.message || 'Failed to save profile.');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Profile';
            }
        });
    }
}

async function refreshUserFromServer() {
    const token = getAuthToken();
    if (!token) return null;

    const response = await fetch('https://echoes-of-cuet-1.onrender.com/api/auth/me', {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const data = await response.json();
    if (!response.ok || !data.user) {
        throw new Error(data.message || 'Failed to load profile.');
    }

    const current = getUser() || {};
    const merged = {
        ...current,
        ...data.user,
        role: current.role || 'user',
    };

    if (typeof ProfileSync !== 'undefined') {
        return ProfileSync.saveProfile(merged);
    }

    localStorage.setItem('cuetUser', JSON.stringify(merged));
    return merged;
}

document.addEventListener('DOMContentLoaded', () => {
    setupMobileMenu();
    setupProfileEditor();

    dashboardUser = getUser();
    if (!dashboardUser) {
        window.location.href = 'login.html';
        return;
    }

    if (dashboardUser.role === 'admin') {
        window.location.href = 'admin.html';
        return;
    }

    renderProfileHeader(dashboardUser);
    fetchAndRenderDashboardMemories(dashboardUser);

    refreshUserFromServer()
        .then((freshUser) => {
            if (!freshUser) return;
            dashboardUser = freshUser;
            renderProfileHeader(dashboardUser);
            fetchAndRenderDashboardMemories(dashboardUser);
        })
        .catch((error) => {
            console.error(error);
        });

    const logoutBtn = document.getElementById('dashboardLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('cuetUser');
            localStorage.setItem('isLoggedIn', 'false');
            window.location.href = 'index.html';
        });
    }

    if (typeof MemorySync !== 'undefined') {
        MemorySync.onSync(() => {
            dashboardUser = getUser() || dashboardUser;
            renderProfileHeader(dashboardUser);
            fetchAndRenderDashboardMemories(dashboardUser);
        });
    }

    if (typeof ProfileSync !== 'undefined') {
        ProfileSync.onSync((user) => {
            if (!user) return;
            dashboardUser = user;
            renderProfileHeader(dashboardUser);
            fetchAndRenderDashboardMemories(dashboardUser);
        });
    }
});
