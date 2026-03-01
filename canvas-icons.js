// canvas-icons.js — Iconify icon/logo search + color picker + canvas integration

import { sb } from "./config.js?v=123";

const ICONIFY_SEARCH = 'https://api.iconify.design/search';
const ICONIFY_SVG = 'https://api.iconify.design';
const PER_PAGE = 48;
const LOGO_PER_PAGE = 4;

// --- State ---
let iconCurrentColor = '#000000';
let iconSearchResults = [];
let iconCurrentOffset = 0;
let iconCurrentQuery = '';
let iconDebounceTimer = null;
let iconCurrentMode = 'icon'; // 'icon' or 'logo'
let logoIsOriginalColor = true; // logos default to original colors
let logoPage = 0;
let logoKeyword = '';

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
            if (iconCurrentMode === 'logo') {
                logoKeyword = q;
                logoPage = 0;
                loadLogos();
            } else if (q.length >= 2) {
                doSearch(q, true);
            } else if (q.length === 0 && iconCurrentMode === 'icon') {
                // Clear icon results when search is empty
                const grid = document.getElementById('iconResultGrid');
                if (grid) grid.innerHTML = '';
                const lmb = document.getElementById('iconLoadMore');
                if (lmb) lmb.style.display = 'none';
            }
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
            iconCurrentColor = '#000000';
            if (colorPicker) colorPicker.value = '#000000';
            recolorGrid();
        };
    }

    // Load more (only for icon mode)
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
            : (window.t ? window.t('ph_search_logo', 'Search logos') : 'Search logos (e.g. google, nike)');
    }

    // Rebuild tags (only for icon mode)
    if (tagsContainer) {
        tagsContainer.innerHTML = '';
        if (mode === 'icon') buildTags(tagsContainer, ICON_TAGS);
    }

    // Clear grid and reset columns
    if (grid) {
        grid.innerHTML = '';
        grid.style.gridTemplateColumns = mode === 'logo' ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)';
    }
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';

    // Hide color row in logo mode
    if (colorRow) colorRow.style.display = mode === 'logo' ? 'none' : '';

    iconSearchResults = [];
    iconCurrentOffset = 0;
    iconCurrentQuery = '';
    logoPage = 0;
    logoKeyword = '';

    // Auto-load logos from DB when switching to logo mode
    if (mode === 'logo') {
        loadLogos();
    }
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
        logoKeyword = query;
        logoPage = 0;
        loadLogos();
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

        icons.forEach(iconId => renderIconCell(grid, iconId));

        if (loadMoreBtn) {
            loadMoreBtn.style.display = (icons.length >= PER_PAGE) ? 'block' : 'none';
        }
    } catch (err) {
        console.error('[Icons] Search error:', err);
        if (reset) grid.innerHTML = errorHtml();
    }
}

// --- Logo from Supabase library ---
async function loadLogos() {
    const grid = document.getElementById('iconResultGrid');
    const loadMoreBtn = document.getElementById('iconLoadMore');
    if (!grid || !sb) return;

    grid.innerHTML = loadingHtml();
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';

    try {
        let query = sb.from('library')
            .select('id, thumb_url, data_url, title, category, tags')
            .eq('status', 'approved')
            .eq('category', 'logo')
            .or('product_key.eq.custom,product_key.is.null,product_key.eq.""')
            .order('created_at', { ascending: true })
            .range(logoPage * LOGO_PER_PAGE, (logoPage + 1) * LOGO_PER_PAGE - 1);

        if (logoKeyword) {
            query = query.or('title.ilike.%' + logoKeyword + '%,tags.ilike.%' + logoKeyword + '%');
        }

        const { data, error } = await query;
        if (error) throw error;

        grid.innerHTML = '';

        if (!data || data.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#94a3b8; font-size:11px; padding:15px;">' +
                (logoKeyword ? (window.t ? window.t('msg_no_search_result', 'No results') : 'No results') : 'No data') + '</div>';
            renderLogoPagination(grid, 0);
            return;
        }

        // Change grid to 2 columns for logos
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';

        data.forEach(item => renderLogoCell(grid, item));

        // Pagination
        renderLogoPagination(grid, data.length);
    } catch (err) {
        console.error('[Logos] Load error:', err);
        grid.innerHTML = errorHtml();
    }
}

function renderLogoCell(grid, item) {
    const div = document.createElement('div');
    div.style.cssText = 'cursor:pointer; border-radius:8px; overflow:hidden; aspect-ratio:1; background-image:linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%); background-size:16px 16px; background-position:0 0,0 8px,8px -8px,-8px 0; border:1px solid #e2e8f0; position:relative; transition:all 0.15s;';

    // Extract PNG URL from data_url or fallback to thumb_url
    const pngUrl = _extractLogoPng(item);
    const imgUrl = pngUrl || (window.getTinyThumb ? window.getTinyThumb(item.thumb_url, 150) : item.thumb_url);

    div.innerHTML = '<img src="' + imgUrl + '" loading="lazy" style="width:100%;height:100%;object-fit:contain;">';
    if (item.title) div.title = item.title;

    div.onmouseenter = () => { div.style.borderColor = '#6366f1'; div.style.boxShadow = '0 2px 8px rgba(99,102,241,0.2)'; };
    div.onmouseleave = () => { div.style.borderColor = '#e2e8f0'; div.style.boxShadow = 'none'; };

    div.onclick = () => {
        window.selectedTpl = item;
        if (window.processLoad) window.processLoad('add');
    };

    grid.appendChild(div);
}

function renderLogoPagination(grid, dataLen) {
    const pgDiv = document.createElement('div');
    pgDiv.style.cssText = 'grid-column:1/-1; display:flex; justify-content:center; gap:10px; padding:10px 0;';

    const prevB = document.createElement('button');
    prevB.style.cssText = 'width:32px; height:32px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center;';
    prevB.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prevB.disabled = logoPage === 0;
    if (prevB.disabled) prevB.style.opacity = '0.4';
    prevB.onclick = () => { logoPage--; loadLogos(); };

    const pageL = document.createElement('span');
    pageL.style.cssText = 'font-weight:bold; color:#64748b; font-size:13px; line-height:32px;';
    pageL.textContent = (logoPage + 1) + '';

    const nextB = document.createElement('button');
    nextB.style.cssText = 'width:32px; height:32px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center;';
    nextB.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    nextB.disabled = dataLen < LOGO_PER_PAGE;
    if (nextB.disabled) nextB.style.opacity = '0.4';
    nextB.onclick = () => { logoPage++; loadLogos(); };

    pgDiv.appendChild(prevB);
    pgDiv.appendChild(pageL);
    pgDiv.appendChild(nextB);
    grid.appendChild(pgDiv);
}

// Extract PNG URL from library item data_url
function _extractLogoPng(item) {
    var raw = item.data_url;
    if (!raw) return null;
    if (typeof raw === 'string') {
        if (raw.startsWith('http') && raw.toLowerCase().includes('.png')) return raw;
        if (raw.startsWith('data:image/png')) return raw;
        try {
            var json = JSON.parse(raw);
            if (json.objects && json.objects.length) {
                for (var i = 0; i < json.objects.length; i++) {
                    var src = json.objects[i].src;
                    if (src && src.startsWith('http')) return src;
                    if (src && src.startsWith('data:image/png')) return src;
                }
            }
        } catch(e) {}
    }
    if (typeof raw === 'object' && raw && raw.objects) {
        for (var i = 0; i < raw.objects.length; i++) {
            var src = raw.objects[i].src;
            if (src && src.startsWith('http')) return src;
            if (src && src.startsWith('data:image/png')) return src;
        }
    }
    return null;
}

function renderIconCell(grid, iconId) {
    const [prefix, name] = iconId.split(':');
    const svgUrl = `${ICONIFY_SVG}/${prefix}/${name}.svg`;

    const cell = document.createElement('div');
    cell.className = 'icon-grid-cell';
    cell.style.cssText = 'aspect-ratio:1; border:1px solid #f1f5f9; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:6px; background:#fff; transition:all 0.15s; position:relative;';
    cell.title = iconId;
    cell.dataset.svgUrl = svgUrl;
    cell.dataset.isLogo = '0';

    // Placeholder img
    const img = document.createElement('img');
    img.src = svgUrl;
    img.style.cssText = 'width:100%; height:100%; object-fit:contain;';
    img.loading = 'lazy';
    cell.appendChild(img);

    // Inline SVG for color control
    fetchAndInlineSvg(svgUrl, cell, false);

    cell.onmouseenter = () => { cell.style.borderColor = '#6366f1'; cell.style.boxShadow = '0 2px 8px rgba(99,102,241,0.2)'; };
    cell.onmouseleave = () => { cell.style.borderColor = '#f1f5f9'; cell.style.boxShadow = 'none'; };

    cell.onclick = () => addIconToCanvas(iconId);

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
        applyColorToSvg(svgEl, iconCurrentColor);
    });
}

async function addIconToCanvas(iconId) {
    const [prefix, name] = iconId.split(':');
    const svgUrl = `${ICONIFY_SVG}/${prefix}/${name}.svg`;

    try {
        const resp = await fetch(svgUrl);
        let svgText = await resp.text();

        // Apply chosen color
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');
        if (!svgEl) return;
        applyColorToSvg(svgEl, iconCurrentColor);
        svgText = new XMLSerializer().serializeToString(svgEl);

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

            group.set({ iconId: iconId, iconColor: iconCurrentColor });

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
