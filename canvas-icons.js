// canvas-icons.js — Iconify icon search + color picker + canvas integration

const ICONIFY_SEARCH = 'https://api.iconify.design/search';
const ICONIFY_SVG = 'https://api.iconify.design';
const PER_PAGE = 48;

let iconCurrentColor = '#000000';
let iconSearchResults = [];
let iconCurrentOffset = 0;
let iconCurrentQuery = '';
let iconDebounceTimer = null;

const QUICK_TAGS = [
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

    if (!searchInput) return;

    // Quick category tags
    if (tagsContainer) {
        QUICK_TAGS.forEach(tag => {
            const btn = document.createElement('button');
            btn.textContent = tag.label;
            btn.style.cssText = 'padding:4px 8px; font-size:11px; border:1px solid #e2e8f0; border-radius:12px; background:#fff; cursor:pointer; white-space:nowrap; transition:all 0.15s;';
            btn.onmouseenter = () => { btn.style.background = '#6366f1'; btn.style.color = '#fff'; btn.style.borderColor = '#6366f1'; };
            btn.onmouseleave = () => { btn.style.background = '#fff'; btn.style.color = '#000'; btn.style.borderColor = '#e2e8f0'; };
            btn.onclick = () => {
                searchInput.value = tag.q;
                doIconSearch(tag.q, true);
            };
            tagsContainer.appendChild(btn);
        });
    }

    // Search: Enter key
    searchInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            doIconSearch(searchInput.value.trim(), true);
        }
    };

    // Search: debounce on typing
    searchInput.oninput = () => {
        clearTimeout(iconDebounceTimer);
        iconDebounceTimer = setTimeout(() => {
            const q = searchInput.value.trim();
            if (q.length >= 2) doIconSearch(q, true);
        }, 400);
    };

    // Color picker
    if (colorPicker) {
        colorPicker.oninput = () => {
            iconCurrentColor = colorPicker.value;
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

    // Load more
    if (loadMoreBtn) {
        loadMoreBtn.onclick = () => {
            doIconSearch(iconCurrentQuery, false);
        };
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
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#94a3b8; font-size:12px; padding:20px;">' +
            (window.t ? window.t('icon_loading', 'Searching...') : 'Searching...') + '</div>';
    }

    iconCurrentQuery = query;

    try {
        const url = `${ICONIFY_SEARCH}?query=${encodeURIComponent(query)}&limit=${PER_PAGE}&start=${iconCurrentOffset}`;
        const resp = await fetch(url);
        const data = await resp.json();

        const icons = data.icons || [];

        if (reset && icons.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#94a3b8; font-size:12px; padding:20px;">' +
                (window.t ? window.t('icon_no_results', 'No results found') : 'No results found') + '</div>';
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }

        if (reset) grid.innerHTML = '';

        iconSearchResults = iconSearchResults.concat(icons);
        iconCurrentOffset += icons.length;

        icons.forEach(iconId => {
            const [prefix, name] = iconId.split(':');
            const svgUrl = `${ICONIFY_SVG}/${prefix}/${name}.svg`;

            const cell = document.createElement('div');
            cell.className = 'icon-grid-cell';
            cell.style.cssText = 'aspect-ratio:1; border:1px solid #f1f5f9; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:6px; background:#fff; transition:all 0.15s; position:relative;';
            cell.title = iconId;

            // Load SVG inline for color control
            const img = document.createElement('img');
            img.src = svgUrl;
            img.style.cssText = 'width:100%; height:100%; object-fit:contain;';
            img.loading = 'lazy';
            cell.appendChild(img);

            // After image loads, replace with inline SVG for color control
            fetchAndInlineSvg(svgUrl, cell);

            cell.onmouseenter = () => { cell.style.borderColor = '#6366f1'; cell.style.boxShadow = '0 2px 8px rgba(99,102,241,0.2)'; };
            cell.onmouseleave = () => { cell.style.borderColor = '#f1f5f9'; cell.style.boxShadow = 'none'; };

            cell.onclick = () => addIconToCanvas(iconId);

            grid.appendChild(cell);
        });

        // Show/hide load more
        if (loadMoreBtn) {
            loadMoreBtn.style.display = (icons.length >= PER_PAGE) ? 'block' : 'none';
        }
    } catch (err) {
        console.error('[Icons] Search error:', err);
        if (reset) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#ef4444; font-size:12px; padding:20px;">Error searching icons</div>';
        }
    }
}

async function fetchAndInlineSvg(url, cell) {
    try {
        const resp = await fetch(url);
        const svgText = await resp.text();

        // Replace img with inline SVG
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');
        if (!svgEl) return;

        svgEl.style.cssText = 'width:100%; height:100%;';
        svgEl.removeAttribute('width');
        svgEl.removeAttribute('height');

        // Apply current color
        applyColorToSvg(svgEl, iconCurrentColor);

        // Clear cell and add inline SVG
        cell.innerHTML = '';
        cell.appendChild(svgEl);
    } catch (e) {
        // Keep the img fallback
    }
}

function applyColorToSvg(svgEl, color) {
    // Set color on SVG root as fallback
    svgEl.setAttribute('fill', color);
    // Apply to all shape elements
    svgEl.querySelectorAll('path, circle, rect, polygon, polyline, ellipse, line').forEach(el => {
        const currentFill = el.getAttribute('fill');
        // Don't change 'none' fills (they're intentional transparent areas)
        if (currentFill !== 'none') {
            el.setAttribute('fill', color);
        }
        // Handle stroke-based icons
        const currentStroke = el.getAttribute('stroke');
        if (currentStroke && currentStroke !== 'none') {
            el.setAttribute('stroke', color);
        }
    });
}

function recolorGrid() {
    const grid = document.getElementById('iconResultGrid');
    if (!grid) return;
    grid.querySelectorAll('.icon-grid-cell svg').forEach(svgEl => {
        applyColorToSvg(svgEl, iconCurrentColor);
    });
}

async function addIconToCanvas(iconId) {
    const [prefix, name] = iconId.split(':');
    const svgUrl = `${ICONIFY_SVG}/${prefix}/${name}.svg`;

    try {
        const resp = await fetch(svgUrl);
        let svgText = await resp.text();

        // Apply chosen color to SVG string before loading into Fabric
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

            // Mark as icon for special handling
            group.set({ iconId: iconId, iconColor: iconCurrentColor });

            if (window.addToCenter) {
                window.addToCenter(group);
            }
        });
    } catch (err) {
        console.error('[Icons] Failed to add icon:', err);
        if (window.showToast) window.showToast('Failed to add icon', 'error');
    }
}
