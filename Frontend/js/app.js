let map;
let selectedLocation = null;
let currentPlaceCard = null;
let isLoggedIn = true;
let galleryPosition = 0;

// Google Maps state
let activeMarkerObj = null;
let activeInfoWindow = null;
let allMapMarkerObjs = []; // {marker, memory}
let allMapMarkers = [];
let backendMemories = [];
let hasShownBackendOfflineAlert = false;
let userLocationMarker = null;
let directionsService = null;
let directionsRenderer = null;
let isMobile = () => window.innerWidth <= 900;
let pendingReportMemoryId = null;
let pendingCommentMemoryId = null;
let memoryAutoSyncTimer = null;
const MEMORY_API_BASE = 'http://localhost:5000/api/memories';

// CUET Campus coordinates
const CUET_CENTER = { lat: 22.4625, lng: 91.9703 };
const CUET_BOUNDS = {
    north: 22.469778,
    south: 22.458389,
    west: 91.963444,
    east: 91.980000
};

const campusLocations = [
    {
        title: 'Academic Building',
        lat: 22.4632,
        lng: 91.9709,
        story: 'Main academic hub where classes, labs, and student activities come alive.',
        dept: 'CSE',
        author: 'Campus Guide',
        date: 'Landmark',
        featured: true,
        image: null
    },
    {
        title: 'Hall',
        lat: 22.4643,
        lng: 91.9689,
        story: 'Residential hall area known for student life, culture, and lifelong friendships.',
        dept: 'CUET',
        author: 'Campus Guide',
        date: 'Landmark',
        featured: false,
        image: null
    },
    {
        title: 'Cafeteria',
        lat: 22.4619,
        lng: 91.9716,
        story: 'A popular spot for meals, tea breaks, and everyday conversations.',
        dept: 'CUET',
        author: 'Campus Guide',
        date: 'Landmark',
        featured: true,
        image: null
    },
    {
        title: 'Central Library',
        lat: 22.4623,
        lng: 91.9705,
        story: 'Quiet study zone for research, preparation, and collaboration.',
        dept: 'CUET',
        author: 'Campus Guide',
        date: 'Landmark',
        featured: false,
        image: null
    },
    {
        title: 'Shaheed Minar',
        lat: 22.462,
        lng: 91.9701,
        story: 'An important cultural and memorial landmark in the campus core.',
        dept: 'CUET',
        author: 'Campus Guide',
        date: 'Landmark',
        featured: false,
        image: null
    }
];

// ============================================
// MAP INITIALIZATION (Google Maps)
// ============================================
function initMap() {
    if (!window.google || !window.google.maps) {
        return;
    }

    const mapElement = document.getElementById('map');
    if (!mapElement) {
        return;
    }

    map = new google.maps.Map(mapElement, {
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

    activeInfoWindow = new google.maps.InfoWindow();
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: false,
        polylineOptions: {
            strokeColor: '#EE9B00',
            strokeOpacity: 0.9,
            strokeWeight: 5
        }
    });
    directionsRenderer.setMap(map);

    addMemoryMarkers();
    setupMapControls();
    setupPlacesSearch();
    populateRouteSelectors();

    // Load memories from backend and re-render map markers.
    fetchMemoriesFromServer();

    map.addListener('click', () => {
        hideMiniPopup();
    });

    // Prevent intermittent blank rendering by forcing a resize after first paint.
    setTimeout(() => {
        google.maps.event.trigger(map, 'resize');
        map.setCenter(CUET_CENTER);
    }, 100);
}

function createMarkerIcon(featured = false) {
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

function addMemoryMarkers() {
    allMapMarkers.forEach(marker => marker.setMap(null));
    allMapMarkerObjs = [];
    allMapMarkers = [];

    const allMemories = getAllMemoriesForMap();

    allMemories.forEach(memory => {
        const marker = new google.maps.Marker({
            position: { lat: memory.lat, lng: memory.lng },
            map,
            title: memory.title,
            icon: createMarkerIcon(memory.featured),
            optimized: true
        });
        marker._featured = !!memory.featured;

        marker.addListener('click', function() {
            setActiveMarker(marker);
            showInfoWindow(memory, marker);
        });

        allMapMarkerObjs.push({ marker, memory });
        allMapMarkers.push(marker);
    });

    // Update count badge
    updateMemoryCount(allMemories.length);
}

function getAllMemoriesForMap() {
    return [...backendMemories];
}

function getCurrentUserId() {
    const user = getLoggedInUser();
    if (!user) return '';
    return String(user._id || user.id || user.email || '');
}

function mapApiMemory(memory) {
    const authorName = memory.userName || 'CUET User';
    const likes = Array.isArray(memory.likes) ? memory.likes : [];
    const comments = Array.isArray(memory.comments) ? memory.comments : [];
    const shares = Array.isArray(memory.shares) ? memory.shares : [];
    const reports = Array.isArray(memory.reports) ? memory.reports : [];
    const currentUserId = getCurrentUserId();
    const likedByMe = currentUserId ? likes.some((like) => like.userId === currentUserId) : false;

    return {
        id: memory._id,
        title: memory.title || 'Untitled Memory',
        story: memory.description || '',
        image: memory.imageUrl || null,
        imageUrl: memory.imageUrl || null,
        lat: Number(memory.lat),
        lng: Number(memory.lng),
        featured: false,
        author: authorName,
        dept: 'CUET',
        date: memory.createdAt ? new Date(memory.createdAt).toLocaleDateString() : 'Recently shared',
        userId: memory.userId || '',
        userName: authorName,
        userProfileImage: memory.userProfileImage || '',
        likes,
        comments,
        shares,
        reports,
        likesCount: likes.length,
        commentsCount: comments.length,
        sharesCount: shares.length,
        reportsCount: reports.length,
        likedByMe,
    };
}

// Fetch all memories from Node.js backend and render them as map markers.
async function fetchMemoriesFromServer() {
    try {
        const response = await fetch('http://localhost:5000/api/memories/all');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch memories from backend');
        }

        const list = Array.isArray(data) ? data : [];

        // Keep only memories with valid coordinates so Google Maps markers can be placed.
        backendMemories = list
            .map(mapApiMemory)
            .filter(m => Number.isFinite(m.lat) && Number.isFinite(m.lng));

        if (map) {
            addMemoryMarkers();
            filterMapMarkers();
        }

        // Refresh gallery with server-backed memories.
        refreshGallery();
    } catch (error) {
        console.error('Error fetching backend memories:', error);

        // Show this alert once to avoid annoying repeated popups.
        if (!hasShownBackendOfflineAlert) {
            hasShownBackendOfflineAlert = true;
            alert('Server Offline: Could not load map memories from backend.');
        }
    }
}

function setupMemoryAutoSync() {
    if (memoryAutoSyncTimer) {
        clearInterval(memoryAutoSyncTimer);
    }

    const refreshMemories = () => {
        fetchMemoriesFromServer();
    };

    // Keep maps and gallery synced across pages/tabs without manual refresh.
    memoryAutoSyncTimer = setInterval(refreshMemories, 7000);

    window.addEventListener('focus', refreshMemories);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            refreshMemories();
        }
    });
}

function updateMemoryCount(count) {
    const el = document.getElementById('mapCountNum');
    if (el) el.textContent = count;
}

// ============================================
// ACTIVE MARKER HIGHLIGHT
// ============================================
function setActiveMarker(marker) {
    if (activeMarkerObj) {
        activeMarkerObj.setIcon(createMarkerIcon(activeMarkerObj._featured));
        activeMarkerObj.setZIndex(undefined);
    }
    activeMarkerObj = marker;
    marker.setIcon({
        ...createMarkerIcon(marker._featured),
        scale: marker._featured ? 2.15 : 1.95,
        strokeColor: '#EE9B00',
        strokeWeight: 3
    });
    marker.setZIndex(google.maps.Marker.MAX_ZINDEX + 1);
}

function clearActiveMarker() {
    if (activeMarkerObj) {
        activeMarkerObj.setIcon(createMarkerIcon(activeMarkerObj._featured));
        activeMarkerObj.setZIndex(undefined);
        activeMarkerObj = null;
    }
}

function showInfoWindow(memory, marker) {
    if (!activeInfoWindow) {
        return;
    }

    // Prefer database-backed imageUrl, then fall back to local/demo image field.
    const imageSrc = memory.imageUrl || memory.image || null;
    const description = `${memory.story || memory.description || ''}`;
    const imageHtml = imageSrc
        ? `<img src="${imageSrc}" alt="${memory.title}" style="width:100%;height:110px;object-fit:cover;border-radius:8px;margin-bottom:8px;" onerror="this.style.display='none'">`
        : '';

    const canReport = !!memory.id;
    const reportButtonHtml = canReport
        ? `<button onclick="window.reportMemoryPrompt('${memory.id}')" style="margin-top:8px;padding:6px 10px;border-radius:8px;border:1px solid #dc3545;background:transparent;color:#dc3545;cursor:pointer;font-weight:600;">Report</button>`
        : '';

    activeInfoWindow.setContent(`
        <div class="gm-info-window" style="width:220px;">
            ${imageHtml}
            <strong style="display:block;margin-bottom:6px;">${memory.title}</strong>
            <p style="margin:0;color:#333;line-height:1.35;">${description}</p>
            ${reportButtonHtml}
        </div>
    `);
    activeInfoWindow.open({ map, anchor: marker });
    showDetailPanel(memory);
}

// ============================================
// MINI POPUP (on marker click)
// ============================================
function showMiniPopup(memory, marker) {
    showInfoWindow(memory, marker);
}

function hideMiniPopup() {
    if (activeInfoWindow) {
        activeInfoWindow.close();
    }
    clearActiveMarker();
}

// Open detail (from mini popup button)
function openMemoryDetail(e) {
    if (e) e.stopPropagation();
    const popup = document.getElementById('mapMiniPopup');
    const memory = popup?._memory;
    if (!memory) return;
    hideMiniPopup();
    showDetailPanel(memory);
}

// ============================================
// DETAIL PANEL (slide-in desktop / overlay mobile)
// ============================================
function showDetailPanel(memory) {
    if (isMobile()) {
        showMobileOverlay(memory);
    } else {
        showDesktopPanel(memory);
    }
    currentPlaceCard = memory;
}

function buildPanelHTML(memory) {
    const imageSrc = memory.imageUrl || memory.image || '';
    const imageSection = imageSrc
        ? `<div class="panel-image-wrapper">
               <img src="${imageSrc}" alt="${memory.title}" onerror="this.parentElement.outerHTML='<div class=\\'panel-image-placeholder\\'>📷</div>'">
               ${memory.featured ? '<span class="panel-featured-tag">⭐ Featured</span>' : ''}
           </div>`
        : `<div class="panel-image-placeholder">${memory.featured ? '<span class="panel-featured-tag">⭐ Featured</span>' : ''}📷</div>`;

    const actionsDisabled = !memory.id;
    const disabledAttr = actionsDisabled ? 'disabled title="Only published memories support this action"' : '';

    return `
        ${imageSection}
        <div class="panel-body">
            <span class="panel-dept-badge">${memory.dept}</span>
            <h3 class="panel-title">${memory.title}</h3>
            <p class="panel-story">${memory.story}</p>
            <div class="panel-meta">
                <div class="panel-meta-row">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span class="meta-value">${memory.author}</span>
                </div>
                <div class="panel-meta-row">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span class="meta-value">${memory.date}</span>
                </div>
            </div>
            <div class="panel-actions">
                <button class="panel-action-btn ${memory.likedByMe ? 'liked' : ''}" ${disabledAttr} onclick="window.handleMemoryLike('${memory.id || ''}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    Like (${memory.likesCount || 0})
                </button>
                <button class="panel-action-btn" ${disabledAttr} onclick="window.handleMemoryComment('${memory.id || ''}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    Comment (${memory.commentsCount || 0})
                </button>
                <button class="panel-action-btn" ${disabledAttr} onclick="window.handleMemoryShare('${memory.id || ''}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                    Share (${memory.sharesCount || 0})
                </button>
                ${memory.id ? `<button class="panel-action-btn panel-report-btn" onclick="window.reportMemoryPrompt('${memory.id}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 9v4"></path>
                        <path d="M12 17h.01"></path>
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    </svg>
                    Report
                </button>` : ''}
            </div>
            <div class="panel-coords">${memory.lat.toFixed(6)}°N, ${memory.lng.toFixed(6)}°E</div>
        </div>`;
}

// Desktop slide-in panel
function showDesktopPanel(memory) {
    const panel = document.getElementById('mapDetailPanel');
    const content = document.getElementById('panelContent');
    if (!panel || !content) return;

    content.innerHTML = buildPanelHTML(memory);
    panel.classList.add('open');

    if (map) {
        map.panTo({ lat: memory.lat, lng: memory.lng });
        map.setZoom(18);
    }
}

function closeDesktopPanel() {
    const panel = document.getElementById('mapDetailPanel');
    if (panel) panel.classList.remove('open');
    currentPlaceCard = null;
    clearActiveMarker();
}

// Mobile overlay
function showMobileOverlay(memory) {
    const overlay = document.getElementById('mapMobileOverlay');
    const content = document.getElementById('mobileOverlayContent');
    if (!overlay || !content) return;

    content.innerHTML = buildPanelHTML(memory);
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('visible'));
    document.body.style.overflow = 'hidden';

    if (map) {
        map.panTo({ lat: memory.lat, lng: memory.lng });
        map.setZoom(18);
    }
}

function closeMobileOverlay() {
    const overlay = document.getElementById('mapMobileOverlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    setTimeout(() => {
        overlay.classList.add('hidden');
        document.body.style.overflow = '';
    }, 400);
    currentPlaceCard = null;
    clearActiveMarker();
}

// Legacy alias (used by gallery card click and ESC handler)
function showPlaceCard(memory) {
    showDetailPanel(memory);
}
function closePlaceCard() {
    closeDesktopPanel();
    closeMobileOverlay();
}

// ============================================
// MAP CONTROLS (search, dept filter, reset)
// ============================================
function setupMapControls() {
    // Reset button
    const resetBtn = document.getElementById('mapResetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (map) {
                map.panTo(CUET_CENTER);
                map.setZoom(16);
            }
            if (directionsRenderer) {
                directionsRenderer.set('directions', null);
            }
            hideMiniPopup();
            closeDesktopPanel();
            closeMobileOverlay();
            // Reset filters
            const searchInput = document.getElementById('mapSearchInput');
            const deptFilter = document.getElementById('mapDeptFilter');
            if (searchInput) searchInput.value = '';
            if (deptFilter) deptFilter.value = 'all';
            addMemoryMarkers(); // reload all
        });
    }

    // Department filter
    const deptFilter = document.getElementById('mapDeptFilter');
    if (deptFilter) {
        deptFilter.addEventListener('change', filterMapMarkers);
    }

    // Search input (debounced)
    const searchInput = document.getElementById('mapSearchInput');
    let mapSearchTimer;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(mapSearchTimer);
            mapSearchTimer = setTimeout(filterMapMarkers, 250);
        });
    }

    const routeBtn = document.getElementById('routeBtn');
    if (routeBtn) {
        routeBtn.addEventListener('click', drawCampusRoute);
    }

    const mapLocateBtn = document.getElementById('mapLocateBtn');
    if (mapLocateBtn) {
        mapLocateBtn.addEventListener('click', locateUser);
    }

    // Panel close button
    const panelClose = document.getElementById('panelCloseBtn');
    if (panelClose) panelClose.addEventListener('click', closeDesktopPanel);

    // Mobile overlay close
    const mobileClose = document.getElementById('mobileOverlayClose');
    const mobileBackdrop = document.getElementById('mobileOverlayBackdrop');
    if (mobileClose) mobileClose.addEventListener('click', closeMobileOverlay);
    if (mobileBackdrop) mobileBackdrop.addEventListener('click', closeMobileOverlay);
}

function filterMapMarkers() {
    const query = (document.getElementById('mapSearchInput')?.value || '').trim().toLowerCase();
    const dept = document.getElementById('mapDeptFilter')?.value || 'all';

    let visibleCount = 0;
    let lastVisible = null;

    allMapMarkerObjs.forEach(({ marker, memory }) => {
        // Dept filter
        if (dept !== 'all') {
            const memDept = (memory.dept || '').split(' ')[0].toUpperCase();
            if (memDept !== dept.toUpperCase()) {
                marker.setVisible(false);
                return;
            }
        }
        // Text search
        if (query) {
            const haystack = [memory.title, memory.story, memory.author, memory.dept].join(' ').toLowerCase();
            if (!haystack.includes(query)) {
                marker.setVisible(false);
                return;
            }
        }
        marker.setVisible(true);
        visibleCount++;
        lastVisible = { marker, memory };
    });

    updateMemoryCount(visibleCount);

    // If search matches exactly one, fly to it
    if (visibleCount === 1 && lastVisible && map) {
        const pos = lastVisible.marker.getPosition();
        if (pos) {
            map.panTo(pos);
            map.setZoom(18);
        }
    }
}

function setupPlacesSearch() {
    if (!window.google || !google.maps.places || !map) {
        return;
    }

    const input = document.getElementById('mapSearchInput');
    if (!input) {
        return;
    }

    const searchBox = new google.maps.places.SearchBox(input);
    map.addListener('bounds_changed', () => {
        searchBox.setBounds(map.getBounds());
    });

    searchBox.addListener('places_changed', () => {
        const places = searchBox.getPlaces();
        if (!places || places.length === 0) {
            return;
        }

        const bounds = new google.maps.LatLngBounds();
        places.forEach(place => {
            if (!place.geometry || !place.geometry.location) {
                return;
            }

            if (place.geometry.viewport) {
                bounds.union(place.geometry.viewport);
            } else {
                bounds.extend(place.geometry.location);
            }
        });
        map.fitBounds(bounds);
    });
}

function locateUser() {
    if (!navigator.geolocation || !map) {
        showToast('Geolocation is not supported on this browser.', 'error');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        position => {
            const userPos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            if (userLocationMarker) {
                userLocationMarker.setMap(null);
            }

            userLocationMarker = new google.maps.Marker({
                position: userPos,
                map,
                title: 'Your location',
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: '#3B82F6',
                    fillOpacity: 1,
                    strokeColor: '#FFFFFF',
                    strokeWeight: 2,
                    scale: 7
                }
            });

            map.panTo(userPos);
            map.setZoom(17);
            showToast('Your location was found.', 'success');
        },
        () => showToast('Unable to access your location.', 'error'),
        { enableHighAccuracy: true, timeout: 12000 }
    );
}

function populateRouteSelectors() {
    const startSelect = document.getElementById('routeStart');
    const endSelect = document.getElementById('routeEnd');
    if (!startSelect || !endSelect) {
        return;
    }

    campusLocations.forEach(location => {
        const startOption = document.createElement('option');
        startOption.value = `${location.lat},${location.lng}`;
        startOption.textContent = location.title;

        const endOption = document.createElement('option');
        endOption.value = `${location.lat},${location.lng}`;
        endOption.textContent = location.title;

        startSelect.appendChild(startOption);
        endSelect.appendChild(endOption);
    });
}

function drawCampusRoute() {
    if (!directionsService || !directionsRenderer) {
        return;
    }

    const startValue = document.getElementById('routeStart')?.value;
    const endValue = document.getElementById('routeEnd')?.value;

    if (!startValue || !endValue) {
        showToast('Select both start and destination points.', 'error');
        return;
    }

    if (startValue === endValue) {
        showToast('Start and destination must be different.', 'error');
        return;
    }

    const [startLat, startLng] = startValue.split(',').map(Number);
    const [endLat, endLng] = endValue.split(',').map(Number);

    directionsService.route(
        {
            origin: { lat: startLat, lng: startLng },
            destination: { lat: endLat, lng: endLng },
            travelMode: google.maps.TravelMode.WALKING
        },
        (result, status) => {
            if (status === 'OK' && result) {
                directionsRenderer.setDirections(result);
                return;
            }
            showToast('Directions unavailable for selected points.', 'error');
        }
    );
}

// ============================================
// MAP CLICK HANDLER (simplified — no submit section)
// ============================================
function onMapClick(e) {
    // No-op: submit section removed. Share memory is on its own page now.
}

function updateLocationStatus() {}
function enableSubmitButton() {}

// ============================================
// MODAL FUNCTIONALITY
// ============================================
function setupModals() {
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    
    // Login triggers
    document.querySelectorAll('.login-trigger, .nav-login-btn').forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            openModal('loginModal');
        });
    });
    
    // Close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            closeAllModals();
        });
    });
    
    // Click outside to close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeAllModals();
            }
        });
    });
    
    // Switch between login/register
    document.querySelectorAll('.switch-to-register').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            closeAllModals();
            setTimeout(() => openModal('registerModal'), 200);
        });
    });
    
    document.querySelectorAll('.switch-to-login').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            closeAllModals();
            setTimeout(() => openModal('loginModal'), 200);
        });
    });
    
    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
            closePlaceCard();
        }
    });
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.remove('active');
    });
    document.body.style.overflow = '';
}

// ============================================
// GALLERY FUNCTIONALITY — Searchable Grid
// ============================================
let allGalleryMemories = [];

function getAllMemories() {
    // Gallery uses only server memories.
    return [...backendMemories];
}

function setupGallery() {
    allGalleryMemories = getAllMemories();
    renderGallery(allGalleryMemories);
    setupGallerySearch();
    setupGalleryScroll();
}

function renderGallery(memories) {
    const grid = document.getElementById('galleryGrid');
    const noResults = document.getElementById('galleryNoResults');
    const countEl = document.getElementById('galleryResultCount');
    
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (memories.length === 0) {
        if (noResults) noResults.style.display = 'block';
        if (countEl) countEl.textContent = 'No memories found';
        return;
    }
    
    if (noResults) noResults.style.display = 'none';
    if (countEl) {
        const total = allGalleryMemories.length;
        countEl.textContent = memories.length === total
            ? `Showing all ${total} memories`
            : `Showing ${memories.length} of ${total} memories`;
    }
    
    memories.forEach((memory, i) => {
        const alreadyReported = isAlreadyReportedByCurrentUser(memory.id);
        const avatarSrc = memory.userProfileImage || getDefaultAvatarDataUri(memory.author || memory.userName || 'CUET User');
        const card = document.createElement('div');
        card.className = 'gallery-grid-card';
        card.style.animationDelay = `${i * 0.05}s`;
        
        card.innerHTML = `
            ${memory.image
                ? `<img src="${memory.image}" alt="${memory.title}" class="card-img" onerror="this.outerHTML='<div class=\\'card-img-placeholder\\'>📷</div>'">`
                : '<div class="card-img-placeholder">📷</div>'
            }
            <div class="card-body">
                ${memory.featured ? '<span class="card-badge">⭐ Featured</span>' : ''}
                <h4 class="card-title">${memory.title}</h4>
                <p class="card-excerpt">${memory.story}</p>
                <div class="card-actions">
                    <button class="card-report-btn" ${alreadyReported ? 'disabled' : ''} onclick="event.stopPropagation(); window.reportMemoryPrompt('${memory.id || ''}')">
                        ${alreadyReported ? 'Reported' : 'Report'}
                    </button>
                </div>
                <div class="card-footer">
                    <span class="card-author"><img src="${avatarSrc}" alt="${memory.author}" class="card-author-avatar" onerror="this.src='${getDefaultAvatarDataUri('CUET User')}'"> ${memory.author} • ${memory.dept}</span>
                    <span>🕐 ${memory.date}</span>
                </div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            showPlaceCard(memory);
            document.getElementById('map-section').scrollIntoView({ behavior: 'smooth' });
        });
        
        grid.appendChild(card);
    });
}

function getReporterIdentity() {
    const user = getLoggedInUser();
    if (!user) return null;

    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.name || user.email || 'CUET User';
    const id = user._id || user.id || user.email;

    if (!id) return null;
    return { id: String(id), name };
}

function findMemoryById(memoryId) {
    if (!memoryId) return null;
    return backendMemories.find((memory) => memory.id === memoryId) || null;
}

function isAlreadyReportedByCurrentUser(memoryId) {
    if (!memoryId) return false;
    const reporter = getReporterIdentity();
    if (!reporter) return false;
    const memory = findMemoryById(memoryId);
    if (!memory) return false;
    const reports = Array.isArray(memory.reports) ? memory.reports : [];
    return reports.some((report) => report.userId === reporter.id);
}

function reportMemoryPrompt(memoryId) {
    const memory = findMemoryById(memoryId);
    if (!memory || !memory.id) {
        showToast('This memory cannot be reported.', 'error');
        return;
    }

    if (!isLoggedIn) {
        alert('Login required to report a memory.');
        window.location.href = 'login.html';
        return;
    }

    const reporter = getReporterIdentity();
    if (!reporter) {
        showToast('Unable to identify current user.', 'error');
        return;
    }

    if (isAlreadyReportedByCurrentUser(memory.id)) {
        showToast('You already reported this memory.', 'error');
        return;
    }

    openReportModal(memory.id);
}

function getReportModalElements() {
    return {
        overlay: document.getElementById('reportModalOverlay'),
        reasonInput: document.getElementById('reportReasonInput'),
        cancelBtn: document.getElementById('reportCancelBtn'),
        submitBtn: document.getElementById('reportSubmitBtn'),
        closeBtn: document.getElementById('reportModalClose'),
    };
}

function openReportModal(memoryId) {
    const { overlay, reasonInput } = getReportModalElements();
    if (!overlay) {
        showToast('Report modal is unavailable.', 'error');
        return;
    }

    pendingReportMemoryId = memoryId;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (reasonInput) {
        reasonInput.value = '';
        setTimeout(() => reasonInput.focus(), 30);
    }
}

function closeReportModal() {
    const { overlay, reasonInput } = getReportModalElements();
    if (!overlay) return;

    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    pendingReportMemoryId = null;
    if (reasonInput) reasonInput.value = '';
}

function submitReportFromModal() {
    if (!pendingReportMemoryId) {
        closeReportModal();
        return;
    }

    const memory = findMemoryById(pendingReportMemoryId);
    if (!memory || !memory.id) {
        closeReportModal();
        showToast('This memory cannot be reported.', 'error');
        return;
    }

    const reporter = getReporterIdentity();
    if (!reporter) {
        closeReportModal();
        showToast('Unable to identify current user.', 'error');
        return;
    }

    const { reasonInput } = getReportModalElements();
    const reason = (reasonInput?.value || '').trim();

    postMemoryAction(memory.id, 'report', {
        userId: reporter.id,
        userName: reporter.name,
        reason,
    })
        .then((data) => {
            updateMemoryInCache(memory.id, (item) => {
                const reports = Array.isArray(item.reports) ? [...item.reports] : [];
                const report = data.report || {
                    userId: reporter.id,
                    userName: reporter.name,
                    reason: reason || 'No reason provided',
                    at: new Date().toISOString(),
                };
                reports.push(report);
                return {
                    ...item,
                    reports,
                    reportsCount: Number.isFinite(data.reportsCount) ? data.reportsCount : reports.length,
                };
            });

            closeReportModal();
            showToast('Report submitted. Thank you for helping keep the community safe.', 'success');
            refreshGallery();
            refreshOpenDetailPanel(memory.id);
        })
        .catch((error) => {
            showToast(error.message || 'Failed to submit report.', 'error');
        });
}

function setupReportModal() {
    const { overlay, cancelBtn, submitBtn, closeBtn } = getReportModalElements();
    if (!overlay) return;

    if (cancelBtn) cancelBtn.addEventListener('click', closeReportModal);
    if (closeBtn) closeBtn.addEventListener('click', closeReportModal);
    if (submitBtn) submitBtn.addEventListener('click', submitReportFromModal);

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeReportModal();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && overlay.classList.contains('active')) {
            closeReportModal();
        }
    });
}

function getCommentsModalElements() {
    return {
        overlay: document.getElementById('commentsModalOverlay'),
        title: document.getElementById('commentsModalTitle'),
        list: document.getElementById('commentsList'),
        input: document.getElementById('commentInput'),
        cancelBtn: document.getElementById('commentCancelBtn'),
        submitBtn: document.getElementById('commentSubmitBtn'),
        closeBtn: document.getElementById('commentsModalClose'),
    };
}

function renderCommentsList(memory) {
    const { list, title } = getCommentsModalElements();
    if (!list) return;

    const comments = Array.isArray(memory.comments) ? memory.comments : [];
    if (title) {
        title.textContent = `Comments - ${memory.title || 'Memory'}`;
    }

    if (!comments.length) {
        list.innerHTML = '<p class="comments-empty">No comments yet. Be the first to comment.</p>';
        return;
    }

    list.innerHTML = comments
        .map((comment) => {
            const name = comment.userName || 'CUET User';
            const text = comment.text || '';
            const dateText = comment.at ? new Date(comment.at).toLocaleString() : 'Just now';
            return `
                <article class="comment-item">
                    <div class="comment-item-top">
                        <strong>${name}</strong>
                        <span>${dateText}</span>
                    </div>
                    <p>${text}</p>
                </article>
            `;
        })
        .join('');
}

function openCommentsModal(memoryId) {
    const memory = findMemoryById(memoryId);
    if (!memory || !memory.id) {
        showToast('This memory is unavailable.', 'error');
        return;
    }

    const { overlay, input } = getCommentsModalElements();
    if (!overlay) {
        showToast('Comments modal is unavailable.', 'error');
        return;
    }

    pendingCommentMemoryId = memory.id;
    renderCommentsList(memory);

    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 30);
    }
}

function closeCommentsModal() {
    const { overlay, input } = getCommentsModalElements();
    if (!overlay) return;

    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    pendingCommentMemoryId = null;

    if (input) input.value = '';
}

async function submitCommentFromModal() {
    if (!pendingCommentMemoryId) {
        closeCommentsModal();
        return;
    }

    if (!requireLoginForMemoryAction()) return;

    const actor = getReporterIdentity();
    if (!actor) {
        showToast('Unable to identify current user.', 'error');
        return;
    }

    const { input, submitBtn } = getCommentsModalElements();
    const text = String(input?.value || '').trim();
    if (!text) {
        showToast('Comment cannot be empty.', 'error');
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Posting...';
        }

        const data = await postMemoryAction(pendingCommentMemoryId, 'comments', {
            userId: actor.id,
            userName: actor.name,
            text,
        });

        updateMemoryInCache(pendingCommentMemoryId, (memory) => {
            const comments = Array.isArray(memory.comments) ? [...memory.comments] : [];
            const newComment = data.comment || {
                userId: actor.id,
                userName: actor.name,
                text,
                at: new Date().toISOString(),
            };
            comments.push(newComment);
            return {
                ...memory,
                comments,
                commentsCount: Number.isFinite(data.commentsCount) ? data.commentsCount : comments.length,
            };
        });

        const updated = findMemoryById(pendingCommentMemoryId);
        if (updated) {
            renderCommentsList(updated);
        }

        if (input) input.value = '';
        refreshOpenDetailPanel(pendingCommentMemoryId);
        refreshGallery();
        showToast('Comment added successfully.', 'success');
    } catch (error) {
        showToast(error.message || 'Failed to add comment.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post Comment';
        }
    }
}

function setupCommentsModal() {
    const { overlay, cancelBtn, submitBtn, closeBtn, input } = getCommentsModalElements();
    if (!overlay) return;

    if (cancelBtn) cancelBtn.addEventListener('click', closeCommentsModal);
    if (closeBtn) closeBtn.addEventListener('click', closeCommentsModal);
    if (submitBtn) submitBtn.addEventListener('click', submitCommentFromModal);

    if (input) {
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submitCommentFromModal();
            }
        });
    }

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeCommentsModal();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && overlay.classList.contains('active')) {
            closeCommentsModal();
        }
    });
}

function setupGallerySearch() {
    const input = document.getElementById('gallerySearchInput');
    const clearBtn = document.getElementById('searchClearBtn');
    let debounceTimer;
    
    if (!input) return;
    
    input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        clearBtn.style.display = query ? 'flex' : 'none';
        
        // Debounce for performance with large datasets
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => filterGallery(query), 200);
    });
    
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            input.value = '';
            clearBtn.style.display = 'none';
            filterGallery('');
        });
    }
}

function setupGalleryScroll() {
    const container = document.getElementById('galleryScrollContainer');
    const wrapper = document.getElementById('galleryScrollWrapper');
    
    if (!container || !wrapper) return;
    
    container.addEventListener('scroll', () => {
        const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 10;
        wrapper.classList.toggle('scrolled-bottom', atBottom);
    });
}

function filterGallery(searchQuery) {
    let filtered = allGalleryMemories;
    
    if (searchQuery) {
        filtered = filtered.filter(m => {
            const searchable = [
                m.title, m.story, m.author, m.dept, m.date
            ].join(' ').toLowerCase();
            return searchable.includes(searchQuery);
        });
    }
    
    renderGallery(filtered);
    
    // Reset scroll to top on new search
    const container = document.getElementById('galleryScrollContainer');
    if (container) container.scrollTop = 0;
}

// Refresh gallery when memories sync
function refreshGallery() {
    allGalleryMemories = getAllMemories();
    const query = document.getElementById('gallerySearchInput')?.value.trim().toLowerCase() || '';
    filterGallery(query);
}

function getAuthToken() {
    return localStorage.getItem('authToken') || '';
}

function requireLoginForMemoryAction() {
    if (!isLoggedIn) {
        alert('Login required.');
        window.location.href = 'login.html';
        return false;
    }

    const token = getAuthToken();
    if (!token) {
        alert('Session expired. Please login again.');
        window.location.href = 'login.html';
        return false;
    }

    return true;
}

function updateMemoryInCache(memoryId, updater) {
    let updatedMemory = null;
    backendMemories = backendMemories.map((memory) => {
        if (memory.id !== memoryId) return memory;
        updatedMemory = updater({ ...memory });
        return updatedMemory;
    });
    return updatedMemory;
}

function refreshOpenDetailPanel(memoryId) {
    const memory = findMemoryById(memoryId);
    if (!memory) return;

    currentPlaceCard = memory;

    const desktopPanel = document.getElementById('mapDetailPanel');
    const panelContent = document.getElementById('panelContent');
    if (desktopPanel && desktopPanel.classList.contains('open') && panelContent) {
        panelContent.innerHTML = buildPanelHTML(memory);
    }

    const mobileOverlay = document.getElementById('mapMobileOverlay');
    const mobileContent = document.getElementById('mobileOverlayContent');
    if (mobileOverlay && !mobileOverlay.classList.contains('hidden') && mobileContent) {
        mobileContent.innerHTML = buildPanelHTML(memory);
    }
}

async function postMemoryAction(memoryId, actionPath, payload = {}) {
    const token = getAuthToken();
    const response = await fetch(`${MEMORY_API_BASE}/${memoryId}/${actionPath}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.status === 401) {
        localStorage.removeItem('authToken');
        setLoginState(false);
        throw new Error('Your session expired. Please login again.');
    }

    if (!response.ok) {
        throw new Error(data.message || 'Action failed.');
    }

    return data;
}

async function handleMemoryLike(memoryId) {
    if (!memoryId) return;
    if (!requireLoginForMemoryAction()) return;

    const actor = getReporterIdentity();
    if (!actor) {
        showToast('Unable to identify current user.', 'error');
        return;
    }

    try {
        const data = await postMemoryAction(memoryId, 'like', {
            userId: actor.id,
            userName: actor.name,
        });

        updateMemoryInCache(memoryId, (memory) => ({
            ...memory,
            likedByMe: !!data.liked,
            likesCount: Number.isFinite(data.likesCount) ? data.likesCount : memory.likesCount,
        }));

        refreshOpenDetailPanel(memoryId);
        refreshGallery();
    } catch (error) {
        showToast(error.message || 'Failed to update like.', 'error');
    }
}

async function handleMemoryComment(memoryId) {
    if (!memoryId) return;
    if (!requireLoginForMemoryAction()) return;

    openCommentsModal(memoryId);
}

async function handleMemoryShare(memoryId) {
    if (!memoryId) return;
    if (!requireLoginForMemoryAction()) return;

    const actor = getReporterIdentity();
    const memory = findMemoryById(memoryId);

    if (!actor || !memory) {
        showToast('Unable to complete share.', 'error');
        return;
    }

    const shareUrl = `${window.location.origin}${window.location.pathname}#memory-${memoryId}`;
    const shareTitle = memory.title || 'CUET Memory';
    const shareText = `Check this CUET memory: ${shareTitle}`;

    try {
        if (navigator.share) {
            await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(shareUrl);
            showToast('Share link copied to clipboard.', 'success');
        }
    } catch (error) {
        if (error && error.name === 'AbortError') {
            return;
        }
        showToast('Failed to open share dialog.', 'error');
        return;
    }

    try {
        const data = await postMemoryAction(memoryId, 'share', {
            userId: actor.id,
            userName: actor.name,
        });

        updateMemoryInCache(memoryId, (item) => ({
            ...item,
            sharesCount: Number.isFinite(data.sharesCount) ? data.sharesCount : item.sharesCount,
        }));

        refreshOpenDetailPanel(memoryId);
        refreshGallery();
    } catch (error) {
        showToast(error.message || 'Failed to track share.', 'error');
    }
}

// ============================================
// FILE UPLOAD HANDLER
// ============================================
function setupFileUpload() {
    const fileInput = document.getElementById('memory-image');
    const dropZone = document.getElementById('dropZone');
    const filePreview = document.getElementById('filePreview');
    const previewImage = document.getElementById('previewImage');
    const fileName = document.getElementById('fileName');
    const removeFile = document.getElementById('removeFile');
    const uploadContent = dropZone?.querySelector('.upload-content');

    if (!fileInput || !dropZone) return;

    fileInput.addEventListener('change', handleFileSelect);
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--gold)';
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
        
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelect({ target: fileInput });
        }
    });
    
    if (removeFile) {
        removeFile.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.value = '';
            filePreview.style.display = 'none';
            uploadContent.style.display = 'block';
        });
    }

    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (previewImage) previewImage.src = e.target.result;
                if (fileName) fileName.textContent = file.name;
                if (filePreview) filePreview.style.display = 'flex';
                if (uploadContent) uploadContent.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    }
}

// ============================================
// FORM SUBMISSION HANDLER
// ============================================
function setupFormSubmission() {
    const form = document.getElementById('memory-form');

    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();

            if (!isLoggedIn) {
                openModal('loginModal');
                return;
            }

            const title = document.getElementById('memory-title').value;
            const story = document.getElementById('memory-story').value;
            const imageFile = document.getElementById('memory-image').files[0];

            console.log('Memory Submission:', {
                title,
                story,
                location: selectedLocation,
                hasImage: !!imageFile
            });

            // Save to synced storage so it appears on all maps
            if (typeof MemorySync !== 'undefined' && selectedLocation) {
                const newMemory = {
                    lat: selectedLocation.lat,
                    lng: selectedLocation.lng,
                    title: title,
                    story: story,
                    author: 'Anonymous',
                    dept: 'CUET',
                    featured: false,
                    image: null
                };

                if (imageFile) {
                    const reader = new FileReader();
                    reader.onload = function(ev) {
                        newMemory.image = ev.target.result;
                        MemorySync.saveMemory(newMemory);
                        addMemoryMarkers();
                    };
                    reader.readAsDataURL(imageFile);
                } else {
                    MemorySync.saveMemory(newMemory);
                    addMemoryMarkers();
                }
            }

            showToast('Memory submitted for review!', 'success');
            
            // Reset form
            form.reset();
            if (selectedLocation && selectedLocation.marker) {
                selectedLocation.marker.setMap(null);
            }
            selectedLocation = null;
            updateLocationStatus(false);
        });
    }
}

// ============================================
// TOAST NOTIFICATION
// ============================================
function showToast(message, type = 'success') {
    const toast = document.getElementById('successToast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (toast && toastMessage) {
        toastMessage.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// ============================================
// SMOOTH SCROLL FOR NAVIGATION
// ============================================
function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// ============================================
// MOBILE MENU
// ============================================
function setupMobileMenu() {
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    
    if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
        
        // Close menu when link clicked
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
            });
        });
    }
}

// ============================================
// ACTIVE NAV LINK HIGHLIGHT
// ============================================
function setupNavHighlight() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

    window.addEventListener('scroll', () => {
        let current = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (scrollY >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

function getLoggedInUser() {
    try {
        const raw = localStorage.getItem('cuetUser');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function getDefaultAvatarDataUri(name) {
    const initial = (name || 'U').trim().charAt(0).toUpperCase() || 'U';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%' height='100%' fill='%230A9396'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='white' font-family='Poppins, sans-serif' font-size='52' font-weight='700'>${initial}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getStoredLoginState() {
    const stored = localStorage.getItem('isLoggedIn');
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return null;
}

function setLoginState(loggedIn) {
    isLoggedIn = !!loggedIn;
    localStorage.setItem('isLoggedIn', isLoggedIn ? 'true' : 'false');
    renderNavbarActions();
    updateShareActionUI();
}

function syncAuthState() {
    const storedState = getStoredLoginState();
    if (storedState !== null) {
        setLoginState(storedState);
        return;
    }

    const user = getLoggedInUser();
    if (user) {
        setLoginState(true);
        return;
    }

    // Fallback to simulated value when no persistent state exists.
    setLoginState(isLoggedIn);
}

function renderNavbarActions() {
    const container = document.getElementById('navAuthActions');
    if (!container) {
        return;
    }

    if (!isLoggedIn) {
        container.innerHTML = `
            <a href="login.html" class="btn-nav">Login</a>
            <a href="register.html" class="btn-nav-outline">Register</a>
        `;
        return;
    }

    const user = getLoggedInUser() || {};
    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.name || (user.email ? user.email.split('@')[0] : 'CUET User');
    const avatarSrc = user.profileImage || getDefaultAvatarDataUri(displayName);

    container.innerHTML = `
        <span class="nav-user-chip" title="${displayName}">
            <img src="${avatarSrc}" alt="${displayName}" class="nav-user-avatar" onerror="this.src='${getDefaultAvatarDataUri('CUET User')}'">
        </span>
        <a href="user-dashboard.html" class="btn-nav">Dashboard</a>
        <a href="#" id="logoutNavBtn" class="btn-nav-logout">Logout</a>
    `;

    const logoutBtn = document.getElementById('logoutNavBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('cuetUser');
            setLoginState(false);
            showToast('You are logged out.', 'success');
        });
    }
}

function updateShareActionUI() {
    const shareLinks = document.querySelectorAll('a[href="share-memory.html"]');
    shareLinks.forEach(link => {
        link.classList.add('share-action-link');
        link.classList.toggle('share-locked', !isLoggedIn);
        if (!isLoggedIn) {
            link.setAttribute('title', 'Login required to share your memory');
        } else {
            link.removeAttribute('title');
        }
    });
}

function openAuthRequiredModal() {
    const modal = document.getElementById('authRequiredModal');
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeAuthRequiredModal() {
    const modal = document.getElementById('authRequiredModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function setupAuthRequiredModal() {
    const modal = document.getElementById('authRequiredModal');
    const closeBtn = document.getElementById('authRequiredClose');
    const loginBtn = document.getElementById('authRequiredLoginBtn');
    const cancelBtn = document.getElementById('authRequiredCancelBtn');

    if (!modal) {
        return;
    }

    if (closeBtn) closeBtn.addEventListener('click', closeAuthRequiredModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeAuthRequiredModal);
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            window.location.href = 'login.html';
        });
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeAuthRequiredModal();
        }
    });
}

function setupShareActionGate() {
    const shareLinks = document.querySelectorAll('a[href="share-memory.html"]');
    shareLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (isLoggedIn) {
                return;
            }
            e.preventDefault();
            alert('Login required');
            window.location.href = 'login.html';
        });
    });
}

// ============================================
// INITIALIZE EVERYTHING
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Initialize map
    if (document.getElementById('map')) {
        initializeMapWhenReady();
    }
    
    // Setup all features
    setupModals();
    setupGallery();
    setupFileUpload();
    setupFormSubmission();
    setupSmoothScroll();
    setupMobileMenu();
    setupNavHighlight();
    setupAuthRequiredModal();
    setupShareActionGate();
    setupReportModal();
    setupCommentsModal();
    syncAuthState();

    // Re-fetch server memories on load so map pins are always current.
    fetchMemoriesFromServer();
    setupMemoryAutoSync();

    if (typeof ReportSync !== 'undefined') {
        ReportSync.onSync(() => {
            refreshGallery();
        });
    }

    if (typeof ProfileSync !== 'undefined') {
        ProfileSync.onSync(() => {
            syncAuthState();
            refreshGallery();
        });
    }

    if (typeof MemorySync !== 'undefined') {
        MemorySync.onSync(() => {
            fetchMemoriesFromServer();
        });
    }
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

async function initializeMapWhenReady() {
    try {
        await waitForGoogleMaps();
        initMap();
    } catch (error) {
        console.error(error);
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#D4F1F4;background:#001219;">Map failed to load. Please check API key and internet connection.</div>';
        }
    }
}

// Make functions globally accessible
window.closePlaceCard = closePlaceCard;
window.openModal = openModal;
window.closeAllModals = closeAllModals;
window.openMemoryDetail = openMemoryDetail;
window.closeDesktopPanel = closeDesktopPanel;
window.closeMobileOverlay = closeMobileOverlay;
window.setLoginState = setLoginState;
window.reportMemoryPrompt = reportMemoryPrompt;
window.handleMemoryLike = handleMemoryLike;
window.handleMemoryComment = handleMemoryComment;
window.handleMemoryShare = handleMemoryShare;
