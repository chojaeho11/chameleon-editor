// canvas-icons.js — Iconify icon/logo search + color picker + canvas integration

const ICONIFY_SEARCH = 'https://api.iconify.design/search';
const ICONIFY_SVG = 'https://api.iconify.design';
const PER_PAGE = 48;

// --- State ---
let iconCurrentColor = '#000000';
let iconSearchResults = [];
let iconCurrentOffset = 0;
let iconCurrentQuery = '';
let iconDebounceTimer = null;
let iconCurrentMode = 'icon'; // 'icon' or 'logo'
let logoIsOriginalColor = true; // logos default to original colors

// Logo prefixes to search in (brand icon collections)
const LOGO_PREFIXES = ['simple-icons', 'logos', 'cib', 'devicon', 'skill-icons', 'brandico'];

const ICON_TAGS = [
    { label: '⭐ Star', q: 'star' },
    { label: '🏠 Home', q: 'home' },
    { label: '❤️ Heart', q: 'heart' },
    { label: '➡️ Arrow', q: 'arrow' },
    { label: '✔️ Check', q: 'check' },
    { label: '👤 User', q: 'user' },
    { label: '🛒 Cart', q: 'cart' },
    { label: '📱 Phone', q: 'phone' },
    { label: '✉️ Mail', q: 'mail' },
    { label: '🔒 Lock', q: 'lock' },
    { label: '⚙️ Settings', q: 'settings' },
    { label: '📍 Location', q: 'location' },
    { label: '🔔 Bell', q: 'bell' },
    { label: '📷 Camera', q: 'camera' },
    { label: '🎵 Music', q: 'music' },
    { label: '☁️ Cloud', q: 'cloud' },
];

const LOGO_TAGS = [
    { label: 'Google', q: 'google' },
    { label: 'Apple', q: 'apple' },
    { label: 'Microsoft', q: 'microsoft' },
    { label: 'Amazon', q: 'amazon' },
    { label: 'Meta', q: 'meta' },
    { label: 'Samsung', q: 'samsung' },
    { label: 'Netflix', q: 'netflix' },
    { label: 'Spotify', q: 'spotify' },
    { label: 'Tesla', q: 'tesla' },
    { label: 'Nike', q: 'nike' },
    { label: 'Adidas', q: 'adidas' },
    { label: 'YouTube', q: 'youtube' },
    { label: 'Instagram', q: 'instagram' },
    { label: 'TikTok', q: 'tiktok' },
    { label: 'X Twitter', q: 'twitter' },
    { label: 'LinkedIn', q: 'linkedin' },
    { label: 'GitHub', q: 'github' },
    { label: 'Slack', q: 'slack' },
    { label: 'Discord', q: 'discord' },
    { label: 'Figma', q: 'figma' },
    { label: 'Visa', q: 'visa' },
    { label: 'PayPal', q: 'paypal' },
    { label: 'Stripe', q: 'stripe' },
    { label: 'BMW', q: 'bmw' },
    { label: 'Mercedes', q: 'mercedes' },
    { label: 'Toyota', q: 'toyota' },
    { label: 'Uber', q: 'uber' },
    { label: 'Airbnb', q: 'airbnb' },
    { label: 'Starbucks', q: 'starbucks' },
    { label: 'McDonald', q: 'mcdonalds' },
];

export function initIconTools() {
    const searchInput = document.getElementById('iconSearchInput');
    const colorPicker = document.getElementById('iconColorPicker');
    const colorReset = document.getElementById('iconColorReset');
    const loadMoreBtn = document.getElementById('iconLoadMore');
    const tagsContainer = document.getElementById('iconCategoryTags');
    const tabIcon = document.getElementById('iconTabIcon');
    const tabLogo = document.getElementById('iconTabLogo');

    if (!searchInput) return;

    // Tab switching
    if (tabIcon) tabIcon.onclick = () => switchMode('icon');
    if (tabLogo) tabLogo.onclick = () => switchMode('logo');

    // Build initial tags
    buildTags(tagsContainer, ICON_TAGS);

    // Search: Enter key
    searchInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            doSearch(searchInput.value.trim(), true);
        }
    };

    // Search: debounce
    searchInput.oninput = () => {
        clearTimeout(iconDebounceTimer);
        iconDebounceTimer = setTimeout(() => {
            const q = searchInput.value.trim();
            if (q.length >= 2) doSearch(q, true);
        }, 400);
    };

    // Color picker
    if (colorPicker) {
        colorPicker.oninput = () => {
            iconCurrentColor = colorPicker.value;
            logoIsOriginalColor = false;
            recolorGrid();
        };
    }

    // Reset color
    if (colorReset) {
        colorReset.onclick = () => {
            if (iconCurrentMode === 'logo') {
                // For logos: restore original colors
                logoIsOriginalColor = true;
                iconCurrentColor = '#000000';
                if (colorPicker) colorPicker.value = '#000000';
                // Re-fetch and re-render with original colors
                const grid = document.getElementById('iconResultGrid');
                if (grid) {
                    grid.querySelectorAll('.icon-grid-cell').forEach(cell => {
                        const svgUrl = cell.dataset.svgUrl;
                        if (svgUrl) fetchAndInlineSvg(svgUrl, cell, true);
                    });
                }
            } else {
                iconCurrentColor = '#000000';
                if (colorPicker) colorPicker.value = '#000000';
                recolorGrid();
            }
        };
    }

    // Load more
    if (loadMoreBtn) {
        loadMoreBtn.onclick = () => doSearch(iconCurrentQuery, false);
    }

    // Start with icon mode
    switchMode('icon');
}

function switchMode(mode) {
    iconCurrentMode = mode;
    const tabIcon = document.getElementById('iconTabIcon');
    const tabLogo = document.getElementById('iconTabLogo');
    const searchInput = document.getElementById('iconSearchInput');
    const tagsContainer = document.getElementById('iconCategoryTags');
    const grid = document.getElementById('iconResultGrid');
    const loadMoreBtn = document.getElementById('iconLoadMore');
    const colorRow = document.getElementById('iconColorRow');

    // Tab style
    if (tabIcon && tabLogo) {
        tabIcon.className = mode === 'icon' ? 'icon-tab active' : 'icon-tab';
        tabLogo.className = mode === 'logo' ? 'icon-tab active' : 'icon-tab';
    }

    // Reset
    if (searchInput) {
        searchInput.value = '';
        searchInput.placeholder = mode === 'icon'
            ? (window.t ? window.t('ph_search_icon', 'Search icons (e.g. star, home)') : 'Search icons')
            : (window.t ? window.t('ph_search_logo', 'Search logos (e.g. google, nike)') : 'Search logos');
    }

    // Rebuild tags
    if (tagsContainer) {
        tagsContainer.innerHTML = '';
        buildTags(tagsContainer, mode === 'icon' ? ICON_TAGS : LOGO_TAGS);
    }

    // Clear grid
    if (grid) grid.innerHTML = '';
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';

    // Logo mode: default to original color
    if (mode === 'logo') {
        logoIsOriginalColor = true;
    } else {
        logoIsOriginalColor = false;
    }

    iconSearchResults = [];
    iconCurrentOffset = 0;
    iconCurrentQuery = '';
}

function buildTags(container, tags) {
    if (!container) return;
    tags.forEach(tag => {
        const btn = document.createElement('button');
        btn.textContent = tag.label;
        btn.style.cssText = 'padding:4px 8px; font-size:11px; border:1px solid #e2e8f0; border-radius:12px; background:#fff; cursor:pointer; white-space:nowrap; transition:all 0.15s;';
        btn.onmouseenter = () => { btn.style.background = '#6366f1'; btn.style.color = '#fff'; btn.style.borderColor = '#6366f1'; };
        btn.onmouseleave = () => { btn.style.background = '#fff'; btn.style.color = '#000'; btn.style.borderColor = '#e2e8f0'; };
        btn.onclick = () => {
            const searchInput = document.getElementById('iconSearchInput');
            if (searchInput) searchInput.value = tag.q;
            doSearch(tag.q, true);
        };
        container.appendChild(btn);
    });
}

function doSearch(query, reset) {
    if (iconCurrentMode === 'logo') {
        doLogoSearch(query, reset);
    } else {
        doIconSearch(query, reset);
    }
}

async function doIconSearch(query, reset) {
    if (!query) return;

    const grid = document.getElementById('iconResultGrid');
    const loadMoreBtn = document.getElementById('iconLoadMore');
    if (!grid) return;

    if (reset) {
        iconCurrentOffset = 0;
        iconSearchResults = [];
        grid.innerHTML = loadingHtml();
    }

    iconCurrentQuery = query;

    try {
        const url = `${ICONIFY_SEARCH}?query=${encodeURIComponent(query)}&limit=${PER_PAGE}&start=${iconCurrentOffset}`;
        const resp = await fetch(url);
        const data = await resp.json();
        const icons = data.icons || [];

        if (reset && icons.length === 0) {
            grid.innerHTML = noResultsHtml();
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }

        if (reset) grid.innerHTML = '';

        iconSearchResults = iconSearchResults.concat(icons);
        iconCurrentOffset += icons.length;

        icons.forEach(iconId => renderIconCell(grid, iconId, false));

        if (loadMoreBtn) {
            loadMoreBtn.style.display = (icons.length >= PER_PAGE) ? 'block' : 'none';
        }
    } catch (err) {
        console.error('[Icons] Search error:', err);
        if (reset) grid.innerHTML = errorHtml();
    }
}

async function doLogoSearch(query, reset) {
    if (!query) return;

    const grid = document.getElementById('iconResultGrid');
    const loadMoreBtn = document.getElementById('iconLoadMore');
    if (!grid) return;

    if (reset) {
        iconCurrentOffset = 0;
        iconSearchResults = [];
        grid.innerHTML = loadingHtml();
    }

    iconCurrentQuery = query;

    try {
        // Search across multiple logo collections in parallel
        const searches = LOGO_PREFIXES.map(prefix =>
            fetch(`${ICONIFY_SEARCH}?query=${encodeURIComponent(query)}&prefix=${prefix}&limit=24&start=${iconCurrentOffset}`)
                .then(r => r.json())
                .catch(() => ({ icons: [] }))
        );

        const results = await Promise.all(searches);
        let allIcons = [];
        results.forEach(data => {
            if (data.icons) allIcons = allIcons.concat(data.icons);
        });

        // Deduplicate
        const seen = new Set();
        allIcons = allIcons.filter(id => {
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });

        if (reset && allIcons.length === 0) {
            grid.innerHTML = noResultsHtml();
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }

        if (reset) grid.innerHTML = '';

        iconSearchResults = iconSearchResults.concat(allIcons);
        iconCurrentOffset += 24; // For next page

        allIcons.forEach(iconId => renderIconCell(grid, iconId, true));

        if (loadMoreBtn) {
            loadMoreBtn.style.display = (allIcons.length >= 6) ? 'block' : 'none';
        }
    } catch (err) {
        console.error('[Logos] Search error:', err);
        if (reset) grid.innerHTML = errorHtml();
    }
}

function renderIconCell(grid, iconId, isLogo) {
    const [prefix, name] = iconId.split(':');
    const svgUrl = `${ICONIFY_SVG}/${prefix}/${name}.svg`;

    const cell = document.createElement('div');
    cell.className = 'icon-grid-cell';
    cell.style.cssText = 'aspect-ratio:1; border:1px solid #f1f5f9; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:6px; background:#fff; transition:all 0.15s; position:relative;';
    cell.title = iconId;
    cell.dataset.svgUrl = svgUrl;
    cell.dataset.isLogo = isLogo ? '1' : '0';

    // Placeholder img
    const img = document.createElement('img');
    img.src = svgUrl;
    img.style.cssText = 'width:100%; height:100%; object-fit:contain;';
    img.loading = 'lazy';
    cell.appendChild(img);

    // Inline SVG for color control
    const keepOriginal = isLogo && logoIsOriginalColor;
    fetchAndInlineSvg(svgUrl, cell, keepOriginal);

    cell.onmouseenter = () => { cell.style.borderColor = '#6366f1'; cell.style.boxShadow = '0 2px 8px rgba(99,102,241,0.2)'; };
    cell.onmouseleave = () => { cell.style.borderColor = '#f1f5f9'; cell.style.boxShadow = 'none'; };

    cell.onclick = () => addIconToCanvas(iconId, isLogo && logoIsOriginalColor);

    grid.appendChild(cell);
}

async function fetchAndInlineSvg(url, cell, keepOriginal) {
    try {
        const resp = await fetch(url);
        const svgText = await resp.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');
        if (!svgEl) return;

        svgEl.style.cssText = 'width:100%; height:100%;';
        svgEl.removeAttribute('width');
        svgEl.removeAttribute('height');

        // Apply color only if not keeping original
        if (!keepOriginal) {
            applyColorToSvg(svgEl, iconCurrentColor);
        }

        cell.innerHTML = '';
        cell.appendChild(svgEl);
    } catch (e) {
        // Keep img fallback
    }
}

function applyColorToSvg(svgEl, color) {
    svgEl.setAttribute('fill', color);
    svgEl.querySelectorAll('path, circle, rect, polygon, polyline, ellipse, line').forEach(el => {
        const currentFill = el.getAttribute('fill');
        if (currentFill !== 'none') {
            el.setAttribute('fill', color);
        }
        const currentStroke = el.getAttribute('stroke');
        if (currentStroke && currentStroke !== 'none') {
            el.setAttribute('stroke', color);
        }
    });
}

function recolorGrid() {
    const grid = document.getElementById('iconResultGrid');
    if (!grid) return;
    grid.querySelectorAll('.icon-grid-cell').forEach(cell => {
        const svgEl = cell.querySelector('svg');
        if (!svgEl) return;
        const isLogo = cell.dataset.isLogo === '1';
        if (isLogo && logoIsOriginalColor) return; // Don't recolor original logos
        applyColorToSvg(svgEl, iconCurrentColor);
    });
}

async function addIconToCanvas(iconId, keepOriginal) {
    const [prefix, name] = iconId.split(':');
    const svgUrl = `${ICONIFY_SVG}/${prefix}/${name}.svg`;

    try {
        const resp = await fetch(svgUrl);
        let svgText = await resp.text();

        if (!keepOriginal) {
            // Apply chosen color
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, 'image/svg+xml');
            const svgEl = doc.querySelector('svg');
            if (!svgEl) return;
            applyColorToSvg(svgEl, iconCurrentColor);
            svgText = new XMLSerializer().serializeToString(svgEl);
        }

        fabric.loadSVGFromString(svgText, (objects, options) => {
            if (!objects || objects.length === 0) return;

            const group = fabric.util.groupSVGElements(objects, options);

            // Scale to ~15% of board size
            const canvas = window.canvas;
            if (canvas) {
                const board = canvas.getObjects().find(o => o.isBoard);
                if (board) {
                    const targetSize = Math.min(board.width * board.scaleX, board.height * board.scaleY) * 0.15;
                    const maxDim = Math.max(group.width, group.height);
                    if (maxDim > 0) {
                        const scale = targetSize / maxDim;
                        group.set({ scaleX: scale, scaleY: scale });
                    }
                }
            }

            group.set({ iconId: iconId, iconColor: keepOriginal ? 'original' : iconCurrentColor });

            if (window.addToCenter) {
                window.addToCenter(group);
            }
        });
    } catch (err) {
        console.error('[Icons] Failed to add:', err);
        if (window.showToast) window.showToast('Failed to add icon', 'error');
    }
}

// --- HTML helpers ---
function loadingHtml() {
    return '<div style="grid-column:1/-1; text-align:center; color:#94a3b8; font-size:12px; padding:20px;">' +
        (window.t ? window.t('icon_loading', 'Searching...') : 'Searching...') + '</div>';
}
function noResultsHtml() {
    return '<div style="grid-column:1/-1; text-align:center; color:#94a3b8; font-size:12px; padding:20px;">' +
        (window.t ? window.t('icon_no_results', 'No results found') : 'No results found') + '</div>';
}
function errorHtml() {
    return '<div style="grid-column:1/-1; text-align:center; color:#ef4444; font-size:12px; padding:20px;">Error</div>';
}
