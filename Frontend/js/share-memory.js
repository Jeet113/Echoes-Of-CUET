// ============================================
// SHARE MEMORY PAGE — Redesigned JS
// 3-step wizard with validation & preview
// ============================================

let shareMap;
let shareSelectedLocation = null;
let shareMarkers = [];
let shareInfoWindow = null;
let currentStep = 1;
let uploadedImageData = null; // base64 string of uploaded photo
let recentApiMemories = [];

function getSharePageUser() {
    try {
        const raw = localStorage.getItem('cuetUser');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function enforceShareLogin() {
    const user = getSharePageUser();
    if (!user) {
        alert('Login required to share your memory');
        window.location.href = 'login.html';
        return null;
    }
    return user;
}

// CUET Campus coordinates
const CUET_CENTER = { lat: 22.4625, lng: 91.9703 };
const CUET_BOUNDS = {
    north: 22.469778,
    south: 22.458389,
    west: 91.963444,
    east: 91.980000
};

// Default / sample memories
const defaultMemories = [
    {
        lng: 91.9710, lat: 22.4615,
        title: "Late Night Library Sessions",
        story: "Countless nights spent at the Central Library preparing for exams. The quiet atmosphere, the smell of old books, and the company of friends studying together - these are memories I'll cherish forever.",
        image: "https://via.placeholder.com/400x200/005F73/FFFFFF?text=Central+Library",
        author: "Ahmed Khan", dept: "CSE 2021", date: "2 hours ago", featured: true
    },
    {
        lng: 91.9718, lat: 22.4604,
        title: "First Day at Zero Point",
        story: "Standing at Zero Point on my first day, looking at the beautiful campus, I knew this place would become my second home.",
        image: null,
        author: "Fatima Rahman", dept: "EEE 2022", date: "5 hours ago", featured: false
    },
    {
        lng: 91.9725, lat: 22.4595,
        title: "Cafeteria Chai Breaks",
        story: "The cafeteria wasn't just about food - it was where friendships were forged over tea and samosas.",
        image: "https://via.placeholder.com/400x200/0A9396/FFFFFF?text=Cafeteria",
        author: "Rashed Islam", dept: "ME 2020", date: "1 day ago", featured: true
    },
    {
        lng: 91.9705, lat: 22.4620,
        title: "Shaheed Minar Remembrance",
        story: "Every year on 21st February, we gather at the Shaheed Minar to pay our respects.",
        image: "https://via.placeholder.com/400x200/94D2BD/001219?text=Shaheed+Minar",
        author: "Nusrat Jahan", dept: "ARCH 2023", date: "2 days ago", featured: false
    },
    {
        lng: 91.9715, lat: 22.4590,
        title: "Cricket Field Victory",
        story: "Our department won the inter-department cricket tournament here! The energy, the cheers, the celebration.",
        image: null,
        author: "Tanvir Ahmed", dept: "IPE 2019", date: "1 week ago", featured: true
    },
    {
        lng: 91.9700, lat: 22.4635,
        title: "Hostel Night Tales",
        story: "The hostel was more than just a place to sleep. Midnight discussions, birthday celebrations, and shared struggles.",
        image: "https://via.placeholder.com/400x200/EE9B00/001219?text=Hostel+Life",
        author: "Masud Rana", dept: "CE 2022", date: "3 days ago", featured: false
    }
];

// ============================================
// STEP NAVIGATION
// ============================================
function goToStep(step) {
    if (step < 1 || step > 3) return;

    // Hide all panels
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));

    // Show target panel
    const target = document.getElementById('stepPanel' + step);
    if (target) target.classList.add('active');

    // Update progress bar
    document.querySelectorAll('.step-item').forEach(item => {
        const s = parseInt(item.dataset.step);
        item.classList.remove('active', 'completed');
        if (s < step) item.classList.add('completed');
        else if (s === step) item.classList.add('active');
    });

    // Update connectors
    const c1 = document.getElementById('connector1');
    const c2 = document.getElementById('connector2');
    if (c1) c1.classList.toggle('filled', step > 1);
    if (c2) c2.classList.toggle('filled', step > 2);

    currentStep = step;

    // Populate preview when entering step 3
    if (step === 3) populatePreview();

    // Mobile sticky submit visibility
    updateMobileStickyVisibility();

    // Trigger resize when step 1 becomes visible
    if (step === 1 && shareMap) {
        setTimeout(() => {
            google.maps.event.trigger(shareMap, 'resize');
            shareMap.setCenter(CUET_CENTER);
        }, 100);
    }

    // Scroll to top of wizard area
    const progressSection = document.querySelector('.step-progress-section');
    if (progressSection) {
        progressSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function updateMobileStickyVisibility() {
    const el = document.getElementById('mobileStickySubmit');
    if (!el) return;
    if (currentStep === 3 && window.innerWidth <= 900) {
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

// ============================================
// INITIALIZE MAP
// ============================================
function initShareMap() {
    if (!window.google || !window.google.maps) {
        return;
    }

    const mapEl = document.getElementById('share-map');
    if (!mapEl) {
        return;
    }

    shareMap = new google.maps.Map(mapEl, {
        center: CUET_CENTER,
        zoom: 16,
        minZoom: 15,
        maxZoom: 20,
        restriction: {
            latLngBounds: CUET_BOUNDS,
            strictBounds: false
        },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: 'greedy',
        clickableIcons: false
    });

    shareInfoWindow = new google.maps.InfoWindow();

    addAllMarkers();

    shareMap.addListener('click', function (e) {
        onShareMapClick(e);
    });

    setTimeout(() => {
        google.maps.event.trigger(shareMap, 'resize');
        shareMap.setCenter(CUET_CENTER);
    }, 100);
}

// ============================================
// MARKER ICON CREATION
// ============================================
function createShareMarkerIcon(featured = false) {
    return {
        path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
        fillColor: featured ? '#EE9B00' : '#0A9396',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeOpacity: 0.95,
        strokeWeight: 1.8,
        scale: featured ? 1.95 : 1.75,
        anchor: new google.maps.Point(12, 22)
    };
}

// ============================================
// ADD ALL MARKERS (default + synced)
// ============================================
function addAllMarkers() {
    if (!shareMap) return;

    shareMarkers.forEach(m => m.setMap(null));
    shareMarkers = [];

    defaultMemories.forEach(memory => {
        const marker = new google.maps.Marker({
            position: { lat: memory.lat, lng: memory.lng },
            map: shareMap,
            title: memory.title,
            icon: createShareMarkerIcon(memory.featured),
            optimized: true
        });
        marker.addListener('click', () => showSharePopup(memory, marker));
        shareMarkers.push(marker);
    });

    // Add memories loaded from backend in this browser session.
    recentApiMemories.forEach(memory => addSharedMarker(memory));
}

function addSharedMarker(memory) {
    if (!shareMap) return;

    const marker = new google.maps.Marker({
        position: { lat: memory.lat, lng: memory.lng },
        map: shareMap,
        title: memory.title,
        icon: createShareMarkerIcon(memory.featured),
        optimized: true
    });
    marker.addListener('click', () => showSharePopup(memory, marker));
    shareMarkers.push(marker);
}

// ============================================
// MAP POPUP ON MARKER CLICK
// ============================================
function showSharePopup(memory, marker) {
    const storyText = memory.story || memory.description || '';
    const imageSrc = memory.image || memory.imageUrl || null;

    let popupHTML = `<div style="min-width:220px; font-family: 'Poppins', sans-serif;">`;
    if (imageSrc) {
        popupHTML += `<img src="${imageSrc}" style="width:100%; height:120px; object-fit:cover; border-radius:8px 8px 0 0; margin-bottom:8px;" onerror="this.style.display='none'">`;
    }
    popupHTML += `
        <div style="padding: 4px 8px 8px;">
            <strong style="font-size:1rem; color:#001219;">${memory.title}</strong>
            ${memory.featured ? '<span style="background:#EE9B00; color:white; font-size:0.7rem; padding:2px 8px; border-radius:10px; margin-left:6px;">⭐ Featured</span>' : ''}
            <p style="font-size:0.85rem; color:#333; margin:6px 0; line-height:1.5;">${storyText.length > 120 ? storyText.substring(0, 120) + '...' : storyText}</p>
            <div style="font-size:0.78rem; color:#666; border-top:1px solid #eee; padding-top:6px; margin-top:6px;">
                👤 ${memory.author} • ${memory.dept}<br>🕐 ${memory.date}
            </div>
        </div>
    </div>`;
    if (!shareInfoWindow) {
        shareInfoWindow = new google.maps.InfoWindow();
    }
    shareInfoWindow.setContent(popupHTML);
    shareInfoWindow.open({ map: shareMap, anchor: marker });
}

// ============================================
// MAP CLICK — SELECT LOCATION
// ============================================
function onShareMapClick(e) {
    if (!e || !e.latLng) {
        return;
    }

    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    if (lat < CUET_BOUNDS.south || lat > CUET_BOUNDS.north ||
        lng < CUET_BOUNDS.west || lng > CUET_BOUNDS.east) return;

    // Remove old selection marker
    if (shareSelectedLocation && shareSelectedLocation.marker) {
        shareSelectedLocation.marker.setMap(null);
    }

    const marker = new google.maps.Marker({
        position: { lat, lng },
        map: shareMap,
        title: 'Selected location',
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#2ECC71',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeOpacity: 0.95,
            strokeWeight: 3,
            scale: 8
        },
        optimized: true
    });

    shareSelectedLocation = { lat, lng, marker };

    // Update location status
    const statusEl = document.getElementById('share-location-status');
    const textEl = document.getElementById('share-location-text');
    if (statusEl) statusEl.classList.add('selected');
    if (textEl) textEl.textContent = `📍 ${lat.toFixed(6)}°N, ${lng.toFixed(6)}°E`;

    // Show confirmation toast on map
    showMapConfirmToast(lat, lng);

    // Enable continue button
    const btnNext = document.getElementById('btnToStep2');
    if (btnNext) btnNext.disabled = false;
}

function showMapConfirmToast(lat, lng) {
    const toast = document.getElementById('mapConfirmToast');
    const text = document.getElementById('mapConfirmText');
    if (!toast) return;

    if (text) text.textContent = `Location: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
    toast.classList.remove('hidden');
    toast.classList.add('visible');

    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
        toast.classList.remove('visible');
        toast.classList.add('hidden');
    }, 3500);
}

// ============================================
// FORM VALIDATION — Floating Labels
// ============================================
const validationRules = {
    'share-author': { min: 2, max: 60, label: 'Name' },
    'share-dept':   { min: 2, max: 60, label: 'Department' },
    'share-title':  { min: 3, max: 120, label: 'Title' },
    'share-story':  { min: 10, max: 1000, label: 'Story' }
};

function validateField(id) {
    const el = document.getElementById(id);
    if (!el) return false;

    const rules = validationRules[id];
    if (!rules) return true;

    const val = el.value.trim();
    const group = el.closest('.floating-group');
    const errEl = document.getElementById('err-' + id.replace('share-', ''));

    // Clear previous state
    if (group) {
        group.classList.remove('valid', 'invalid');
    }

    if (val.length === 0) {
        // Empty — show nothing, just remove classes
        if (errEl) errEl.textContent = '';
        return false;
    }

    if (val.length < rules.min) {
        if (group) group.classList.add('invalid');
        if (errEl) errEl.textContent = `${rules.label} must be at least ${rules.min} characters`;
        return false;
    }

    if (val.length > rules.max) {
        if (group) group.classList.add('invalid');
        if (errEl) errEl.textContent = `${rules.label} must be under ${rules.max} characters`;
        return false;
    }

    // Valid
    if (group) group.classList.add('valid');
    if (errEl) errEl.textContent = '';
    return true;
}

function checkStep2Ready() {
    const allValid = Object.keys(validationRules).every(id => validateField(id));
    const btn = document.getElementById('btnToStep3');
    if (btn) btn.disabled = !allValid;
}

function setupFormValidation() {
    Object.keys(validationRules).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                validateField(id);
                checkStep2Ready();
            });
            el.addEventListener('blur', () => {
                validateField(id);
                checkStep2Ready();
            });
        }
    });

    // Character counter for story
    const storyEl = document.getElementById('share-story');
    const charCount = document.getElementById('storyCharCount');
    if (storyEl && charCount) {
        storyEl.addEventListener('input', () => {
            const len = storyEl.value.length;
            charCount.textContent = len + ' / 1000';
            if (len > 1000) {
                charCount.style.color = '#ff6b6b';
            } else if (len > 800) {
                charCount.style.color = 'rgba(238,155,0,0.8)';
            } else {
                charCount.style.color = '';
            }
        });
    }
}

// ============================================
// FILE UPLOAD HANDLING
// ============================================
function setupShareFileUpload() {
    const fileInput = document.getElementById('share-image');
    const dropZone = document.getElementById('shareDropZone');
    const filePreview = document.getElementById('shareFilePreview');
    const previewImage = document.getElementById('sharePreviewImage');
    const fileName = document.getElementById('shareFileName');
    const removeFile = document.getElementById('shareRemoveFile');
    const uploadContent = document.getElementById('shareUploadContent');

    if (!fileInput || !dropZone) return;

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
            processSelectedImage(file);
        }
    });

    // Explicit click handling improves reliability across browsers and layered UI elements.
    dropZone.addEventListener('click', (e) => {
        if (e.target && e.target.closest('#shareRemoveFile')) return;
        fileInput.value = '';
        fileInput.click();
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#EE9B00';
        dropZone.style.background = 'rgba(238, 155, 0, 0.1)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '';
        dropZone.style.background = '';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '';
        dropZone.style.background = '';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processSelectedImage(e.dataTransfer.files[0]);
        }
    });

    if (removeFile) {
        removeFile.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.value = '';
            uploadedImageData = null;
            filePreview.style.display = 'none';
            uploadContent.style.display = 'flex';
        });
    }

    function processSelectedImage(file) {
        if (!file) return;

        if (!file.type || !file.type.startsWith('image/')) {
            showShareToast('Please select a valid image file.', 'info');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showShareToast('Image must be under 5 MB', 'info');
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            uploadedImageData = ev.target.result;
            if (previewImage) previewImage.src = ev.target.result;
            if (fileName) fileName.textContent = file.name;
            if (filePreview) filePreview.style.display = 'flex';
            if (uploadContent) uploadContent.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}

// ============================================
// PREVIEW POPULATION (Step 3)
// ============================================
function populatePreview() {
    const title  = document.getElementById('share-title').value.trim();
    const story  = document.getElementById('share-story').value.trim();
    const author = document.getElementById('share-author').value.trim();
    const dept   = document.getElementById('share-dept').value.trim();
    const featured = document.getElementById('share-featured').checked;

    // Preview card
    const pTitle  = document.getElementById('previewTitle');
    const pStory  = document.getElementById('previewStory');
    const pDept   = document.getElementById('previewDept');
    const pAuthor = document.getElementById('previewAuthor');
    const pCoords = document.getElementById('previewCoords');
    const pFeat   = document.getElementById('previewFeatured');
    const pImg    = document.getElementById('previewCardImage');

    if (pTitle) pTitle.textContent = title || 'Your Memory Title';
    if (pStory) pStory.textContent = story || 'Your story will appear here…';
    if (pDept)  pDept.textContent = dept || '—';
    if (pAuthor) pAuthor.textContent = author || 'Your Name';
    if (pCoords && shareSelectedLocation) {
        pCoords.textContent = `${shareSelectedLocation.lat.toFixed(4)}°N, ${shareSelectedLocation.lng.toFixed(4)}°E`;
    }
    if (pFeat) pFeat.classList.toggle('hidden', !featured);

    // Preview image
    if (pImg) {
        if (uploadedImageData) {
            pImg.innerHTML = `<img src="${uploadedImageData}" alt="Preview">`;
        } else {
            pImg.innerHTML = '<div class="preview-card-placeholder">📷</div>';
        }
    }

    // Summary checklist
    const sumLoc = document.getElementById('sumLocText');
    const sumAuth = document.getElementById('sumAuthorText');
    const sumDept = document.getElementById('sumDeptText');
    const sumTitle = document.getElementById('sumTitleText');
    const sumPhoto = document.getElementById('sumPhotoText');
    const sumFeat = document.getElementById('sumFeaturedText');

    if (sumLoc && shareSelectedLocation) {
        sumLoc.textContent = `${shareSelectedLocation.lat.toFixed(4)}°N, ${shareSelectedLocation.lng.toFixed(4)}°E`;
    }
    if (sumAuth) sumAuth.textContent = author || '—';
    if (sumDept) sumDept.textContent = dept || '—';
    if (sumTitle) sumTitle.textContent = title || '—';
    if (sumPhoto) {
        const imgFile = document.getElementById('share-image');
        sumPhoto.textContent = (imgFile && imgFile.files.length > 0) ? imgFile.files[0].name : 'None';
    }
    if (sumFeat) sumFeat.textContent = featured ? 'Yes ⭐' : 'No';
}

// ============================================
// BACKEND UPLOAD EXAMPLE (FormData + fetch)
// ============================================
// This function sends a memory to your Node.js backend using multipart/form-data.
// It is intentionally simple so beginners can understand each step.
// Required input: title, description, lat, lng, imageFile
async function uploadMemoryToBackend({ title, description, category, lat, lng, imageFile, user }) {
    const latNumber = Number(lat);
    const lngNumber = Number(lng);

    if (!Number.isFinite(latNumber) || !Number.isFinite(lngNumber)) {
        throw new Error('Invalid map coordinates. Please select location again.');
    }

    // FormData is required when sending files.
    const formData = new FormData();

    // Add text fields.
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', category || 'general');
    formData.append('lat', String(latNumber));
    formData.append('lng', String(lngNumber));

    // Add the image file. The field name "image" must match upload.single('image').
    formData.append('image', imageFile);

    // Attach lightweight profile snapshot for rendering on cards/map.
    if (user) {
        const userName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.name || user.email || 'CUET User';
        const userId = user._id || user.id || user.email || '';
        formData.append('userName', userName);
        formData.append('userId', String(userId));
        formData.append('userProfileImage', user.profileImage || '');
    }

    // Send to backend.
    const response = await fetch('http://localhost:5000/api/memories/share', {
        method: 'POST',
        body: formData,
    });

    // Parse backend response JSON.
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Failed to upload memory');
    }

    return data;
}

// Prevent double-submit while image is uploading to Cloudinary.
function setShareSubmitLoading(isLoading) {
    const submitBtn = document.getElementById('share-submit-btn');
    const mobileSubmitBtn = document.getElementById('mobileSubmitBtn');
    const buttons = [submitBtn, mobileSubmitBtn].filter(Boolean);

    buttons.forEach((btn) => {
        if (!btn.dataset.originalText) {
            btn.dataset.originalText = btn.textContent;
        }

        btn.disabled = isLoading;
        btn.textContent = isLoading ? 'Uploading to CUET...' : btn.dataset.originalText;
    });
}

// ============================================
// SUBMIT HANDLER
// ============================================
async function handleSubmit() {
    if (!shareSelectedLocation) {
        showShareToast('Please select a location first!', 'info');
        return;
    }

    const title  = document.getElementById('share-title').value.trim();
    const story  = document.getElementById('share-story').value.trim();
    const author = document.getElementById('share-author').value.trim();
    const dept   = document.getElementById('share-dept').value.trim();
    const featured = document.getElementById('share-featured').checked;
    const user = getSharePageUser();

    if (!title || !story || !author || !dept) {
        showShareToast('Please fill in all required fields.', 'info');
        return;
    }

    const imageFile = document.getElementById('share-image')?.files?.[0];
    if (!imageFile) {
        showShareToast('Please upload an image before submitting.', 'info');
        return;
    }

    setShareSubmitLoading(true);

    try {
        const data = await uploadMemoryToBackend({
            title,
            description: story,
            // This project does not yet have a dedicated category field in the form,
            // so we use department as category for now.
            category: dept,
            lat: shareSelectedLocation.lat,
            lng: shareSelectedLocation.lng,
            imageFile,
            user,
        });

        const savedMemory = data.memory || {};
        const mappedMemory = {
            lat: Number(savedMemory.lat ?? shareSelectedLocation.lat),
            lng: Number(savedMemory.lng ?? shareSelectedLocation.lng),
            title: savedMemory.title || title,
            story: savedMemory.description || story,
            image: savedMemory.imageUrl || null,
            author: savedMemory.userName || author,
            dept,
            featured,
            date: 'Just now',
            userProfileImage: savedMemory.userProfileImage || user?.profileImage || '',
        };

        // Add marker immediately on the share page.
        addSharedMarker(mappedMemory);
        recentApiMemories.unshift(mappedMemory);
        showShareToast('Memory uploaded successfully! 📌', 'success');
        alert('Success: Memory shared successfully!');

        // Reset everything
        resetWizard();
        renderRecentMemories();

        // Move user to home page so they can see the new memory on the main map.
        window.location.href = 'index.html';
    } catch (error) {
        const message = error.message || 'Upload failed. Please try again.';
        showShareToast(message, 'info');

        // Friendly alert for common network/offline backend issue.
        if (error.name === 'TypeError' || /failed to fetch|network|offline/i.test(message)) {
            alert('Server Offline: Please start backend server at http://localhost:5000 and try again.');
        }
    } finally {
        setShareSubmitLoading(false);
    }
}

function resetWizard() {
    // Reset form
    const form = document.getElementById('share-memory-form');
    if (form) form.reset();

    // Reset floating-group states
    document.querySelectorAll('.floating-group').forEach(g => {
        g.classList.remove('valid', 'invalid');
    });
    document.querySelectorAll('.field-error').forEach(e => e.textContent = '');

    // Reset char count
    const cc = document.getElementById('storyCharCount');
    if (cc) { cc.textContent = '0 / 1000'; cc.style.color = ''; }

    // Remove selection marker
    if (shareSelectedLocation && shareSelectedLocation.marker) {
        shareSelectedLocation.marker.setMap(null);
    }
    shareSelectedLocation = null;
    uploadedImageData = null;

    // Reset location status
    const statusEl = document.getElementById('share-location-status');
    const textEl = document.getElementById('share-location-text');
    if (statusEl) statusEl.classList.remove('selected');
    if (textEl) textEl.textContent = 'Click on the map to select a location';

    // Reset file preview
    const filePreview = document.getElementById('shareFilePreview');
    const uploadContent = document.getElementById('shareUploadContent');
    if (filePreview) filePreview.style.display = 'none';
    if (uploadContent) uploadContent.style.display = 'flex';

    // Disable next buttons
    const btn1 = document.getElementById('btnToStep2');
    const btn2 = document.getElementById('btnToStep3');
    if (btn1) btn1.disabled = true;
    if (btn2) btn2.disabled = true;

    // Go back to step 1
    goToStep(1);
}

// ============================================
// RENDER RECENT MEMORIES CARDS
// ============================================
function renderRecentMemories() {
    const grid = document.getElementById('recentMemoriesGrid');
    const noMsg = document.getElementById('noMemoriesMsg');

    const memories = recentApiMemories;

    if (!grid) return;
    grid.innerHTML = '';

    if (memories.length === 0) {
        if (noMsg) noMsg.style.display = 'block';
        return;
    }

    if (noMsg) noMsg.style.display = 'none';

    memories.forEach(memory => {
        const card = document.createElement('div');
        card.className = 'recent-memory-card';
        card.innerHTML = `
            ${memory.image
                ? `<img src="${memory.image}" alt="${memory.title}" class="card-image" onerror="this.style.display='none'">`
                : `<div class="card-placeholder">📍</div>`
            }
            <div class="card-body">
                ${memory.featured ? '<span class="featured-tag">⭐ Featured</span>' : ''}
                <h4 class="card-title">${memory.title}</h4>
                <p class="card-story">${memory.story}</p>
                <div class="card-meta">
                    <span class="author">👤 ${memory.author} • ${memory.dept}</span>
                    <span>🕐 ${memory.date}</span>
                </div>
            </div>
        `;
        card.addEventListener('click', () => {
            if (shareMap) {
                shareMap.panTo({ lat: memory.lat, lng: memory.lng });
                shareMap.setZoom(18);
            }
        });
        grid.appendChild(card);
    });
}

// Fetch recent memories from backend so the share page reflects server data.
async function fetchRecentMemoriesFromServer() {
    try {
        const response = await fetch('http://localhost:5000/api/memories/all');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch memories');
        }

        const list = Array.isArray(data) ? data : [];
        recentApiMemories = list.map((memory) => ({
            lat: Number(memory.lat),
            lng: Number(memory.lng),
            title: memory.title || 'Untitled',
            story: memory.description || '',
            image: memory.imageUrl || null,
            author: 'CUET User',
            dept: memory.category || 'CUET',
            featured: false,
            date: memory.createdAt ? new Date(memory.createdAt).toLocaleDateString() : 'Recently shared',
        })).filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));

        addAllMarkers();
        renderRecentMemories();
    } catch (error) {
        console.error(error);
    }
}

// ============================================
// TOAST
// ============================================
function showShareToast(message, type = 'success') {
    const toast = document.getElementById('successToast');
    const toastMessage = document.getElementById('toastMessage');
    if (toast && toastMessage) {
        toastMessage.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

// ============================================
// MOBILE MENU
// ============================================
function setupShareMobileMenu() {
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', () => navLinks.classList.toggle('active'));
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => navLinks.classList.remove('active'));
        });
    }
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', function () {
    const user = enforceShareLogin();
    if (!user) {
        return;
    }

    // Map
    if (document.getElementById('share-map')) {
        initializeShareMapWhenReady();
    }

    // Step navigation buttons
    const btnToStep2 = document.getElementById('btnToStep2');
    const btnToStep3 = document.getElementById('btnToStep3');
    const btnBackToStep1 = document.getElementById('btnBackToStep1');
    const btnBackToStep2 = document.getElementById('btnBackToStep2');
    const submitBtn = document.getElementById('share-submit-btn');
    const mobileSubmitBtn = document.getElementById('mobileSubmitBtn');

    if (btnToStep2) btnToStep2.addEventListener('click', () => goToStep(2));
    if (btnToStep3) btnToStep3.addEventListener('click', () => goToStep(3));
    if (btnBackToStep1) btnBackToStep1.addEventListener('click', () => goToStep(1));
    if (btnBackToStep2) btnBackToStep2.addEventListener('click', () => goToStep(2));
    if (submitBtn) submitBtn.addEventListener('click', handleSubmit);
    if (mobileSubmitBtn) mobileSubmitBtn.addEventListener('click', handleSubmit);

    // Form validation & file upload
    setupFormValidation();
    setupShareFileUpload();
    setupShareMobileMenu();
    renderRecentMemories();
    fetchRecentMemoriesFromServer();

    // Resize listener for mobile sticky
    window.addEventListener('resize', updateMobileStickyVisibility);

});

function waitForGoogleMaps(timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const timer = setInterval(() => {
            if (window.google && window.google.maps) {
                clearInterval(timer);
                resolve();
                return;
            }

            if (Date.now() - startTime > timeoutMs) {
                clearInterval(timer);
                reject(new Error('Google Maps API load timeout'));
            }
        }, 100);
    });
}

async function initializeShareMapWhenReady() {
    try {
        await waitForGoogleMaps();
        initShareMap();
    } catch (error) {
        console.error(error);
        const mapElement = document.getElementById('share-map');
        if (mapElement) {
            mapElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#D4F1F4;background:#001219;">Map failed to load. Please check API key and internet connection.</div>';
        }
    }
}
