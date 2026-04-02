// canvas-icons.js — Iconify icon/logo search + color picker + canvas integration

import { sb } from "./config.js?v=288";

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
            if (iconCurrentMode === 'ornament') {
                ornamentColor = colorPicker.value;
                _recolorOrnamentGrid();
            } else {
                recolorGrid();
            }
        };
    }

    // Reset color
    if (colorReset) {
        colorReset.onclick = () => {
            iconCurrentColor = '#000000';
            ornamentColor = '#000000';
            if (colorPicker) colorPicker.value = '#000000';
            if (iconCurrentMode === 'ornament') {
                _recolorOrnamentGrid();
            } else {
                recolorGrid();
            }
        };
    }

    // Load more (only for icon mode)
    if (loadMoreBtn) {
        loadMoreBtn.onclick = () => doSearch(iconCurrentQuery, false);
    }

    // Start with ornament mode (default tab)
    switchMode('ornament');
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

    // Hide color row in logo mode only; show for icon and ornament
    if (colorRow) colorRow.style.display = mode === 'logo' ? 'none' : '';

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
            .order('created_at', { ascending: false })
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
        if (raw.startsWith('http') && raw.endsWith('.json')) return item.thumb_url || null;
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

let ornamentColor = '#000000';

const ORNAMENT_TAGS = [
    { label: 'All', q: 'all' },
    { label: 'Divider', q: 'divider' },
    { label: 'Flourish', q: 'flourish' },
    { label: 'Corner', q: 'corner' },
    { label: 'Frame', q: 'frame' },
    { label: 'Flower', q: 'flower' },
    { label: 'Leaf', q: 'leaf' },
    { label: 'Arrow', q: 'arrow' },
    { label: 'Line', q: 'line' },
    { label: 'Badge', q: 'badge' },
    { label: 'Heart', q: 'heart' },
    { label: 'Star', q: 'star' },
];

// color:true = multicolor (don't recolor preview), color:false/undefined = mono (use ornamentColor)
const ORNAMENTS = [
    // ─── Dividers (20) ───
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
    { id:'d16', cat:'divider', svg:'<svg viewBox="0 0 200 30"><path d="M10 15 C30 15, 40 5, 55 5 L80 5" stroke="currentColor" fill="none" stroke-width="1.2"/><rect x="82" y="5" width="36" height="20" rx="10" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="100" cy="15" r="3" fill="currentColor"/><path d="M120 5 L145 5 C160 5, 170 15, 190 15" stroke="currentColor" fill="none" stroke-width="1.2"/></svg>' },
    { id:'d17', cat:'divider', svg:'<svg viewBox="0 0 200 30"><path d="M10 15h65" stroke="currentColor" stroke-width="1"/><path d="M85 15 L92 8 L100 15 L108 8 L115 15" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M85 15 L92 22 L100 15 L108 22 L115 15" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M125 15h65" stroke="currentColor" stroke-width="1"/></svg>' },
    { id:'d18', cat:'divider', svg:'<svg viewBox="0 0 200 30"><line x1="10" y1="15" x2="190" y2="15" stroke="currentColor" stroke-width="0.6"/><circle cx="50" cy="15" r="4" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="100" cy="15" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="150" cy="15" r="4" fill="none" stroke="currentColor" stroke-width="1"/></svg>' },
    { id:'d19', cat:'divider', svg:'<svg viewBox="0 0 200 36"><path d="M10 18h60" stroke="currentColor" stroke-width="1"/><path d="M80 8 Q90 18, 80 28 Q90 18, 100 28 Q110 18, 100 8 Q90 18, 80 8Z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M100 8 Q110 18, 100 28 Q110 18, 120 28 Q130 18, 120 8 Q110 18, 100 8Z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M130 18h60" stroke="currentColor" stroke-width="1"/></svg>' },
    { id:'d20', cat:'divider', svg:'<svg viewBox="0 0 200 30"><line x1="10" y1="15" x2="70" y2="15" stroke="currentColor" stroke-width="1.5"/><path d="M75 15 L85 5 L95 15 L85 25Z" fill="currentColor" opacity="0.3"/><path d="M95 15 L100 10 L105 15 L100 20Z" fill="currentColor"/><path d="M105 15 L115 5 L125 15 L115 25Z" fill="currentColor" opacity="0.3"/><line x1="130" y1="15" x2="190" y2="15" stroke="currentColor" stroke-width="1.5"/></svg>' },

    // ─── Flourishes (10) ───
    { id:'f1', cat:'flourish', svg:'<svg viewBox="0 0 200 60"><path d="M100 50 C100 30, 60 20, 30 25 C20 27, 15 35, 25 38 C35 41, 50 30, 60 25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M100 50 C100 30, 140 20, 170 25 C180 27, 185 35, 175 38 C165 41, 150 30, 140 25" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="100" cy="50" r="3" fill="currentColor"/></svg>' },
    { id:'f2', cat:'flourish', svg:'<svg viewBox="0 0 200 60"><path d="M30 30 C50 10, 80 10, 100 30 C120 10, 150 10, 170 30" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M50 30 C65 45, 85 45, 100 30 C115 45, 135 45, 150 30" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="100" cy="30" r="3" fill="currentColor"/></svg>' },
    { id:'f3', cat:'flourish', svg:'<svg viewBox="0 0 200 60"><path d="M20 40 C35 20, 55 15, 75 25 C85 30, 90 35, 100 30 C110 35, 115 30, 125 25 C145 15, 165 20, 180 40" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M60 35 Q80 50 100 40 Q120 50 140 35" fill="none" stroke="currentColor" stroke-width="1"/></svg>' },
    { id:'f4', cat:'flourish', svg:'<svg viewBox="0 0 200 50"><path d="M30 25 Q50 5 70 15 Q85 22 100 10 Q115 22 130 15 Q150 5 170 25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M50 35 Q75 20 100 30 Q125 20 150 35" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="100" cy="10" r="2.5" fill="currentColor"/></svg>' },
    { id:'f5', cat:'flourish', svg:'<svg viewBox="0 0 200 50"><path d="M10 25 C25 25, 30 15, 45 15 C55 15, 55 25, 65 25 C75 25, 75 15, 85 15 C90 15, 95 20, 100 25 C105 20, 110 15, 115 15 C125 15, 125 25, 135 25 C145 25, 145 15, 155 15 C170 15, 175 25, 190 25" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { id:'f6', cat:'flourish', svg:'<svg viewBox="0 0 200 60"><path d="M40 50 C25 35, 25 15, 50 15 C65 15, 70 25, 65 35 C60 45, 45 45, 50 35" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M50 15 L100 10 L150 15" fill="none" stroke="currentColor" stroke-width="1"/><path d="M160 50 C175 35, 175 15, 150 15 C135 15, 130 25, 135 35 C140 45, 155 45, 150 35" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="100" cy="10" r="3" fill="currentColor"/></svg>' },
    { id:'f7', cat:'flourish', svg:'<svg viewBox="0 0 200 50"><path d="M10 25 Q30 5, 50 15 Q60 20, 70 10 Q80 0, 90 10 L100 25 L110 10 Q120 0, 130 10 Q140 20, 150 15 Q170 5, 190 25" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { id:'f8', cat:'flourish', svg:'<svg viewBox="0 0 200 60"><path d="M20 30 C20 15, 40 10, 55 15 C65 18, 70 25, 80 25 L90 25" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M180 30 C180 15, 160 10, 145 15 C135 18, 130 25, 120 25 L110 25" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M90 20 L100 12 L110 20 L110 30 L100 38 L90 30Z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="100" cy="25" r="3" fill="currentColor"/></svg>' },
    { id:'f9', cat:'flourish', svg:'<svg viewBox="0 0 200 55"><path d="M30 28 C30 10, 60 5, 80 15 L95 22" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M170 28 C170 10, 140 5, 120 15 L105 22" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M95 22 Q100 30, 105 22" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M30 28 C30 46, 60 50, 80 40 L95 33" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M170 28 C170 46, 140 50, 120 40 L105 33" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M95 33 Q100 25, 105 33" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>' },
    { id:'f10', cat:'flourish', svg:'<svg viewBox="0 0 200 50"><path d="M15 25 C30 5, 60 5, 80 20 C85 25, 90 28, 100 25 C110 28, 115 25, 120 20 C140 5, 170 5, 185 25" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="90" y1="35" x2="110" y2="35" stroke="currentColor" stroke-width="1"/><circle cx="100" cy="42" r="2" fill="currentColor"/></svg>' },

    // ─── Corners (8) ───
    { id:'c1', cat:'corner', svg:'<svg viewBox="0 0 100 100"><path d="M10 90 L10 30 Q10 10 30 10 L90 10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 80 L10 35 Q10 20 25 15 L50 10" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="10" cy="10" r="3" fill="currentColor"/></svg>' },
    { id:'c2', cat:'corner', svg:'<svg viewBox="0 0 100 100"><path d="M5 90 L5 25 C5 12 12 5 25 5 L90 5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 90 L12 30 C12 18 18 12 30 12 L90 12" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="5" cy="5" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>' },
    { id:'c3', cat:'corner', svg:'<svg viewBox="0 0 100 100"><path d="M5 85 L5 5 L85 5" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M5 5 L25 25" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="2" width="6" height="6" fill="currentColor"/></svg>' },
    { id:'c4', cat:'corner', svg:'<svg viewBox="0 0 100 100"><path d="M10 90 C10 50, 10 30, 30 15 Q50 5 90 5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 70 C15 45, 20 30, 35 20 Q50 12 80 10" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="15" cy="15" r="4" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="15" cy="15" r="1.5" fill="currentColor"/></svg>' },
    { id:'c5', cat:'corner', svg:'<svg viewBox="0 0 100 100"><path d="M5 95 L5 5 L95 5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 5 Q20 20 5 35" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 5 Q20 20 35 5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>' },
    { id:'c6', cat:'corner', svg:'<svg viewBox="0 0 100 100"><path d="M8 90 L8 40 C8 20, 20 8, 40 8 L90 8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M18 50 C18 30, 30 18, 50 18" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="18" cy="18" r="5" fill="none" stroke="currentColor" stroke-width="1"/><path d="M16 16 L20 20 M20 16 L16 20" stroke="currentColor" stroke-width="0.8"/></svg>' },
    { id:'c7', cat:'corner', svg:'<svg viewBox="0 0 100 100"><path d="M5 90 L5 5 L90 5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="5" cy="5" r="4" fill="currentColor"/><circle cx="5" cy="25" r="2" fill="currentColor"/><circle cx="25" cy="5" r="2" fill="currentColor"/></svg>' },
    { id:'c8', cat:'corner', svg:'<svg viewBox="0 0 100 100"><path d="M5 80 Q5 5, 80 5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 65 Q15 15, 65 15" fill="none" stroke="currentColor" stroke-width="1"/><path d="M5 5 Q20 15, 5 30" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 5 Q15 20, 30 5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>' },

    // ─── Frames (8) ───
    { id:'fr1', cat:'frame', svg:'<svg viewBox="0 0 100 100"><rect x="5" y="5" width="90" height="90" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10" y="10" width="80" height="80" fill="none" stroke="currentColor" stroke-width="0.8"/></svg>' },
    { id:'fr2', cat:'frame', svg:'<svg viewBox="0 0 100 100"><rect x="5" y="5" width="90" height="90" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="5" cy="5" r="3" fill="currentColor"/><circle cx="95" cy="5" r="3" fill="currentColor"/><circle cx="5" cy="95" r="3" fill="currentColor"/><circle cx="95" cy="95" r="3" fill="currentColor"/></svg>' },
    { id:'fr3', cat:'frame', svg:'<svg viewBox="0 0 100 100"><rect x="8" y="8" width="84" height="84" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 5 L15 5 L5 15Z" fill="currentColor"/><path d="M95 5 L85 5 L95 15Z" fill="currentColor"/><path d="M5 95 L15 95 L5 85Z" fill="currentColor"/><path d="M95 95 L85 95 L95 85Z" fill="currentColor"/></svg>' },
    { id:'fr4', cat:'frame', svg:'<svg viewBox="0 0 100 100"><rect x="5" y="5" width="90" height="90" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="6,3"/><rect x="12" y="12" width="76" height="76" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { id:'fr5', cat:'frame', svg:'<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="45" ry="45" fill="none" stroke="currentColor" stroke-width="1.5"/><ellipse cx="50" cy="50" rx="40" ry="40" fill="none" stroke="currentColor" stroke-width="0.8"/></svg>' },
    { id:'fr6', cat:'frame', svg:'<svg viewBox="0 0 100 100"><rect x="5" y="5" width="90" height="90" rx="12" fill="none" stroke="currentColor" stroke-width="2"/><line x1="5" y1="25" x2="15" y2="25" stroke="currentColor" stroke-width="1.5"/><line x1="85" y1="25" x2="95" y2="25" stroke="currentColor" stroke-width="1.5"/><line x1="5" y1="75" x2="15" y2="75" stroke="currentColor" stroke-width="1.5"/><line x1="85" y1="75" x2="95" y2="75" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { id:'fr7', cat:'frame', svg:'<svg viewBox="0 0 100 100"><path d="M50 3 L97 50 L50 97 L3 50Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M50 12 L88 50 L50 88 L12 50Z" fill="none" stroke="currentColor" stroke-width="0.8"/></svg>' },
    { id:'fr8', cat:'frame', svg:'<svg viewBox="0 0 100 100"><rect x="8" y="8" width="84" height="84" rx="4" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="3" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="87" y="3" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="3" y="87" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="87" y="87" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>' },

    // ─── Flowers (multicolor) (12) ───
    { id:'fl1', cat:'flower', color:true, svg:'<svg viewBox="0 0 100 100"><circle cx="50" cy="32" r="12" fill="#ff6b8a" opacity="0.85"/><circle cx="35" cy="45" r="12" fill="#ff8fa3" opacity="0.8"/><circle cx="65" cy="45" r="12" fill="#ff8fa3" opacity="0.8"/><circle cx="40" cy="62" r="12" fill="#ffb3c1" opacity="0.75"/><circle cx="60" cy="62" r="12" fill="#ffb3c1" opacity="0.75"/><circle cx="50" cy="50" r="8" fill="#ffd700"/></svg>' },
    { id:'fl2', cat:'flower', color:true, svg:'<svg viewBox="0 0 100 100"><path d="M50 20 Q55 35, 70 30 Q55 40, 60 55 Q50 42, 40 55 Q45 40, 30 30 Q45 35, 50 20Z" fill="#e879f9" opacity="0.8"/><circle cx="50" cy="38" r="6" fill="#fbbf24"/><path d="M48 55 Q48 80, 50 90 Q52 80, 52 55" fill="#22c55e"/><path d="M50 70 Q40 62, 35 55" fill="none" stroke="#22c55e" stroke-width="1.5"/><path d="M50 75 Q60 67, 65 60" fill="none" stroke="#22c55e" stroke-width="1.5"/></svg>' },
    { id:'fl3', cat:'flower', color:true, svg:'<svg viewBox="0 0 100 100"><ellipse cx="50" cy="25" rx="8" ry="14" fill="#f472b6" transform="rotate(0,50,50)"/><ellipse cx="50" cy="25" rx="8" ry="14" fill="#fb7185" transform="rotate(72,50,50)"/><ellipse cx="50" cy="25" rx="8" ry="14" fill="#f472b6" transform="rotate(144,50,50)"/><ellipse cx="50" cy="25" rx="8" ry="14" fill="#fb7185" transform="rotate(216,50,50)"/><ellipse cx="50" cy="25" rx="8" ry="14" fill="#f472b6" transform="rotate(288,50,50)"/><circle cx="50" cy="50" r="7" fill="#facc15"/></svg>' },
    { id:'fl4', cat:'flower', color:true, svg:'<svg viewBox="0 0 100 100"><circle cx="50" cy="30" r="10" fill="#93c5fd"/><circle cx="30" cy="50" r="10" fill="#a5b4fc"/><circle cx="70" cy="50" r="10" fill="#a5b4fc"/><circle cx="50" cy="70" r="10" fill="#93c5fd"/><circle cx="50" cy="50" r="7" fill="#fde68a"/></svg>' },
    { id:'fl5', cat:'flower', color:true, svg:'<svg viewBox="0 0 100 100"><path d="M50 15 C55 25, 65 30, 75 25 C70 35, 75 45, 85 50 C75 55, 70 65, 75 75 C65 70, 55 75, 50 85 C45 75, 35 70, 25 75 C30 65, 25 55, 15 50 C25 45, 30 35, 25 25 C35 30, 45 25, 50 15Z" fill="#fca5a5" stroke="#f87171" stroke-width="1"/><circle cx="50" cy="50" r="10" fill="#fef08a"/><circle cx="47" cy="47" r="2" fill="#d97706"/><circle cx="53" cy="47" r="2" fill="#d97706"/><circle cx="50" cy="53" r="2" fill="#d97706"/></svg>' },
    { id:'fl6', cat:'flower', color:true, svg:'<svg viewBox="0 0 100 100"><path d="M50 10 L55 40 L85 35 L60 50 L85 65 L55 60 L50 90 L45 60 L15 65 L40 50 L15 35 L45 40Z" fill="#c084fc" stroke="#a855f7" stroke-width="0.8"/><circle cx="50" cy="50" r="8" fill="#fde68a"/></svg>' },
    { id:'fl7', cat:'flower', color:true, svg:'<svg viewBox="0 0 120 50"><path d="M25 25 C20 15, 30 8, 35 18 C38 8, 48 15, 43 25" fill="#f87171"/><circle cx="34" cy="22" r="3" fill="#fbbf24"/><path d="M60 25 C55 15, 65 8, 70 18 C73 8, 83 15, 78 25" fill="#fb923c"/><circle cx="69" cy="22" r="3" fill="#fde68a"/><path d="M95 25 C90 15, 100 8, 105 18 C108 8, 118 15, 113 25" fill="#a78bfa"/><circle cx="104" cy="22" r="3" fill="#fcd34d"/><path d="M25 30 Q35 45, 60 30 Q75 45, 95 30" fill="none" stroke="#22c55e" stroke-width="1.5"/><path d="M40 36 Q38 32, 35 35" fill="none" stroke="#22c55e" stroke-width="1"/><path d="M80 36 Q82 32, 85 35" fill="none" stroke="#22c55e" stroke-width="1"/></svg>' },
    { id:'fl8', cat:'flower', color:true, svg:'<svg viewBox="0 0 100 100"><path d="M50 20 Q58 30, 50 40 Q42 30, 50 20Z" fill="#f9a8d4"/><path d="M50 20 Q58 30, 50 40 Q42 30, 50 20Z" fill="#f9a8d4" transform="rotate(60,50,40)"/><path d="M50 20 Q58 30, 50 40 Q42 30, 50 20Z" fill="#f9a8d4" transform="rotate(120,50,40)"/><path d="M50 20 Q58 30, 50 40 Q42 30, 50 20Z" fill="#f9a8d4" transform="rotate(180,50,40)"/><path d="M50 20 Q58 30, 50 40 Q42 30, 50 20Z" fill="#f9a8d4" transform="rotate(240,50,40)"/><path d="M50 20 Q58 30, 50 40 Q42 30, 50 20Z" fill="#f9a8d4" transform="rotate(300,50,40)"/><circle cx="50" cy="40" r="5" fill="#fbbf24"/><path d="M48 50 C47 70, 49 85, 50 95" stroke="#16a34a" stroke-width="2" fill="none"/><path d="M50 65 C55 58, 62 55, 68 58" stroke="#16a34a" stroke-width="1.5" fill="none"/><path d="M50 78 C45 72, 38 70, 32 73" stroke="#16a34a" stroke-width="1.5" fill="none"/></svg>' },
    { id:'fl9', cat:'flower', color:true, svg:'<svg viewBox="0 0 100 50"><circle cx="15" cy="25" r="8" fill="#fda4af"/><circle cx="15" cy="25" r="4" fill="#fde68a"/><circle cx="40" cy="20" r="10" fill="#c4b5fd"/><circle cx="40" cy="20" r="5" fill="#fef08a"/><circle cx="65" cy="25" r="7" fill="#86efac"/><circle cx="65" cy="25" r="3.5" fill="#fde68a"/><circle cx="88" cy="22" r="9" fill="#7dd3fc"/><circle cx="88" cy="22" r="4.5" fill="#fef9c3"/><path d="M5 38 Q15 32, 25 38 Q40 30, 55 38 Q65 32, 75 38 Q88 30, 95 38" fill="none" stroke="#4ade80" stroke-width="1.5"/></svg>' },
    { id:'fl10', cat:'flower', color:true, svg:'<svg viewBox="0 0 100 100"><path d="M50 5 C60 20, 75 20, 80 10 C78 25, 90 35, 95 30 C88 42, 92 55, 98 55 C85 58, 80 70, 85 80 C72 72, 60 78, 55 88 C52 75, 40 70, 30 78 C38 68, 32 55, 20 52 C32 48, 35 35, 25 28 C38 32, 42 22, 40 10 C48 20, 50 5, 50 5Z" fill="none" stroke="#f472b6" stroke-width="1.5"/><circle cx="50" cy="45" r="12" fill="#fecdd3"/><circle cx="50" cy="45" r="6" fill="#fbbf24"/></svg>' },
    { id:'fl11', cat:'flower', color:true, svg:'<svg viewBox="0 0 200 60"><path d="M30 30 Q50 10, 70 25" fill="none" stroke="#16a34a" stroke-width="1.5"/><circle cx="28" cy="28" r="8" fill="#fda4af"/><circle cx="28" cy="28" r="3.5" fill="#fde68a"/><path d="M55 25 Q40 18, 35 30" fill="none" stroke="#16a34a" stroke-width="1"/><path d="M70 25 Q100 15, 130 25" fill="none" stroke="#16a34a" stroke-width="1.5"/><circle cx="100" cy="18" r="6" fill="#c4b5fd"/><circle cx="100" cy="18" r="3" fill="#fef08a"/><path d="M130 25 Q150 10, 172 28" fill="none" stroke="#16a34a" stroke-width="1.5"/><circle cx="174" cy="26" r="8" fill="#7dd3fc"/><circle cx="174" cy="26" r="3.5" fill="#fde68a"/><path d="M148 22 Q160 18, 168 25" fill="none" stroke="#16a34a" stroke-width="1"/></svg>' },
    { id:'fl12', cat:'flower', color:true, svg:'<svg viewBox="0 0 100 100"><path d="M50 50 C30 30, 10 40, 20 55 C10 65, 25 80, 40 70 C35 85, 55 90, 55 75 C65 85, 80 80, 70 65 C85 65, 85 45, 70 48 C80 35, 65 25, 55 38 C55 22, 38 22, 42 38 C30 28, 20 40, 35 48Z" fill="#fb7185" opacity="0.7" stroke="#e11d48" stroke-width="0.8"/><circle cx="50" cy="52" r="7" fill="#fde047"/></svg>' },

    // ─── Leaves (8) ───
    { id:'lf1', cat:'leaf', color:true, svg:'<svg viewBox="0 0 100 100"><path d="M50 10 C25 25, 10 55, 30 85 Q50 70, 70 85 C90 55, 75 25, 50 10Z" fill="#4ade80" opacity="0.7" stroke="#16a34a" stroke-width="1.2"/><path d="M50 15 L50 80" stroke="#16a34a" stroke-width="1" fill="none"/><path d="M50 30 L35 40 M50 45 L65 38 M50 55 L38 62 M50 65 L62 58" stroke="#16a34a" stroke-width="0.8" fill="none"/></svg>' },
    { id:'lf2', cat:'leaf', color:true, svg:'<svg viewBox="0 0 200 60"><path d="M10 40 Q30 10, 60 20 Q80 5, 100 15 Q120 5, 140 20 Q170 10, 190 40" fill="none" stroke="#16a34a" stroke-width="1.5"/><path d="M40 18 C45 12, 52 14, 48 22" fill="#86efac"/><path d="M80 10 C85 4, 92 6, 88 14" fill="#86efac"/><path d="M120 10 C125 4, 132 6, 128 14" fill="#86efac"/><path d="M160 18 C165 12, 172 14, 168 22" fill="#86efac"/></svg>' },
    { id:'lf3', cat:'leaf', color:true, svg:'<svg viewBox="0 0 100 80"><path d="M20 70 Q10 40, 30 20 Q50 5, 70 20 Q90 40, 80 70" fill="#bbf7d0" stroke="#22c55e" stroke-width="1.2"/><path d="M50 15 Q50 45, 50 70" stroke="#22c55e" stroke-width="1" fill="none"/><path d="M50 25 Q35 30, 28 38" stroke="#22c55e" stroke-width="0.8" fill="none"/><path d="M50 35 Q65 30, 72 38" stroke="#22c55e" stroke-width="0.8" fill="none"/><path d="M50 45 Q38 48, 32 55" stroke="#22c55e" stroke-width="0.8" fill="none"/><path d="M50 55 Q62 52, 68 55" stroke="#22c55e" stroke-width="0.8" fill="none"/></svg>' },
    { id:'lf4', cat:'leaf', color:true, svg:'<svg viewBox="0 0 200 50"><path d="M10 30 C30 30, 40 15, 55 20 C60 10, 80 10, 85 22 L100 25 L115 22 C120 10, 140 10, 145 20 C160 15, 170 30, 190 30" fill="none" stroke="#059669" stroke-width="1.5"/><ellipse cx="55" cy="18" rx="8" ry="5" fill="#6ee7b7" opacity="0.7"/><ellipse cx="145" cy="18" rx="8" ry="5" fill="#6ee7b7" opacity="0.7"/><circle cx="100" cy="25" r="4" fill="#a7f3d0"/></svg>' },
    { id:'lf5', cat:'leaf', color:true, svg:'<svg viewBox="0 0 120 80"><path d="M20 60 Q5 30, 30 15 Q50 5, 60 25" fill="#86efac" stroke="#16a34a" stroke-width="1"/><path d="M60 25 Q70 5, 90 15 Q115 30, 100 60" fill="#86efac" stroke="#16a34a" stroke-width="1"/><path d="M60 25 L60 65" stroke="#16a34a" stroke-width="1" fill="none"/></svg>' },
    { id:'lf6', cat:'leaf', color:true, svg:'<svg viewBox="0 0 200 50"><path d="M5 35 Q20 25, 35 35" fill="none" stroke="#16a34a" stroke-width="1.5"/><path d="M25 20 Q30 12, 38 18 Q32 25, 25 20Z" fill="#4ade80"/><path d="M35 35 Q55 25, 75 35" fill="none" stroke="#16a34a" stroke-width="1.5"/><path d="M55 20 Q60 10, 68 16 Q62 25, 55 20Z" fill="#86efac"/><path d="M75 35 Q95 20, 125 35" fill="none" stroke="#16a34a" stroke-width="1.5"/><path d="M100 18 Q106 8, 114 15 Q108 24, 100 18Z" fill="#4ade80"/><path d="M125 35 Q145 25, 165 35" fill="none" stroke="#16a34a" stroke-width="1.5"/><path d="M145 20 Q150 12, 158 18 Q152 25, 145 20Z" fill="#86efac"/><path d="M165 35 Q180 25, 195 35" fill="none" stroke="#16a34a" stroke-width="1.5"/></svg>' },
    { id:'lf7', cat:'leaf', color:true, svg:'<svg viewBox="0 0 100 100"><path d="M50 90 C45 70, 20 50, 15 30 C12 15, 30 5, 50 15 C70 5, 88 15, 85 30 C80 50, 55 70, 50 90Z" fill="#d9f99d" stroke="#65a30d" stroke-width="1.2"/><path d="M50 20 L50 85" stroke="#65a30d" stroke-width="0.8" fill="none"/><path d="M50 35 Q35 32, 25 35" stroke="#65a30d" stroke-width="0.6" fill="none"/><path d="M50 50 Q65 47, 75 50" stroke="#65a30d" stroke-width="0.6" fill="none"/></svg>' },
    { id:'lf8', cat:'leaf', color:true, svg:'<svg viewBox="0 0 200 50"><path d="M10 25 L190 25" stroke="#16a34a" stroke-width="1.5"/><path d="M30 25 Q25 15, 30 8 Q35 15, 30 25Z" fill="#4ade80"/><path d="M60 25 Q55 12, 60 5 Q65 12, 60 25Z" fill="#86efac"/><path d="M90 25 Q85 15, 90 8 Q95 15, 90 25Z" fill="#4ade80"/><path d="M120 25 Q115 12, 120 5 Q125 12, 120 25Z" fill="#86efac"/><path d="M150 25 Q145 15, 150 8 Q155 15, 150 25Z" fill="#4ade80"/><path d="M180 25 Q175 12, 180 5 Q185 12, 180 25Z" fill="#86efac"/></svg>' },

    // ─── Arrows (8) ───
    { id:'a1', cat:'arrow', svg:'<svg viewBox="0 0 200 30"><line x1="10" y1="15" x2="180" y2="15" stroke="currentColor" stroke-width="1.5"/><path d="M175 8 L190 15 L175 22" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { id:'a2', cat:'arrow', svg:'<svg viewBox="0 0 200 30"><line x1="20" y1="15" x2="180" y2="15" stroke="currentColor" stroke-width="1.5"/><path d="M175 8 L190 15 L175 22" fill="currentColor"/><path d="M25 8 L10 15 L25 22" fill="currentColor"/></svg>' },
    { id:'a3', cat:'arrow', svg:'<svg viewBox="0 0 200 30"><path d="M20 15h160" stroke="currentColor" stroke-width="1.5" stroke-dasharray="8,4"/><path d="M175 8 L190 15 L175 22" fill="none" stroke="currentColor" stroke-width="2"/></svg>' },
    { id:'a4', cat:'arrow', svg:'<svg viewBox="0 0 200 30"><path d="M10 15 C50 5, 80 5, 100 15 C120 25, 150 25, 180 15" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M175 8 L190 15 L175 22" fill="currentColor"/></svg>' },
    { id:'a5', cat:'arrow', svg:'<svg viewBox="0 0 200 30"><path d="M15 15 L85 15" stroke="currentColor" stroke-width="2"/><path d="M80 8 L95 15 L80 22" fill="currentColor"/><path d="M105 15 L175 15" stroke="currentColor" stroke-width="2"/><path d="M170 8 L185 15 L170 22" fill="currentColor"/></svg>' },
    { id:'a6', cat:'arrow', svg:'<svg viewBox="0 0 200 30"><path d="M10 15 L85 15" stroke="currentColor" stroke-width="1"/><circle cx="90" cy="15" r="5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M95 15 L170 15" stroke="currentColor" stroke-width="1"/><path d="M165 10 L175 15 L165 20" fill="currentColor"/></svg>' },
    { id:'a7', cat:'arrow', svg:'<svg viewBox="0 0 200 30"><path d="M10 15 Q50 0, 100 15 Q150 30, 190 15" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="10" cy="15" r="3" fill="currentColor"/><path d="M185 10 L195 15 L185 20" fill="currentColor"/></svg>' },
    { id:'a8', cat:'arrow', svg:'<svg viewBox="0 0 200 30"><path d="M25 15h150" stroke="currentColor" stroke-width="3"/><path d="M170 6 L190 15 L170 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' },

    // ─── Lines (8) ───
    { id:'l1', cat:'line', svg:'<svg viewBox="0 0 200 10"><line x1="10" y1="5" x2="190" y2="5" stroke="currentColor" stroke-width="2"/></svg>' },
    { id:'l2', cat:'line', svg:'<svg viewBox="0 0 200 10"><line x1="10" y1="3" x2="190" y2="3" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="7" x2="190" y2="7" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { id:'l3', cat:'line', svg:'<svg viewBox="0 0 200 10"><line x1="10" y1="5" x2="190" y2="5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="10,5"/></svg>' },
    { id:'l4', cat:'line', svg:'<svg viewBox="0 0 200 10"><line x1="10" y1="5" x2="190" y2="5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2,4"/></svg>' },
    { id:'l5', cat:'line', svg:'<svg viewBox="0 0 200 14"><line x1="10" y1="3" x2="190" y2="3" stroke="currentColor" stroke-width="2.5"/><line x1="10" y1="11" x2="190" y2="11" stroke="currentColor" stroke-width="0.8"/></svg>' },
    { id:'l6', cat:'line', svg:'<svg viewBox="0 0 200 20"><path d="M10 10 Q30 2 50 10 Q70 18 90 10 Q110 2 130 10 Q150 18 170 10 Q190 2 200 10" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { id:'l7', cat:'line', svg:'<svg viewBox="0 0 200 14"><line x1="10" y1="7" x2="190" y2="7" stroke="currentColor" stroke-width="1" stroke-dasharray="12,3,2,3"/></svg>' },
    { id:'l8', cat:'line', svg:'<svg viewBox="0 0 200 16"><line x1="10" y1="4" x2="190" y2="4" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="8" x2="190" y2="8" stroke="currentColor" stroke-width="0.5"/><line x1="10" y1="12" x2="190" y2="12" stroke="currentColor" stroke-width="1.5"/></svg>' },

    // ─── Badges (6) ───
    { id:'b1', cat:'badge', svg:'<svg viewBox="0 0 100 100"><circle cx="50" cy="45" r="30" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="50" cy="45" r="25" fill="none" stroke="currentColor" stroke-width="0.8"/><path d="M35 80 L50 90 L65 80" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { id:'b2', cat:'badge', svg:'<svg viewBox="0 0 100 100"><path d="M50 5 L61 38 L97 38 L68 58 L79 91 L50 72 L21 91 L32 58 L3 38 L39 38Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { id:'b3', cat:'badge', svg:'<svg viewBox="0 0 100 100"><rect x="10" y="20" width="80" height="55" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M30 20 L50 5 L70 20" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="25" y1="55" x2="75" y2="55" stroke="currentColor" stroke-width="0.8"/></svg>' },
    { id:'b4', cat:'badge', color:true, svg:'<svg viewBox="0 0 100 100"><circle cx="50" cy="45" r="32" fill="#dbeafe" stroke="#3b82f6" stroke-width="2"/><circle cx="50" cy="45" r="26" fill="none" stroke="#3b82f6" stroke-width="1"/><path d="M50 25 L54 36 L66 36 L56 43 L60 54 L50 47 L40 54 L44 43 L34 36 L46 36Z" fill="#3b82f6"/></svg>' },
    { id:'b5', cat:'badge', color:true, svg:'<svg viewBox="0 0 100 110"><path d="M50 5 C75 5, 95 25, 95 50 C95 75, 75 90, 50 90 C25 90, 5 75, 5 50 C5 25, 25 5, 50 5Z" fill="#fef3c7" stroke="#f59e0b" stroke-width="2"/><path d="M35 100 L50 90 L65 100 L60 88 L40 88Z" fill="#f59e0b"/></svg>' },
    { id:'b6', cat:'badge', svg:'<svg viewBox="0 0 100 100"><path d="M50 8 L58 8 L65 2 L65 12 L75 15 L68 22 L72 32 L62 28 L55 35 L55 25 L50 18 L45 25 L45 35 L38 28 L28 32 L32 22 L25 15 L35 12 L35 2 L42 8Z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="50" cy="55" r="25" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },

    // ─── Hearts (6) ───
    { id:'h1', cat:'heart', color:true, svg:'<svg viewBox="0 0 100 100"><path d="M50 85 C20 60, 5 40, 15 25 C25 10, 45 15, 50 30 C55 15, 75 10, 85 25 C95 40, 80 60, 50 85Z" fill="#f87171" stroke="#dc2626" stroke-width="1"/></svg>' },
    { id:'h2', cat:'heart', svg:'<svg viewBox="0 0 100 100"><path d="M50 85 C20 60, 5 40, 15 25 C25 10, 45 15, 50 30 C55 15, 75 10, 85 25 C95 40, 80 60, 50 85Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>' },
    { id:'h3', cat:'heart', color:true, svg:'<svg viewBox="0 0 200 50"><path d="M30 40 C15 28, 8 18, 13 12 C18 6, 27 8, 30 15 C33 8, 42 6, 47 12 C52 18, 45 28, 30 40Z" fill="#fda4af"/><path d="M70 40 C55 28, 48 18, 53 12 C58 6, 67 8, 70 15 C73 8, 82 6, 87 12 C92 18, 85 28, 70 40Z" fill="#f9a8d4"/><path d="M110 40 C95 28, 88 18, 93 12 C98 6, 107 8, 110 15 C113 8, 122 6, 127 12 C132 18, 125 28, 110 40Z" fill="#c4b5fd"/><path d="M150 40 C135 28, 128 18, 133 12 C138 6, 147 8, 150 15 C153 8, 162 6, 167 12 C172 18, 165 28, 150 40Z" fill="#93c5fd"/></svg>' },
    { id:'h4', cat:'heart', color:true, svg:'<svg viewBox="0 0 100 100"><path d="M50 80 C25 58, 12 42, 18 28 C24 14, 42 18, 50 32 C58 18, 76 14, 82 28 C88 42, 75 58, 50 80Z" fill="#fecdd3" stroke="#fb7185" stroke-width="1.5"/><path d="M50 65 C35 52, 28 42, 32 34 C36 26, 45 28, 50 38 C55 28, 64 26, 68 34 C72 42, 65 52, 50 65Z" fill="#fb7185"/></svg>' },
    { id:'h5', cat:'heart', svg:'<svg viewBox="0 0 100 100"><path d="M50 85 C20 60, 5 40, 15 25 C25 10, 45 15, 50 30 C55 15, 75 10, 85 25 C95 40, 80 60, 50 85Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5,3"/></svg>' },
    { id:'h6', cat:'heart', color:true, svg:'<svg viewBox="0 0 200 60"><path d="M100 50 C60 30, 35 15, 45 8 C55 1, 75 5, 85 18 L100 35 L115 18 C125 5, 145 1, 155 8 C165 15, 140 30, 100 50Z" fill="none" stroke="#e11d48" stroke-width="1.5"/><path d="M70 25 Q80 15, 90 22" fill="none" stroke="#e11d48" stroke-width="0.8"/><path d="M130 25 Q120 15, 110 22" fill="none" stroke="#e11d48" stroke-width="0.8"/><circle cx="100" cy="30" r="2" fill="#e11d48"/></svg>' },

    // ─── Stars (6) ───
    { id:'s1', cat:'star', color:true, svg:'<svg viewBox="0 0 100 100"><path d="M50 10 L61 38 L92 38 L67 56 L77 85 L50 68 L23 85 L33 56 L8 38 L39 38Z" fill="#fbbf24" stroke="#f59e0b" stroke-width="1"/></svg>' },
    { id:'s2', cat:'star', svg:'<svg viewBox="0 0 100 100"><path d="M50 10 L61 38 L92 38 L67 56 L77 85 L50 68 L23 85 L33 56 L8 38 L39 38Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>' },
    { id:'s3', cat:'star', color:true, svg:'<svg viewBox="0 0 200 50"><path d="M25 8 L29 20 L42 20 L32 28 L35 40 L25 32 L15 40 L18 28 L8 20 L21 20Z" fill="#fbbf24"/><path d="M65 8 L69 20 L82 20 L72 28 L75 40 L65 32 L55 40 L58 28 L48 20 L61 20Z" fill="#f97316"/><path d="M105 8 L109 20 L122 20 L112 28 L115 40 L105 32 L95 40 L98 28 L88 20 L101 20Z" fill="#ef4444"/><path d="M145 8 L149 20 L162 20 L152 28 L155 40 L145 32 L135 40 L138 28 L128 20 L141 20Z" fill="#a855f7"/><path d="M185 8 L189 20 L202 20 L192 28 L195 40 L185 32 L175 40 L178 28 L168 20 L181 20Z" fill="#3b82f6"/></svg>' },
    { id:'s4', cat:'star', svg:'<svg viewBox="0 0 100 100"><path d="M50 15 L56 40 L80 25 L62 48 L88 50 L62 52 L80 75 L56 60 L50 85 L44 60 L20 75 L38 52 L12 50 L38 48 L20 25 L44 40Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
    { id:'s5', cat:'star', color:true, svg:'<svg viewBox="0 0 100 100"><path d="M50 5 L58 35 L90 20 L65 45 L95 50 L65 55 L90 80 L58 65 L50 95 L42 65 L10 80 L35 55 L5 50 L35 45 L10 20 L42 35Z" fill="#fef08a" stroke="#eab308" stroke-width="1"/></svg>' },
    { id:'s6', cat:'star', svg:'<svg viewBox="0 0 100 100"><polygon points="50,5 58,38 92,38 64,58 75,90 50,70 25,90 36,58 8,38 42,38" fill="none" stroke="currentColor" stroke-width="1.5"/><polygon points="50,22 55,40 73,40 58,52 64,70 50,60 36,70 42,52 27,40 45,40" fill="none" stroke="currentColor" stroke-width="1"/></svg>' },
];

let _ornamentCurrentCat = 'all';

function renderOrnamentGrid(grid, category) {
    if (!grid) return;
    _ornamentCurrentCat = category;
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = 'repeat(2, 1fr)';

    const items = category === 'all' ? ORNAMENTS : ORNAMENTS.filter(o => o.cat === category);

    items.forEach(item => {
        const cell = document.createElement('div');
        cell.className = 'ornament-cell';
        cell.style.cssText = 'border:1px solid #e2e8f0; border-radius:8px; cursor:pointer; padding:8px; background:#fff; transition:all 0.15s; display:flex; align-items:center; justify-content:center; min-height:50px;';
        // Multicolor items keep their colors; mono items use ornamentColor
        if (item.color) {
            cell.innerHTML = item.svg;
        } else {
            cell.innerHTML = item.svg.replace(/currentColor/g, ornamentColor);
        }
        cell.querySelector('svg').style.cssText = 'width:100%; height:100%;';

        cell.onmouseenter = () => { cell.style.borderColor = '#6366f1'; cell.style.boxShadow = '0 2px 8px rgba(99,102,241,0.2)'; };
        cell.onmouseleave = () => { cell.style.borderColor = '#e2e8f0'; cell.style.boxShadow = 'none'; };

        cell.onclick = () => addOrnamentToCanvas(item);
        grid.appendChild(cell);
    });
}

function _recolorOrnamentGrid() {
    const grid = document.getElementById('iconResultGrid');
    if (!grid) return;
    grid.querySelectorAll('.ornament-cell').forEach((cell, idx) => {
        const items = _ornamentCurrentCat === 'all' ? ORNAMENTS : ORNAMENTS.filter(o => o.cat === _ornamentCurrentCat);
        const item = items[idx];
        if (!item || item.color) return; // skip multicolor
        const svg = cell.querySelector('svg');
        if (!svg) return;
        svg.querySelectorAll('path, circle, rect, line, ellipse, polygon, polyline').forEach(el => {
            const f = el.getAttribute('fill');
            if (f && f !== 'none' && f !== 'transparent') el.setAttribute('fill', ornamentColor);
            const s = el.getAttribute('stroke');
            if (s && s !== 'none' && s !== 'transparent') el.setAttribute('stroke', ornamentColor);
        });
    });
}

function addOrnamentToCanvas(item) {
    let svgText;
    if (item.color) {
        svgText = item.svg; // keep original colors
    } else {
        svgText = item.svg.replace(/currentColor/g, ornamentColor);
    }
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
