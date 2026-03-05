// canvas-icons.js — Iconify icon/logo search + color picker + canvas integration

import { sb } from "./config.js?v=123";

const ICONIFY_SEARCH = 'https://api.iconify.design/search';
const ICONIFY_SVG = 'https://api.iconify.design';
const PER_PAGE = 48;
const LOGO_PER_PAGE = 10;

// --- State ---
let iconCurrentColor = '#000000';
let iconSearchResults = [];
let iconCurrentOffset = 0;
let iconCurrentQuery = '';
let iconDebounceTimer = null;
let iconCurrentMode = 'icon'; // 'icon', 'logo', or 'ornament'
let logoIsOriginalColor = true; // logos default to original colors
let logoPage = 0;
let logoKeyword = '';
let logoHasMore = false;
let logoLoading = false;

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
    const tabOrnament = document.getElementById('iconTabOrnament');
    if (tabOrnament) tabOrnament.onclick = () => switchMode('ornament');

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
    const tabOrnament = document.getElementById('iconTabOrnament');
    const searchInput = document.getElementById('iconSearchInput');
    const tagsContainer = document.getElementById('iconCategoryTags');
    const grid = document.getElementById('iconResultGrid');
    const loadMoreBtn = document.getElementById('iconLoadMore');
    const colorRow = document.getElementById('iconColorRow');

    // Tab style
    if (tabIcon) tabIcon.className = mode === 'icon' ? 'icon-tab active' : 'icon-tab';
    if (tabLogo) tabLogo.className = mode === 'logo' ? 'icon-tab active' : 'icon-tab';
    if (tabOrnament) tabOrnament.className = mode === 'ornament' ? 'icon-tab active' : 'icon-tab';

    // Reset
    if (searchInput) {
        searchInput.value = '';
        searchInput.style.display = mode === 'ornament' ? 'none' : '';
        searchInput.placeholder = mode === 'icon'
            ? (window.t ? window.t('ph_search_icon', 'Search icons (e.g. star, home)') : 'Search icons')
            : (window.t ? window.t('ph_search_logo', 'Search logos') : 'Search logos (e.g. google, nike)');
    }
    // Hide search bar wrapper in ornament mode
    if (searchInput && searchInput.parentElement) {
        searchInput.parentElement.style.display = mode === 'ornament' ? 'none' : '';
    }

    // Rebuild tags
    if (tagsContainer) {
        tagsContainer.innerHTML = '';
        if (mode === 'icon') buildTags(tagsContainer, ICON_TAGS);
        if (mode === 'ornament') buildTags(tagsContainer, ORNAMENT_TAGS);
    }

    // Clear grid and reset columns
    if (grid) {
        grid.innerHTML = '';
        grid.style.gridTemplateColumns = mode === 'logo' ? '1fr' : 'repeat(4, 1fr)';
    }
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';

    // Hide color row in logo/ornament mode
    if (colorRow) colorRow.style.display = (mode === 'logo' || mode === 'ornament') ? 'none' : '';

    iconSearchResults = [];
    iconCurrentOffset = 0;
    iconCurrentQuery = '';
    logoPage = 0;
    logoKeyword = '';

    // Auto-load logos from DB when switching to logo mode
    if (mode === 'logo') {
        logoHasMore = false;
        logoLoading = false;
        setupLogoScroll();
        loadLogos();
    }

    // Load ornaments
    if (mode === 'ornament') {
        renderOrnamentGrid(grid, 'all');
    }
}

function buildTags(container, tags) {
    if (!container) return;
    tags.forEach((tag, idx) => {
        const btn = document.createElement('button');
        btn.textContent = tag.label;
        const isFirst = idx === 0 && iconCurrentMode === 'ornament';
        btn.style.cssText = 'padding:4px 8px; font-size:11px; border:1px solid #e2e8f0; border-radius:12px; cursor:pointer; white-space:nowrap; transition:all 0.15s;'
            + (isFirst ? 'background:#6366f1; color:#fff; border-color:#6366f1;' : 'background:#fff; color:#000;');
        btn.dataset.tagQ = tag.q;
        btn.onmouseenter = () => { btn.style.background = '#6366f1'; btn.style.color = '#fff'; btn.style.borderColor = '#6366f1'; };
        btn.onmouseleave = () => {
            if (!btn.classList.contains('active-tag')) {
                btn.style.background = '#fff'; btn.style.color = '#000'; btn.style.borderColor = '#e2e8f0';
            }
        };
        btn.onclick = () => {
            if (iconCurrentMode === 'ornament') {
                // Ornament: filter by category
                container.querySelectorAll('button').forEach(b => {
                    b.classList.remove('active-tag');
                    b.style.background = '#fff'; b.style.color = '#000'; b.style.borderColor = '#e2e8f0';
                });
                btn.classList.add('active-tag');
                btn.style.background = '#6366f1'; btn.style.color = '#fff'; btn.style.borderColor = '#6366f1';
                const grid = document.getElementById('iconResultGrid');
                renderOrnamentGrid(grid, tag.q);
            } else {
                const searchInput = document.getElementById('iconSearchInput');
                if (searchInput) searchInput.value = tag.q;
                doSearch(tag.q, true);
            }
        };
        if (isFirst) btn.classList.add('active-tag');
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
async function loadLogos(append) {
    const grid = document.getElementById('iconResultGrid');
    if (!grid || !sb) return;
    if (logoLoading) return;
    logoLoading = true;

    if (!append) {
        grid.innerHTML = loadingHtml();
    }

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

        if (!append) grid.innerHTML = '';

        if (!data || data.length === 0) {
            logoHasMore = false;
            if (!append) {
                grid.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:11px; padding:15px;">' +
                    (logoKeyword ? (window.t ? window.t('msg_no_search_result', 'No results') : 'No results') : 'No data') + '</div>';
            }
            logoLoading = false;
            return;
        }

        grid.style.gridTemplateColumns = '1fr';
        data.forEach(item => renderLogoCell(grid, item));
        logoHasMore = data.length >= LOGO_PER_PAGE;
    } catch (err) {
        console.error('[Logos] Load error:', err);
        if (!append) grid.innerHTML = errorHtml();
    }
    logoLoading = false;
}

function renderLogoCell(grid, item) {
    const div = document.createElement('div');
    div.style.cssText = 'cursor:pointer; border-radius:8px; overflow:hidden; height:120px; background-image:linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%); background-size:16px 16px; background-position:0 0,0 8px,8px -8px,-8px 0; border:1px solid #e2e8f0; position:relative; transition:all 0.15s;';

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

// Scroll-based infinite loading for logos
function setupLogoScroll() {
    const panel = document.getElementById('sub-icon');
    if (!panel || panel._logoScrollAttached) return;
    panel._logoScrollAttached = true;
    panel.addEventListener('scroll', () => {
        if (iconCurrentMode !== 'logo' || !logoHasMore || logoLoading) return;
        if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 80) {
            logoPage++;
            loadLogos(true);
        }
    });
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

// ============================================================
// Ornament / Decorative Elements
// ============================================================

const ORNAMENT_TAGS = [
    { label: 'All', q: 'all' },
    { label: 'Divider', q: 'divider' },
    { label: 'Corner', q: 'corner' },
    { label: 'Frame', q: 'frame' },
    { label: 'Flourish', q: 'flourish' },
    { label: 'Arrow', q: 'arrow' },
    { label: 'Line', q: 'line' },
];

// SVG ornament definitions: { id, cat, svg }
// Each svg is a viewBox="0 0 200 40" (dividers) or "0 0 100 100" (corners/frames)
const ORNAMENTS = [
    // --- Dividers ---
    { id:'d1', cat:'divider', svg:'<svg viewBox="0 0 200 30"><path d="M10 15 Q50 0 100 15 Q150 30 190 15" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="100" cy="15" r="3" fill="currentColor"/></svg>' },
    { id:'d2', cat:'divider', svg:'<svg viewBox="0 0 200 30"><path d="M10 15h70" stroke="currentColor" stroke-width="1.2"/><path d="M120 15h70" stroke="currentColor" stroke-width="1.2"/><path d="M90 5 L100 15 L90 25 M110 5 L100 15 L110 25" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { id:'d3', cat:'divider', svg:'<svg viewBox="0 0 200 30"><line x1="10" y1="15" x2="85" y2="15" stroke="currentColor" stroke-width="1"/><circle cx="100" cy="15" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="100" cy="15" r="2" fill="currentColor"/><line x1="115" y1="15" x2="190" y2="15" stroke="currentColor" stroke-width="1"/></svg>' },
    { id:'d4', cat:'divider', svg:'<svg viewBox="0 0 200 30"><path d="M10 15 Q40 5 60 15 Q80 25 100 15 Q120 5 140 15 Q160 25 190 15" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { id:'d5', cat:'divider', svg:'<svg viewBox="0 0 200 40"><path d="M20 20 C40 5, 60 5, 80 20 C85 25, 90 25, 95 20 L100 15 L105 20 C110 25, 115 25, 120 20 C140 5, 160 5, 180 20" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { id:'d6', cat:'divider', svg:'<svg viewBox="0 0 200 30"><line x1="10" y1="15" x2="80" y2="15" stroke="currentColor" stroke-width="1"/><path d="M85 8 Q100 22 115 8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M90 5 Q100 18 110 5" fill="none" stroke="currentColor" stroke-width="1.2"/><line x1="120" y1="15" x2="190" y2="15" stroke="currentColor" stroke-width="1"/></svg>' },
    { id:'d7', cat:'divider', svg:'<svg viewBox="0 0 200 30"><line x1="10" y1="13" x2="190" y2="13" stroke="currentColor" stroke-width="0.8"/><line x1="10" y1="17" x2="190" y2="17" stroke="currentColor" stroke-width="0.8"/><rect x="88" y="8" width="24" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="100" cy="15" r="2" fill="currentColor"/></svg>' },
    { id:'d8', cat:'divider', svg:'<svg viewBox="0 0 200 30"><path d="M10 15h60" stroke="currentColor" stroke-width="1" stroke-dasharray="4,3"/><path d="M80 15 L90 8 L100 15 L90 22Z" fill="currentColor"/><path d="M100 15 L110 8 L120 15 L110 22Z" fill="currentColor"/><path d="M130 15h60" stroke="currentColor" stroke-width="1" stroke-dasharray="4,3"/></svg>' },
    { id:'d9', cat:'divider', svg:'<svg viewBox="0 0 200 40"><path d="M10 20 C30 20, 40 8, 55 8 C65 8, 70 15, 75 20 C80 25, 85 32, 100 32 C115 32, 120 25, 125 20 C130 15, 135 8, 145 8 C160 8, 170 20, 190 20" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { id:'d10', cat:'divider', svg:'<svg viewBox="0 0 200 30"><line x1="10" y1="15" x2="75" y2="15" stroke="currentColor" stroke-width="1"/><path d="M80 15 L88 7 L96 15 L88 23Z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M96 15 L104 7 L112 15 L104 23Z" fill="none" stroke="currentColor" stroke-width="1.2"/><line x1="117" y1="15" x2="190" y2="15" stroke="currentColor" stroke-width="1"/></svg>' },
    { id:'d11', cat:'divider', svg:'<svg viewBox="0 0 200 30"><circle cx="30" cy="15" r="2" fill="currentColor"/><circle cx="50" cy="15" r="2" fill="currentColor"/><circle cx="70" cy="15" r="2" fill="currentColor"/><circle cx="90" cy="15" r="3" fill="currentColor"/><circle cx="100" cy="15" r="4" fill="currentColor"/><circle cx="110" cy="15" r="3" fill="currentColor"/><circle cx="130" cy="15" r="2" fill="currentColor"/><circle cx="150" cy="15" r="2" fill="currentColor"/><circle cx="170" cy="15" r="2" fill="currentColor"/></svg>' },
    { id:'d12', cat:'divider', svg:'<svg viewBox="0 0 200 30"><path d="M10 15h180" stroke="currentColor" stroke-width="0.8"/><path d="M85 5 Q92 15 85 25 M115 5 Q108 15 115 25" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="100" cy="15" r="5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>' },
    { id:'d13', cat:'divider', svg:'<svg viewBox="0 0 200 40"><path d="M20 20 Q40 10 50 20 Q55 25 60 20 Q65 15 70 20 L80 20" stroke="currentColor" fill="none" stroke-width="1.3"/><path d="M80 12 L100 20 L80 28Z" fill="currentColor" opacity="0.7"/><path d="M120 12 L100 20 L120 28Z" fill="currentColor" opacity="0.7"/><path d="M120 20 Q125 15 130 20 Q135 25 140 20 Q150 20 160 20 Q170 10 180 20" stroke="currentColor" fill="none" stroke-width="1.3"/></svg>' },
    { id:'d14', cat:'divider', svg:'<svg viewBox="0 0 200 20"><line x1="10" y1="5" x2="190" y2="5" stroke="currentColor" stroke-width="2"/><line x1="30" y1="10" x2="170" y2="10" stroke="currentColor" stroke-width="1.2"/><line x1="60" y1="15" x2="140" y2="15" stroke="currentColor" stroke-width="0.8"/></svg>' },
    { id:'d15', cat:'divider', svg:'<svg viewBox="0 0 200 30"><path d="M10 15 Q30 5 50 15 T90 15" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M90 10 L100 4 L110 10 L110 20 L100 26 L90 20Z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="100" cy="15" r="2.5" fill="currentColor"/><path d="M110 15 Q130 5 150 15 T190 15" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>' },

    // --- Flourishes ---
    { id:'f1', cat:'flourish', svg:'<svg viewBox="0 0 200 60"><path d="M100 50 C100 30, 60 20, 30 25 C20 27, 15 35, 25 38 C35 41, 50 30, 60 25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M100 50 C100 30, 140 20, 170 25 C180 27, 185 35, 175 38 C165 41, 150 30, 140 25" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="100" cy="50" r="3" fill="currentColor"/></svg>' },
    { id:'f2', cat:'flourish', svg:'<svg viewBox="0 0 200 60"><path d="M30 30 C50 10, 80 10, 100 30 C120 10, 150 10, 170 30" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M50 30 C65 45, 85 45, 100 30 C115 45, 135 45, 150 30" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="100" cy="30" r="3" fill="currentColor"/></svg>' },
    { id:'f3', cat:'flourish', svg:'<svg viewBox="0 0 200 60"><path d="M20 40 C35 20, 55 15, 75 25 C85 30, 90 35, 100 30 C110 35, 115 30, 125 25 C145 15, 165 20, 180 40" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M60 35 Q80 50 100 40 Q120 50 140 35" fill="none" stroke="currentColor" stroke-width="1"/></svg>' },
    { id:'f4', cat:'flourish', svg:'<svg viewBox="0 0 200 50"><path d="M30 25 Q50 5 70 15 Q85 22 100 10 Q115 22 130 15 Q150 5 170 25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M50 35 Q75 20 100 30 Q125 20 150 35" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="100" cy="10" r="2.5" fill="currentColor"/></svg>' },
    { id:'f5', cat:'flourish', svg:'<svg viewBox="0 0 200 50"><path d="M10 25 C25 25, 30 15, 45 15 C55 15, 55 25, 65 25 C75 25, 75 15, 85 15 C90 15, 95 20, 100 25 C105 20, 110 15, 115 15 C125 15, 125 25, 135 25 C145 25, 145 15, 155 15 C170 15, 175 25, 190 25" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },

    // --- Corners ---
    { id:'c1', cat:'corner', svg:'<svg viewBox="0 0 100 100"><path d="M10 90 L10 30 Q10 10 30 10 L90 10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 80 L10 35 Q10 20 25 15 L50 10" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="10" cy="10" r="3" fill="currentColor"/></svg>' },
    { id:'c2', cat:'corner', svg:'<svg viewBox="0 0 100 100"><path d="M5 90 L5 25 C5 12 12 5 25 5 L90 5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 90 L12 30 C12 18 18 12 30 12 L90 12" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="5" cy="5" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>' },
    { id:'c3', cat:'corner', svg:'<svg viewBox="0 0 100 100"><path d="M5 85 L5 5 L85 5" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M5 5 L25 25" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="2" width="6" height="6" fill="currentColor"/></svg>' },
    { id:'c4', cat:'corner', svg:'<svg viewBox="0 0 100 100"><path d="M10 90 C10 50, 10 30, 30 15 Q50 5 90 5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 70 C15 45, 20 30, 35 20 Q50 12 80 10" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="15" cy="15" r="4" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="15" cy="15" r="1.5" fill="currentColor"/></svg>' },
    { id:'c5', cat:'corner', svg:'<svg viewBox="0 0 100 100"><path d="M5 95 L5 5 L95 5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 5 Q20 20 5 35" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 5 Q20 20 35 5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>' },

    // --- Frames ---
    { id:'fr1', cat:'frame', svg:'<svg viewBox="0 0 100 100"><rect x="5" y="5" width="90" height="90" rx="0" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10" y="10" width="80" height="80" rx="0" fill="none" stroke="currentColor" stroke-width="0.8"/></svg>' },
    { id:'fr2', cat:'frame', svg:'<svg viewBox="0 0 100 100"><rect x="5" y="5" width="90" height="90" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="5" cy="5" r="3" fill="currentColor"/><circle cx="95" cy="5" r="3" fill="currentColor"/><circle cx="5" cy="95" r="3" fill="currentColor"/><circle cx="95" cy="95" r="3" fill="currentColor"/></svg>' },
    { id:'fr3', cat:'frame', svg:'<svg viewBox="0 0 100 100"><rect x="8" y="8" width="84" height="84" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 5 L15 5 L5 15Z" fill="currentColor"/><path d="M95 5 L85 5 L95 15Z" fill="currentColor"/><path d="M5 95 L15 95 L5 85Z" fill="currentColor"/><path d="M95 95 L85 95 L95 85Z" fill="currentColor"/></svg>' },
    { id:'fr4', cat:'frame', svg:'<svg viewBox="0 0 100 100"><rect x="5" y="5" width="90" height="90" rx="0" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="6,3"/><rect x="12" y="12" width="76" height="76" rx="0" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { id:'fr5', cat:'frame', svg:'<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="45" ry="45" fill="none" stroke="currentColor" stroke-width="1.5"/><ellipse cx="50" cy="50" rx="40" ry="40" fill="none" stroke="currentColor" stroke-width="0.8"/></svg>' },

    // --- Arrows ---
    { id:'a1', cat:'arrow', svg:'<svg viewBox="0 0 200 30"><line x1="10" y1="15" x2="180" y2="15" stroke="currentColor" stroke-width="1.5"/><path d="M175 8 L190 15 L175 22" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { id:'a2', cat:'arrow', svg:'<svg viewBox="0 0 200 30"><line x1="20" y1="15" x2="180" y2="15" stroke="currentColor" stroke-width="1.5"/><path d="M175 8 L190 15 L175 22" fill="currentColor"/><path d="M25 8 L10 15 L25 22" fill="currentColor"/></svg>' },
    { id:'a3', cat:'arrow', svg:'<svg viewBox="0 0 200 30"><path d="M10 15 C50 5, 80 5, 100 15 C120 25, 150 25, 190 15" fill="none" stroke="currentColor" stroke-width="1.5" marker-end="url(#ah)"/><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10Z" fill="currentColor"/></marker></defs></svg>' },
    { id:'a4', cat:'arrow', svg:'<svg viewBox="0 0 200 30"><path d="M20 15h160" stroke="currentColor" stroke-width="1.5" stroke-dasharray="8,4"/><path d="M175 8 L190 15 L175 22" fill="none" stroke="currentColor" stroke-width="2"/></svg>' },

    // --- Lines ---
    { id:'l1', cat:'line', svg:'<svg viewBox="0 0 200 10"><line x1="10" y1="5" x2="190" y2="5" stroke="currentColor" stroke-width="2"/></svg>' },
    { id:'l2', cat:'line', svg:'<svg viewBox="0 0 200 10"><line x1="10" y1="3" x2="190" y2="3" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="7" x2="190" y2="7" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { id:'l3', cat:'line', svg:'<svg viewBox="0 0 200 10"><line x1="10" y1="5" x2="190" y2="5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="10,5"/></svg>' },
    { id:'l4', cat:'line', svg:'<svg viewBox="0 0 200 10"><line x1="10" y1="5" x2="190" y2="5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2,4"/></svg>' },
    { id:'l5', cat:'line', svg:'<svg viewBox="0 0 200 14"><line x1="10" y1="3" x2="190" y2="3" stroke="currentColor" stroke-width="2.5"/><line x1="10" y1="11" x2="190" y2="11" stroke="currentColor" stroke-width="0.8"/></svg>' },
    { id:'l6', cat:'line', svg:'<svg viewBox="0 0 200 20"><path d="M10 10 Q30 2 50 10 Q70 18 90 10 Q110 2 130 10 Q150 18 170 10 Q190 2 200 10" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
];

function renderOrnamentGrid(grid, category) {
    if (!grid) return;
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = 'repeat(2, 1fr)';

    const items = category === 'all' ? ORNAMENTS : ORNAMENTS.filter(o => o.cat === category);

    items.forEach(item => {
        const cell = document.createElement('div');
        cell.style.cssText = 'border:1px solid #e2e8f0; border-radius:8px; cursor:pointer; padding:8px; background:#fff; transition:all 0.15s; display:flex; align-items:center; justify-content:center; min-height:50px;';
        cell.innerHTML = item.svg.replace(/currentColor/g, '#1e293b');
        cell.querySelector('svg').style.cssText = 'width:100%; height:100%;';

        cell.onmouseenter = () => { cell.style.borderColor = '#6366f1'; cell.style.boxShadow = '0 2px 8px rgba(99,102,241,0.2)'; };
        cell.onmouseleave = () => { cell.style.borderColor = '#e2e8f0'; cell.style.boxShadow = 'none'; };

        cell.onclick = () => addOrnamentToCanvas(item);
        grid.appendChild(cell);
    });
}

function addOrnamentToCanvas(item) {
    const svgText = item.svg.replace(/currentColor/g, '#000000');
    try {
        fabric.loadSVGFromString(svgText, (objects, options) => {
            if (!objects || objects.length === 0) return;
            const group = fabric.util.groupSVGElements(objects, options);

            const canvas = window.canvas;
            if (canvas) {
                const board = canvas.getObjects().find(o => o.isBoard);
                if (board) {
                    const bW = board.width * (board.scaleX || 1);
                    const bH = board.height * (board.scaleY || 1);
                    // corners/frames: 20% of board, dividers/lines: 50% width
                    const isWide = (item.cat === 'divider' || item.cat === 'line' || item.cat === 'arrow' || item.cat === 'flourish');
                    const targetW = isWide ? bW * 0.5 : Math.min(bW, bH) * 0.2;
                    const scale = targetW / Math.max(group.width, 1);
                    group.set({ scaleX: scale, scaleY: scale });
                }
            }

            if (window.addToCenter) {
                window.addToCenter(group);
            }
        });
    } catch (err) {
        console.error('[Ornament] Failed to add:', err);
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
