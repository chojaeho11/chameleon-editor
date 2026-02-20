// wall-3d-walls.js — 멀티 가벽 공간 구성 매니저
(function () {
    'use strict';

    const WALL_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

    // ─── 데이터 ───
    window.__wallComposition = {
        walls: [],
        activeWallId: null,
        presetName: null
    };

    let wallIdCounter = 0;
    let raycaster = null;
    let mouse = null;
    let isShiftDragging = false;
    let dragPlane = null;
    let dragOffset = null;
    let highlightMeshes = [];

    // ─── 프리셋 정의 ───
    const PRESETS = {
        'I': function (w) {
            return [{ posX: 0, posZ: 0, rotY: 0 }];
        },
        'L': function (w) {
            const half = w / 2000;
            return [
                { posX: 0, posZ: 0, rotY: 0 },
                { posX: half, posZ: -half, rotY: Math.PI / 2 }
            ];
        },
        'U': function (w) {
            const half = w / 2000;
            return [
                { posX: -half, posZ: -half, rotY: Math.PI / 2 },
                { posX: 0, posZ: 0, rotY: 0 },
                { posX: half, posZ: -half, rotY: Math.PI / 2 }
            ];
        },
        'booth': function (w) {
            const half = w / 2000;
            return [
                { posX: 0, posZ: 0, rotY: 0 },
                { posX: -half, posZ: -half, rotY: Math.PI / 2 },
                { posX: half, posZ: -half, rotY: Math.PI / 2 }
            ];
        },
        'square': function (w) {
            const half = w / 2000;
            return [
                { posX: 0, posZ: half, rotY: 0 },
                { posX: 0, posZ: -half, rotY: 0 },
                { posX: -half, posZ: 0, rotY: Math.PI / 2 },
                { posX: half, posZ: 0, rotY: Math.PI / 2 }
            ];
        }
    };

    // ─── 유틸 ───
    function getCtx() {
        return window.__wall3D || null;
    }

    function getComp() {
        return window.__wallComposition;
    }

    function genId() {
        return 'wall_' + (++wallIdCounter);
    }

    // ─── 단일 가벽 3D 생성 ───
    function buildSingleWallGroup(wallDef) {
        const ctx = getCtx();
        if (!ctx || !ctx.scene || !window.THREE) return null;

        const THREE = window.THREE;
        const group = new THREE.Group();
        group.name = 'wallGroup_' + wallDef.id;

        const width = wallDef.widthMM / 1000;
        const height = wallDef.heightMM / 1000;
        const depth = (wallDef.depthMM || 100) / 1000;

        // Panel
        const panelGeo = new THREE.BoxGeometry(width, height, depth);
        const sideMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5 });
        const frontMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
        const backMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 });
        const materials = [sideMat, sideMat.clone(), sideMat.clone(), sideMat.clone(), frontMat, backMat];
        const panel = new THREE.Mesh(panelGeo, materials);
        panel.castShadow = true;
        panel.receiveShadow = true;
        panel.name = 'panel';
        panel.userData.wallId = wallDef.id;
        group.add(panel);

        // Back frame
        const frameMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.6 });
        const frameZ = -depth / 2 - 0.015;
        const rt = 0.05, rd = 0.025;
        addBoxToGroup(group, width - 0.02, rt, rd, 0, height / 2 - rt / 2, frameZ, frameMat);
        addBoxToGroup(group, width - 0.02, rt, rd, 0, -height / 2 + rt / 2, frameZ, frameMat);
        addBoxToGroup(group, rt, height, rd, -width / 2 + rt / 2, 0, frameZ, frameMat);
        addBoxToGroup(group, rt, height, rd, width / 2 - rt / 2, 0, frameZ, frameMat);

        // Triangle stands
        const standMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.5 });
        const numSections = Math.max(1, Math.round(wallDef.widthMM / 1000));
        const numStands = Math.max(2, numSections + 1);
        const standSpacing = width / (numStands - 1);
        for (let i = 0; i < numStands; i++) {
            const sx = -width / 2 + i * standSpacing;
            createStandInGroup(group, sx, -height / 2, -depth / 2, standMat);
        }

        // Position
        group.position.set(wallDef.posX || 0, height / 2, wallDef.posZ || 0);
        group.rotation.y = wallDef.rotY || 0;

        return group;
    }

    function addBoxToGroup(group, w, h, d, x, y, z, mat) {
        const geo = new window.THREE.BoxGeometry(w, h, d);
        const mesh = new window.THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        group.add(mesh);
    }

    function createStandInGroup(group, x, bottomY, backZ, mat) {
        const THREE = window.THREE;
        const standBase = 0.35, standHeight = 0.45, standWidth = 0.04;

        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(-standBase, 0);
        shape.lineTo(0, standHeight);
        shape.closePath();

        const geo = new THREE.ExtrudeGeometry(shape, { depth: standWidth, bevelEnabled: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.y = Math.PI / 2;
        mesh.position.set(x, bottomY, backZ);
        mesh.castShadow = true;
        group.add(mesh);

        const plateGeo = new THREE.BoxGeometry(0.08, 0.12, standBase * 0.3);
        const plate = new THREE.Mesh(plateGeo, mat);
        plate.position.set(x, bottomY + 0.06, backZ - standBase * 0.15);
        group.add(plate);
    }

    // ─── 하이라이트 (선택된 가벽) ───
    function updateHighlight() {
        const ctx = getCtx();
        if (!ctx || !ctx.scene) return;
        const THREE = window.THREE;

        // Remove old highlights
        highlightMeshes.forEach(m => {
            if (m.parent) m.parent.remove(m);
            if (m.geometry) m.geometry.dispose();
            if (m.material) m.material.dispose();
        });
        highlightMeshes = [];

        const comp = getComp();
        const activeWall = comp.walls.find(w => w.id === comp.activeWallId);
        if (!activeWall || !activeWall.group) return;

        // Add wireframe box around selected wall
        const panel = activeWall.group.getObjectByName('panel');
        if (panel && panel.geometry) {
            const wireGeo = new THREE.EdgesGeometry(panel.geometry);
            const wireMat = new THREE.LineBasicMaterial({ color: 0x6366f1, linewidth: 2 });
            const wireframe = new THREE.LineSegments(wireGeo, wireMat);
            wireframe.position.copy(panel.position);
            activeWall.group.add(wireframe);
            highlightMeshes.push(wireframe);
        }
    }

    // ─── Scene 다시 그리기 ───
    function rebuildScene() {
        const ctx = getCtx();
        if (!ctx || !ctx.scene) return;

        const comp = getComp();

        // 기존 가벽 그룹 제거
        comp.walls.forEach(w => {
            if (w.group) {
                ctx.scene.remove(w.group);
                w.group.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material.dispose();
                    }
                });
                w.group = null;
            }
        });

        // 재생성
        comp.walls.forEach(w => {
            const group = buildSingleWallGroup(w);
            if (group) {
                w.group = group;
                ctx.scene.add(group);
            }
        });

        updateHighlight();
        updateWallListUI();
    }

    // ─── 프리셋 적용 ───
    window.applyWallPreset = function (presetName) {
        const ctx = getCtx();
        if (!ctx || !ctx.scene) return;

        const preset = PRESETS[presetName];
        if (!preset) return;

        const comp = getComp();

        // 기존 가벽 정리
        comp.walls.forEach(w => {
            if (w.group) {
                ctx.scene.remove(w.group);
                w.group.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material.dispose();
                    }
                });
            }
        });

        // 기본 가벽 크기 (현재 제품 사이즈)
        const fabricCanvas = window.canvas;
        let widthMM = 2200, heightMM = 2200;
        if (fabricCanvas) {
            const board = fabricCanvas.getObjects().find(o => o.isBoard);
            if (board) {
                const PX_PER_MM = 3.7795;
                widthMM = Math.round(board.width / PX_PER_MM);
                heightMM = Math.round(board.height / PX_PER_MM);
            }
        }

        const positions = preset(widthMM);
        comp.walls = [];
        comp.presetName = presetName;

        positions.forEach((pos, i) => {
            const wallDef = {
                id: genId(),
                widthMM: widthMM,
                heightMM: heightMM,
                depthMM: 100,
                posX: pos.posX,
                posZ: pos.posZ,
                rotY: pos.rotY,
                colorIndex: i,
                group: null,
                selected: false
            };
            const group = buildSingleWallGroup(wallDef);
            if (group) {
                wallDef.group = group;
                ctx.scene.add(group);
            }
            comp.walls.push(wallDef);
        });

        // 첫 가벽 선택
        if (comp.walls.length > 0) {
            comp.activeWallId = comp.walls[0].id;
        }

        // 카메라 조정
        const maxDim = Math.max(widthMM / 1000, heightMM / 1000) * (positions.length > 2 ? 2.5 : 2);
        ctx.spherical.radius = maxDim;
        ctx.spherical.theta = Math.PI / 5;
        ctx.spherical.phi = Math.PI / 3;
        ctx.target.x = 0;
        ctx.target.y = heightMM / 2000;
        ctx.target.z = 0;
        ctx.updateCamera();

        updateHighlight();
        updateWallListUI();
        updatePresetBtnUI(presetName);

        // 가벽 양면 페이지 갱신 (wallCount × 2 pages)
        updateWallPages(comp.walls.length, widthMM, heightMM);
    };

    // ─── 가벽 추가 ───
    window.addWallToScene = function () {
        const ctx = getCtx();
        if (!ctx || !ctx.scene) return;

        const comp = getComp();

        const fabricCanvas = window.canvas;
        let widthMM = 2200, heightMM = 2200;
        if (fabricCanvas) {
            const board = fabricCanvas.getObjects().find(o => o.isBoard);
            if (board) {
                const PX_PER_MM = 3.7795;
                widthMM = Math.round(board.width / PX_PER_MM);
                heightMM = Math.round(board.height / PX_PER_MM);
            }
        }

        // 새 가벽: 약간 옆에 배치
        const offset = comp.walls.length * 0.5;
        const wallDef = {
            id: genId(),
            widthMM: widthMM,
            heightMM: heightMM,
            depthMM: 100,
            posX: offset,
            posZ: 0,
            rotY: 0,
            colorIndex: comp.walls.length % WALL_COLORS.length,
            group: null,
            selected: false
        };

        const group = buildSingleWallGroup(wallDef);
        if (group) {
            wallDef.group = group;
            ctx.scene.add(group);
        }
        comp.walls.push(wallDef);
        comp.activeWallId = wallDef.id;
        comp.presetName = null;

        updateHighlight();
        updateWallListUI();
        updatePresetBtnUI(null);

        // 페이지 추가 (앞/뒤 2페이지)
        updateWallPages(comp.walls.length, widthMM, heightMM);
    };

    // ─── 가벽 삭제 ───
    window.deleteSelectedWall = function () {
        const ctx = getCtx();
        if (!ctx || !ctx.scene) return;

        const comp = getComp();
        if (comp.walls.length <= 1) {
            if (window.showToast) showToast(window.t ? window.t('msg_min_wall', 'At least one wall is required') : 'At least one wall is required', 'warn');
            return;
        }

        const idx = comp.walls.findIndex(w => w.id === comp.activeWallId);
        if (idx === -1) return;

        const wall = comp.walls[idx];
        if (wall.group) {
            ctx.scene.remove(wall.group);
            wall.group.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
        }
        comp.walls.splice(idx, 1);
        comp.presetName = null;

        // 다른 가벽 선택
        comp.activeWallId = comp.walls[Math.min(idx, comp.walls.length - 1)].id;

        updateHighlight();
        updateWallListUI();
        updatePresetBtnUI(null);

        const fabricCanvas = window.canvas;
        let widthMM = 2200, heightMM = 2200;
        if (fabricCanvas) {
            const board = fabricCanvas.getObjects().find(o => o.isBoard);
            if (board) {
                const PX_PER_MM = 3.7795;
                widthMM = Math.round(board.width / PX_PER_MM);
                heightMM = Math.round(board.height / PX_PER_MM);
            }
        }
        updateWallPages(comp.walls.length, widthMM, heightMM);
    };

    // ─── 가벽 회전 (90도) ───
    window.rotateSelectedWall = function () {
        const comp = getComp();
        const wall = comp.walls.find(w => w.id === comp.activeWallId);
        if (!wall || !wall.group) return;

        wall.rotY += Math.PI / 2;
        wall.group.rotation.y = wall.rotY;
        comp.presetName = null;
        updatePresetBtnUI(null);
    };

    // ─── 가벽 선택 (클릭) ───
    let selectionContainer = null;

    function setupWallSelection(container) {
        const THREE = window.THREE;
        if (!THREE) return;

        selectionContainer = container;
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        dragOffset = new THREE.Vector3();

        container.addEventListener('mousedown', onMouseDown);
        // mousemove/mouseup on window for smooth dragging outside bounds
        window.addEventListener('mousemove', onMouseMoveGlobal);
        window.addEventListener('mouseup', onMouseUp);
    }

    function getMouseNDC(e, container) {
        const rect = container.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((e.clientY - rect.top) / rect.height) * 2 + 1
        };
    }

    function onMouseDown(e) {
        if (e.button !== 0) return;
        const ctx = getCtx();
        if (!ctx || !ctx.camera) return;

        const container = e.currentTarget;
        const ndc = getMouseNDC(e, container);
        mouse.set(ndc.x, ndc.y);
        raycaster.setFromCamera(mouse, ctx.camera);

        const comp = getComp();
        const allPanels = [];
        comp.walls.forEach(w => {
            if (w.group) {
                const panel = w.group.getObjectByName('panel');
                if (panel) allPanels.push(panel);
            }
        });

        const intersects = raycaster.intersectObjects(allPanels);

        if (intersects.length > 0) {
            const hitWallId = intersects[0].object.userData.wallId;
            comp.activeWallId = hitWallId;
            updateHighlight();
            updateWallListUI();

            // Shift+click → start drag
            if (e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                isShiftDragging = true;

                const wall = comp.walls.find(w => w.id === hitWallId);
                if (wall && wall.group) {
                    const intersection = new window.THREE.Vector3();
                    raycaster.ray.intersectPlane(dragPlane, intersection);
                    dragOffset.copy(wall.group.position).sub(intersection);
                }
            }
        } else {
            // 빈 공간 클릭 → 선택 해제
            comp.activeWallId = null;
            updateHighlight();
            updateWallListUI();
        }
    }

    function onMouseMoveGlobal(e) {
        if (!isShiftDragging || !selectionContainer) return;
        const ctx = getCtx();
        if (!ctx || !ctx.camera) return;

        const comp = getComp();
        const wall = comp.walls.find(w => w.id === comp.activeWallId);
        if (!wall || !wall.group) return;

        const ndc = getMouseNDC(e, selectionContainer);
        mouse.set(ndc.x, ndc.y);
        raycaster.setFromCamera(mouse, ctx.camera);

        const intersection = new window.THREE.Vector3();
        if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
            const newX = intersection.x + dragOffset.x;
            const newZ = intersection.z + dragOffset.z;
            wall.group.position.x = newX;
            wall.group.position.z = newZ;
            wall.posX = newX;
            wall.posZ = newZ;
            comp.presetName = null;
        }
    }

    function onMouseUp() {
        isShiftDragging = false;
    }

    // ─── UI 업데이트 ───
    function updateWallListUI() {
        const container = document.getElementById('wallListContainer');
        if (!container) return;

        const comp = getComp();
        container.innerHTML = '';

        comp.walls.forEach((w, i) => {
            const item = document.createElement('div');
            item.className = 'wall3d-wall-item' + (w.id === comp.activeWallId ? ' selected' : '');
            item.innerHTML = `<div class="wall-color" style="background:${WALL_COLORS[w.colorIndex || i % WALL_COLORS.length]}"></div>
                <span>Wall ${i + 1}</span>
                <span style="margin-left:auto; font-size:10px; color:#94a3b8">${w.widthMM}×${w.heightMM}</span>`;
            item.onclick = () => {
                comp.activeWallId = w.id;
                updateHighlight();
                updateWallListUI();
            };
            container.appendChild(item);
        });
    }

    function updatePresetBtnUI(activePreset) {
        document.querySelectorAll('.wall3d-preset-btn').forEach(btn => {
            const presetKey = btn.getAttribute('onclick');
            if (!presetKey) return;
            const match = presetKey.match(/applyWallPreset\('(\w+)'\)/);
            if (match) {
                btn.classList.toggle('active', match[1] === activePreset);
            }
        });
    }

    // ─── 페이지 동기화 ───
    async function updateWallPages(wallCount, widthMM, heightMM) {
        try {
            const { initWallPages } = await import('./canvas-pages.js?v=123');
            initWallPages(wallCount, widthMM, heightMM);
            // wallFaceTabs 동적 갱신
            updateWallFaceTabsHTML(wallCount);
        } catch (e) {
            console.error('Failed to update wall pages:', e);
        }
    }

    function updateWallFaceTabsHTML(wallCount) {
        const tabsContainer = document.getElementById('wallFaceTabs');
        if (!tabsContainer) return;

        tabsContainer.innerHTML = '';
        for (let wi = 0; wi < wallCount; wi++) {
            const frontBtn = document.createElement('button');
            frontBtn.className = 'wall-face-tab' + (wi === 0 ? ' active' : '');
            frontBtn.dataset.wall = wi;
            frontBtn.dataset.face = '0';
            frontBtn.textContent = wallCount > 1 ? `W${wi + 1} ${window.t ? window.t('wall_face_front', '앞면') : '앞면'}` : (window.t ? window.t('wall_face_front', '앞면') : '앞면');
            frontBtn.onclick = () => window.switchWallFace(wi, 0);
            tabsContainer.appendChild(frontBtn);

            const backBtn = document.createElement('button');
            backBtn.className = 'wall-face-tab';
            backBtn.dataset.wall = wi;
            backBtn.dataset.face = '1';
            backBtn.textContent = wallCount > 1 ? `W${wi + 1} ${window.t ? window.t('wall_face_back', '뒷면') : '뒷면'}` : (window.t ? window.t('wall_face_back', '뒷면') : '뒷면');
            backBtn.onclick = () => window.switchWallFace(wi, 1);
            tabsContainer.appendChild(backBtn);
        }
    }

    // ─── 초기화: 3D 모달이 열릴 때 selection 설정 ───
    let selectionSetup = false;

    // MutationObserver로 모달 열림 감지
    const observer = new MutationObserver(() => {
        const modal = document.getElementById('wall3DModal');
        if (!modal || modal.style.display !== 'flex') return;

        if (!selectionSetup && window.__wallMode) {
            const container = document.getElementById('threeDContainer');
            if (container && window.THREE) {
                setupWallSelection(container);
                selectionSetup = true;
            }
        }

        // I preset 자동 적용 (처음 열 때, 가벽 모드)
        const comp = getComp();
        if (window.__wallMode && comp.walls.length === 0) {
            setTimeout(() => {
                window.applyWallPreset('I');
            }, 300);
        }
    });

    // DOM 준비 후 옵저버 시작
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }

    function startObserver() {
        const modal = document.getElementById('wall3DModal');
        if (modal) {
            observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
        }
    }

})();
