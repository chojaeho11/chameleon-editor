// wall-3d-walls.js — 멀티 가벽 공간 구성 매니저
(function () {
    'use strict';

    const WALL_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    const ACCESSORY_COLOR = 0xFFD700; // Yellow for pillar & light
    const STAND_COLOR = 0xf0f0f0;    // White for outdoor stands
    const ACCESSORY_PRICES_KRW = { cornerPillar: 100000, topLight: 50000, outdoorStand: 80000 };
    const ADDON_CODE_MAP = { cornerPillar: 'For', topLight: '87545', outdoorStand: 'b0001' };

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

    // ─── 액세서리 상태 ───
    window.__wallAccessories = {
        cornerPillar: false,
        topLight: false,
        outdoorStand: false
    };
    let accessoryMeshes = []; // 3D 오브젝트 추적

    // ─── 프리셋 정의 (walls 배열 기반, 벽별 크기 반영) ───
    const PRESETS = {
        'I': function (walls) {
            const positions = [];
            let xCursor = 0;
            const gap = 0.05;
            for (let i = 0; i < walls.length; i++) {
                const w = walls[i].widthMM / 1000;
                positions.push({ posX: xCursor + w / 2, posZ: 0, rotY: 0 });
                xCursor += w + gap;
            }
            const totalW = xCursor - gap;
            const offset = totalW / 2;
            positions.forEach(p => p.posX -= offset);
            return positions;
        },
        'L': function (walls) {
            if (walls.length < 2) return PRESETS['I'](walls);
            const w0 = walls[0].widthMM / 1000;
            const w1 = walls[1].widthMM / 1000;
            const positions = [
                { posX: 0, posZ: 0, rotY: 0 },
                { posX: w0 / 2, posZ: -w1 / 2, rotY: Math.PI / 2 }
            ];
            let zCursor = -w1;
            for (let i = 2; i < walls.length; i++) {
                const wi = walls[i].widthMM / 1000;
                positions.push({ posX: w0 / 2, posZ: zCursor - 0.05 - wi / 2, rotY: Math.PI / 2 });
                zCursor -= wi + 0.05;
            }
            return positions;
        },
        'U': function (walls) {
            if (walls.length < 3) return PRESETS['I'](walls);
            const w0 = walls[0].widthMM / 1000;
            const w1 = walls[1].widthMM / 1000;
            const w2 = walls[2].widthMM / 1000;
            const positions = [
                { posX: -w1 / 2, posZ: -w0 / 2, rotY: Math.PI / 2 },
                { posX: 0, posZ: 0, rotY: 0 },
                { posX: w1 / 2, posZ: -w2 / 2, rotY: Math.PI / 2 }
            ];
            for (let i = 3; i < walls.length; i++) {
                positions.push({ posX: (i - 2) * 1.5, posZ: -Math.max(w0, w2) - 0.5, rotY: 0 });
            }
            return positions;
        },
        'booth': function (walls) {
            if (walls.length < 3) return PRESETS['I'](walls);
            const w0 = walls[0].widthMM / 1000;
            const w1 = walls[1].widthMM / 1000;
            const w2 = walls[2].widthMM / 1000;
            const positions = [
                { posX: 0, posZ: 0, rotY: 0 },
                { posX: -w0 / 2, posZ: -w1 / 2, rotY: Math.PI / 2 },
                { posX: w0 / 2, posZ: -w2 / 2, rotY: Math.PI / 2 }
            ];
            for (let i = 3; i < walls.length; i++) {
                positions.push({ posX: (i - 2) * 1.5, posZ: -Math.max(w1, w2) - 0.5, rotY: 0 });
            }
            return positions;
        },
        'square': function (walls) {
            if (walls.length < 4) return PRESETS['booth'](walls);
            const w0 = walls[0].widthMM / 1000;
            const w1 = walls[1].widthMM / 1000;
            const w2 = walls[2].widthMM / 1000;
            const w3 = walls[3].widthMM / 1000;
            const sideLen = Math.max(w2, w3);
            const frontBack = Math.max(w0, w1);
            const positions = [
                { posX: 0, posZ: sideLen / 2, rotY: 0 },
                { posX: 0, posZ: -sideLen / 2, rotY: 0 },
                { posX: -frontBack / 2, posZ: 0, rotY: Math.PI / 2 },
                { posX: frontBack / 2, posZ: 0, rotY: Math.PI / 2 }
            ];
            for (let i = 4; i < walls.length; i++) {
                positions.push({ posX: (i - 3) * 1.5, posZ: sideLen + 0.5, rotY: 0 });
            }
            return positions;
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

    // ─── 단일 가벽 3D 생성 (textures: { front, back } optional) ───
    function buildSingleWallGroup(wallDef, textures) {
        const ctx = getCtx();
        if (!ctx || !ctx.scene || !window.THREE) return null;

        const THREE = window.THREE;
        const group = new THREE.Group();
        group.name = 'wallGroup_' + wallDef.id;

        const width = wallDef.widthMM / 1000;
        const height = wallDef.heightMM / 1000;
        const doubleSided = window.__wallConfig?.doubleSided || false;
        const depth = doubleSided ? 0.2 : ((wallDef.depthMM || 100) / 1000);

        // Panel
        const panelGeo = new THREE.BoxGeometry(width, height, depth);
        // ★ 디자인 마법사 테마색 → 옆면 색상
        const wzColors = window._wzBgColors;
        const sideColor = wzColors ? wzColors[1] : '#c4a070';
        const sideMat = new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.5 });
        const frontMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
        const backMat = new THREE.MeshStandardMaterial({ color: doubleSided ? 0xffffff : 0xe8e8e8, roughness: doubleSided ? 0.4 : 0.6 });
        const materials = [sideMat, sideMat.clone(), sideMat.clone(), sideMat.clone(), frontMat, backMat];
        const panel = new THREE.Mesh(panelGeo, materials);

        // 텍스처 적용 (에디터에서 캡처된 디자인)
        if (textures && textures.front) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () {
                const tex = new THREE.Texture(img);
                tex.needsUpdate = true;
                if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
                panel.material[4] = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
            };
            img.src = textures.front;
        }
        if (textures && textures.back) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () {
                const tex = new THREE.Texture(img);
                tex.needsUpdate = true;
                if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
                tex.wrapS = THREE.RepeatWrapping;
                tex.repeat.x = -1;
                panel.material[5] = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
            };
            img.src = textures.back;
        }
        panel.castShadow = true;
        panel.receiveShadow = true;
        panel.name = 'panel';
        panel.userData.wallId = wallDef.id;
        group.add(panel);

        if (!doubleSided) {
            // 단면: Back frame + Triangle stands
            const frameMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.6 });
            const frameZ = -depth / 2 - 0.015;
            const rt = 0.05, rd = 0.025;
            addBoxToGroup(group, width - 0.02, rt, rd, 0, height / 2 - rt / 2, frameZ, frameMat);
            addBoxToGroup(group, width - 0.02, rt, rd, 0, -height / 2 + rt / 2, frameZ, frameMat);
            addBoxToGroup(group, rt, height, rd, -width / 2 + rt / 2, 0, frameZ, frameMat);
            addBoxToGroup(group, rt, height, rd, width / 2 - rt / 2, 0, frameZ, frameMat);

            const standMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.5 });
            const numSections = Math.max(1, Math.round(wallDef.widthMM / 1000));
            const numStands = Math.max(2, numSections + 1);
            const standSpacing = width / (numStands - 1);
            for (let i = 0; i < numStands; i++) {
                const sx = -width / 2 + i * standSpacing;
                createStandInGroup(group, sx, -height / 2, -depth / 2, standMat);
            }
        } else {
            // 양면: 중간 이음선 + 테두리
            const seamMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.5 });
            addBoxToGroup(group, width + 0.01, 0.005, depth + 0.005, 0, 0, 0, seamMat);
            addBoxToGroup(group, 0.008, height, depth + 0.005, -width / 2, 0, 0, seamMat);
            addBoxToGroup(group, 0.008, height, depth + 0.005, width / 2, 0, 0, seamMat);
            addBoxToGroup(group, width, 0.008, depth + 0.005, 0, height / 2, 0, seamMat);
            addBoxToGroup(group, width, 0.008, depth + 0.005, 0, -height / 2, 0, seamMat);
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
        mesh.rotation.y = -Math.PI / 2;
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

    // ─── 프리셋 적용 (기존 벽 재배치만, 새로 생성하지 않음) ───
    window.applyWallPreset = function (presetName) {
        const ctx = getCtx();
        if (!ctx || !ctx.scene) return;

        const preset = PRESETS[presetName];
        if (!preset) return;

        const comp = getComp();
        if (comp.walls.length === 0) return;

        // 기존 벽들의 위치만 변경 (벽 데이터/텍스처 보존)
        const positions = preset(comp.walls);

        comp.walls.forEach((wall, i) => {
            if (i < positions.length) {
                wall.posX = positions[i].posX;
                wall.posZ = positions[i].posZ;
                wall.rotY = positions[i].rotY;
            } else {
                // 프리셋 위치보다 벽이 많으면 마지막 위치에서 옆으로 오프셋
                const last = positions[positions.length - 1];
                wall.posX = last.posX + (i - positions.length + 1) * 1.5;
                wall.posZ = last.posZ;
                wall.rotY = 0;
            }
            if (wall.group) {
                const height = wall.heightMM / 1000;
                wall.group.position.set(wall.posX, height / 2, wall.posZ);
                wall.group.rotation.y = wall.rotY;
            }
        });

        comp.presetName = presetName;

        // 카메라 조정
        const maxW = Math.max(...comp.walls.map(w => w.widthMM / 1000));
        const maxH = Math.max(...comp.walls.map(w => w.heightMM / 1000));
        const maxDim = Math.max(maxW, maxH) * (comp.walls.length > 2 ? 2.5 : 2);
        ctx.spherical.radius = maxDim;
        ctx.spherical.theta = Math.PI / 5;
        ctx.spherical.phi = Math.PI / 3;
        ctx.target.x = 0;
        ctx.target.y = maxH / 2;
        ctx.target.z = 0;
        ctx.updateCamera();

        updateHighlight();
        updateWallListUI();
        updatePresetBtnUI(presetName);
        rebuildAccessories();
        // syncWallConfigFrom3D 제거: 프리셋은 배치만 변경, 에디터 데이터 보존
    };

    // ─── 에디터 __wallConfig에서 벽 생성 ───
    function initWallsFromConfig() {
        const ctx = getCtx();
        if (!ctx || !ctx.scene) return;

        const cfg = window.__wallConfig;
        if (!cfg || !cfg.walls || cfg.walls.length === 0) return;

        const comp = getComp();
        const textures = window.__wallTextures || [];

        // 기존 벽 정리
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
        comp.walls = [];

        // 에디터 설정대로 벽 생성 (텍스처 포함)
        cfg.walls.forEach((cfgWall, i) => {
            const wallDef = {
                id: genId(),
                widthMM: cfgWall.widthMM,
                heightMM: cfgWall.heightMM,
                depthMM: 100,
                posX: 0,
                posZ: 0,
                rotY: 0,
                colorIndex: i % WALL_COLORS.length,
                group: null,
                selected: false
            };

            const group = buildSingleWallGroup(wallDef, textures[i] || null);
            if (group) {
                wallDef.group = group;
                ctx.scene.add(group);
            }
            comp.walls.push(wallDef);
        });

        if (comp.walls.length > 0) {
            comp.activeWallId = comp.walls[0].id;
        }

        // I-프리셋으로 초기 배치
        window.applyWallPreset('I');

        // 치수 라벨 업데이트
        const label = document.getElementById('wall3dDimLabel');
        if (label) {
            const doubleSided = cfg.doubleSided || false;
            const depthMM = doubleSided ? 200 : 100;
            const dims = cfg.walls.map((w, idx) => (idx + 1) + ': ' + w.widthMM + '×' + w.heightMM);
            label.textContent = dims.join(' | ') + ' × ' + depthMM + 'mm';
        }
    }
    window.initWallsFromConfig = initWallsFromConfig;

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

        // __wallConfig 동기화
        syncWallConfigFrom3D(comp.walls);
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

        // __wallConfig 동기화
        syncWallConfigFrom3D(comp.walls);
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
        rebuildAccessories();
    };

    // ─── 가벽 선택 + 드래그 이동 (Shift 불필요, 클릭+드래그로 이동) ───
    let selectionContainer = null;
    let isPotentialDrag = false;
    let dragStarted = false;
    let dragStartX = 0, dragStartY = 0;
    const DRAG_THRESHOLD = 5;

    function setupWallSelection(container) {
        const THREE = window.THREE;
        if (!THREE) return;

        selectionContainer = container;
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        dragOffset = new THREE.Vector3();

        // capture phase: 벽 클릭 시 orbit controls보다 먼저 처리
        container.addEventListener('mousedown', onMouseDown, true);
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

        const ndc = getMouseNDC(e, selectionContainer);
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

            // 벽 클릭 → orbit 방지 + 드래그 준비
            e.preventDefault();
            e.stopPropagation();
            isPotentialDrag = true;
            dragStarted = false;
            dragStartX = e.clientX;
            dragStartY = e.clientY;

            const wall = comp.walls.find(w => w.id === hitWallId);
            if (wall && wall.group) {
                const intersection = new window.THREE.Vector3();
                raycaster.ray.intersectPlane(dragPlane, intersection);
                dragOffset.copy(wall.group.position).sub(intersection);
            }
        }
        // 빈 공간 클릭 → orbit controls가 처리 (stopPropagation 안 함)
    }

    function onMouseMoveGlobal(e) {
        if (!isPotentialDrag || !selectionContainer) return;
        const ctx = getCtx();
        if (!ctx || !ctx.camera) return;

        // 드래그 임계값 체크
        if (!dragStarted) {
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
            dragStarted = true;
            window.__wallDragMode = true;
        }

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
        const wasDragging = dragStarted;
        isPotentialDrag = false;
        dragStarted = false;
        window.__wallDragMode = false;
        if (wasDragging) rebuildAccessories();
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

    // ─── __wallConfig ↔ 3D 동기화 ───
    function syncWallConfigFrom3D(walls3D) {
        const cfg = window.__wallConfig;
        if (!cfg) return;
        cfg.walls = walls3D.map(w => ({ widthMM: w.widthMM, heightMM: w.heightMM }));
        cfg.activeIndex = 0;
        // 멀티월 페이지 재생성 (window에 직접 노출된 함수 사용)
        if (window.initWallPagesMulti) {
            window.initWallPagesMulti(cfg.walls, cfg.doubleSided, cfg.activeIndex);
        }
        // 가격 재계산
        if (window.initWallConfig) {
            // renderUI만 갱신 (rebuild는 위에서 이미 함)
            cfg.pricePerSqm = cfg.pricePerSqm || 60000;
            window.__wallCalculatedPrice = cfg.totalPrice;
        }
    }

    // ─── 액세서리: 모서리 기둥 / 상단 조명 / 야외 받침대 ───

    function clearAccessories() {
        const ctx = getCtx();
        if (!ctx || !ctx.scene) return;
        accessoryMeshes.forEach(m => {
            ctx.scene.remove(m);
            m.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(mt => mt.dispose());
                    else child.material.dispose();
                }
            });
        });
        accessoryMeshes = [];
    }

    function rebuildAccessories() {
        clearAccessories();
        const ctx = getCtx();
        if (!ctx || !ctx.scene || !window.THREE) return;
        const THREE = window.THREE;
        const comp = getComp();
        const acc = window.__wallAccessories;
        if (comp.walls.length === 0) return;

        const accMat = new THREE.MeshStandardMaterial({ color: ACCESSORY_COLOR, roughness: 0.4, metalness: 0.1 });

        // ── 모서리 기둥 (yellow) ──
        if (acc.cornerPillar) {
            const pillarPositions = calcCornerPillarPositions(comp);
            pillarPositions.forEach(pp => {
                const h = pp.height;
                const pillarSize = 0.1;
                const geo = new THREE.BoxGeometry(pillarSize, h, pillarSize);
                const mesh = new THREE.Mesh(geo, accMat.clone());
                mesh.position.set(pp.x, h / 2, pp.z);
                ctx.scene.add(mesh);
                accessoryMeshes.push(mesh);
            });
            updateAccessoryCount('cornerPillarCount', pillarPositions.length);
        } else {
            updateAccessoryCount('cornerPillarCount', 0);
        }

        // ── 상단 조명 (yellow, rotated 90°, perpendicular to wall, half length) ──
        if (acc.topLight) {
            let lightCount = 0;
            comp.walls.forEach(wall => {
                const sections = Math.max(1, Math.round(wall.widthMM / 1000));
                const wM = wall.widthMM / 1000;
                const hM = wall.heightMM / 1000;
                const sectionW = wM / sections;
                const barH = 0.03;
                // Ensure world matrix is up-to-date before localToWorld
                if (wall.group) wall.group.updateMatrixWorld(true);
                for (let s = 0; s < sections; s++) {
                    const localX = -wM / 2 + sectionW / 2 + s * sectionW;
                    // 90° rotated: narrow along wall, extends front-to-back, halved length
                    const barW = 0.08;                     // narrow along wall
                    const barD = sectionW * 0.425;         // half of original length, perpendicular
                    const barGeo = new THREE.BoxGeometry(barW, barH, barD);
                    const bar = new THREE.Mesh(barGeo, accMat.clone());
                    if (wall.group) {
                        const worldPos = new THREE.Vector3(localX, hM / 2 + barH / 2, 0);
                        wall.group.localToWorld(worldPos);
                        bar.position.copy(worldPos);
                        bar.rotation.y = wall.rotY || 0;
                    }
                    ctx.scene.add(bar);
                    accessoryMeshes.push(bar);
                    lightCount++;
                }
            });
            updateAccessoryCount('topLightCount', lightCount);
        } else {
            updateAccessoryCount('topLightCount', 0);
        }

        // ── 야외용 받침대 (thick white trapezoid, only at OUTER endpoints, skip junctions) ──
        if (acc.outdoorStand) {
            let standCount = 0;
            const standMat = new THREE.MeshStandardMaterial({ color: STAND_COLOR, roughness: 0.5, metalness: 0.0 });
            // Bigger trapezoid to cover default white stands
            const bH = 0.40;  // bottom half-width (front-back extend)
            const tH = 0.08;  // top half-width
            const sH = 0.50;  // stand height (taller than default 0.45)
            const sT = 0.12;  // thickness along wall direction
            const trapShape = new THREE.Shape();
            trapShape.moveTo(-bH, 0);
            trapShape.lineTo(bH, 0);
            trapShape.lineTo(tH, sH);
            trapShape.lineTo(-tH, sH);
            trapShape.closePath();
            const trapGeo = new THREE.ExtrudeGeometry(trapShape, { depth: sT, bevelEnabled: false });

            // 접합점 계산 — 다른 벽과 만나는 끝점에는 받침대 배치 안 함
            const junctions = calcJunctionEndpoints(comp);

            comp.walls.forEach(wall => {
                const wM = wall.widthMM / 1000;
                const hM = wall.heightMM / 1000;
                // Ensure world matrix is up-to-date
                if (wall.group) wall.group.updateMatrixWorld(true);

                const sides = [
                    { localX: -wM / 2, key: wall.id + ':left' },
                    { localX: wM / 2, key: wall.id + ':right' }
                ];

                sides.forEach(({ localX, key }) => {
                    // 접합점이면 건너뜀 (L자 안쪽 등)
                    if (junctions.has(key)) return;

                    const standGroup = new THREE.Group();
                    const mesh = new THREE.Mesh(trapGeo, standMat.clone());
                    // Rotate so cross-section faces Z (front-back), extrusion along X
                    mesh.rotation.y = Math.PI / 2;
                    mesh.position.x = -sT / 2; // Center thickness
                    standGroup.add(mesh);

                    if (wall.group) {
                        const worldPos = new THREE.Vector3(localX, -hM / 2, 0);
                        wall.group.localToWorld(worldPos);
                        standGroup.position.copy(worldPos);
                        standGroup.rotation.y = wall.rotY || 0;
                    }
                    ctx.scene.add(standGroup);
                    accessoryMeshes.push(standGroup);
                    standCount++;
                });
            });
            // 1조 = 2개, 올림 처리
            const setCount = Math.ceil(standCount / 2);
            updateAccessoryCount('outdoorStandCount', setCount);
        } else {
            updateAccessoryCount('outdoorStandCount', 0);
        }

        updateAccessoryPricing();
    }

    // 벽 끝점 중 다른 벽과 만나는 접합점 계산 (야외 받침대 배치에서 제외할 끝점)
    function calcJunctionEndpoints(comp) {
        const junctions = new Set();
        const walls = comp.walls;
        if (walls.length < 2) return junctions;

        const threshold = 0.15; // 150mm 이내면 접합된 것으로 판단
        const endpoints = [];
        walls.forEach(wall => {
            const wM = wall.widthMM / 1000;
            const cos = Math.cos(wall.rotY || 0);
            const sin = Math.sin(wall.rotY || 0);
            const halfW = wM / 2;
            endpoints.push({ wallId: wall.id, side: 'left', x: wall.posX - halfW * cos, z: wall.posZ + halfW * sin });
            endpoints.push({ wallId: wall.id, side: 'right', x: wall.posX + halfW * cos, z: wall.posZ - halfW * sin });
        });

        for (let i = 0; i < endpoints.length; i++) {
            for (let j = i + 1; j < endpoints.length; j++) {
                if (endpoints[i].wallId === endpoints[j].wallId) continue;
                const dx = endpoints[i].x - endpoints[j].x;
                const dz = endpoints[i].z - endpoints[j].z;
                if (Math.sqrt(dx * dx + dz * dz) < threshold) {
                    junctions.add(endpoints[i].wallId + ':' + endpoints[i].side);
                    junctions.add(endpoints[j].wallId + ':' + endpoints[j].side);
                }
            }
        }
        return junctions;
    }

    // 모서리 기둥 위치 계산
    function calcCornerPillarPositions(comp) {
        const positions = [];
        const walls = comp.walls;
        if (walls.length < 2) return positions;
        const preset = comp.presetName;
        if (!preset || preset === 'I') return positions;

        // 벽의 끝점 계산
        const endpoints = [];
        walls.forEach(wall => {
            const wM = wall.widthMM / 1000;
            const hM = wall.heightMM / 1000;
            const cos = Math.cos(wall.rotY || 0);
            const sin = Math.sin(wall.rotY || 0);
            // 벽의 양 끝점 (XZ 평면)
            const halfW = wM / 2;
            endpoints.push({
                wallId: wall.id, height: hM,
                x1: wall.posX - halfW * cos, z1: wall.posZ + halfW * sin,
                x2: wall.posX + halfW * cos, z2: wall.posZ - halfW * sin
            });
        });

        // 끝점끼리 가까운 쌍 찾기 → 기둥 배치
        const threshold = 0.15; // 150mm 이내면 연결된 것으로 판단
        for (let i = 0; i < endpoints.length; i++) {
            for (let j = i + 1; j < endpoints.length; j++) {
                const ei = endpoints[i], ej = endpoints[j];
                const pairs = [
                    { x: ei.x1, z: ei.z1, ox: ej.x1, oz: ej.z1 },
                    { x: ei.x1, z: ei.z1, ox: ej.x2, oz: ej.z2 },
                    { x: ei.x2, z: ei.z2, ox: ej.x1, oz: ej.z1 },
                    { x: ei.x2, z: ei.z2, ox: ej.x2, oz: ej.z2 }
                ];
                for (const p of pairs) {
                    const dist = Math.sqrt((p.x - p.ox) ** 2 + (p.z - p.oz) ** 2);
                    if (dist < threshold) {
                        const mx = (p.x + p.ox) / 2;
                        const mz = (p.z + p.oz) / 2;
                        // 중복 방지
                        const dup = positions.some(pp => Math.abs(pp.x - mx) < 0.05 && Math.abs(pp.z - mz) < 0.05);
                        if (!dup) {
                            positions.push({
                                x: mx, z: mz,
                                height: Math.max(ei.height, ej.height)
                            });
                        }
                    }
                }
            }
        }
        return positions;
    }

    function updateAccessoryCount(elemId, count) {
        const el = document.getElementById(elemId);
        if (el) el.textContent = count > 0 ? '\u00D7' + count : '';
    }

    function updateAccessoryPricing() {
        const getCount = (id) => parseInt(document.getElementById(id)?.textContent?.replace('\u00D7', '') || '0');
        const pillarCount = getCount('cornerPillarCount');
        const lightCount = getCount('topLightCount');
        const standSetCount = getCount('outdoorStandCount');

        const cfg = window.SITE_CONFIG || {};
        const rate = (cfg.CURRENCY_RATE && cfg.CURRENCY_RATE[cfg.COUNTRY]) || 1;
        const unit = (cfg.CURRENCY_UNIT && cfg.CURRENCY_UNIT[cfg.COUNTRY]) || '\uC6D0';

        const pillarTotal = pillarCount * ACCESSORY_PRICES_KRW.cornerPillar * rate;
        const lightTotal = lightCount * ACCESSORY_PRICES_KRW.topLight * rate;
        const standTotal = standSetCount * ACCESSORY_PRICES_KRW.outdoorStand * rate;
        const grandTotal = pillarTotal + lightTotal + standTotal;

        const priceEl = document.getElementById('accessoryPriceDisplay');
        if (priceEl) {
            if (grandTotal > 0) {
                const fmt = (v) => Math.round(v).toLocaleString();
                let lines = [];
                const _t = (k, d) => (window.t ? window.t(k, d) : d);
                if (pillarCount > 0) lines.push(_t('wall_opt_corner_pillar', '\uCF54\uB108\uAE30\uB465') + ' ' + pillarCount + '\u00D7' + fmt(ACCESSORY_PRICES_KRW.cornerPillar * rate));
                if (lightCount > 0) lines.push(_t('wall_acc_light', '\uC870\uBA85') + ' ' + lightCount + '\u00D7' + fmt(ACCESSORY_PRICES_KRW.topLight * rate));
                if (standSetCount > 0) lines.push(_t('wall_acc_stand', '\uC678\uBD80\uBC1B\uCE68') + ' ' + standSetCount + _t('wall_acc_set_unit', '\uC870') + '\u00D7' + fmt(ACCESSORY_PRICES_KRW.outdoorStand * rate));
                priceEl.innerHTML = lines.join('<br>') +
                    '<div style="border-top:1px solid rgba(255,255,255,0.15);margin:4px 0;padding-top:4px;font-weight:700;color:#FFD700;">' +
                    fmt(grandTotal) + ' ' + unit + '</div>';
                priceEl.style.display = 'block';
            } else {
                priceEl.style.display = 'none';
            }
        }

        // Store in __wallConfig for order.js
        if (window.__wallConfig) {
            window.__wallConfig.accessories = { ...window.__wallAccessories };
            window.__wallConfig.accessoryPrice = Math.round(grandTotal / rate); // Store in KRW
            window.__wallConfig.accessoryCounts = {
                cornerPillar: pillarCount,
                topLight: lightCount,
                outdoorStand: standSetCount
            };
        }
    }

    window.toggleAccessory = function (key, enabled) {
        window.__wallAccessories[key] = enabled;
        rebuildAccessories();

        const addonCode = ADDON_CODE_MAP[key];
        if (!addonCode) return;

        // ★ pendingSelectedAddons 직접 동기화 (장바구니 담기 시 반영)
        if (!window.pendingSelectedAddons) window.pendingSelectedAddons = [];
        if (!window.pendingSelectedAddonQtys) window.pendingSelectedAddonQtys = {};
        const idx = window.pendingSelectedAddons.indexOf(addonCode);
        if (enabled && idx === -1) {
            window.pendingSelectedAddons.push(addonCode);
        } else if (!enabled && idx !== -1) {
            window.pendingSelectedAddons.splice(idx, 1);
            delete window.pendingSelectedAddonQtys[addonCode];
        }
        if (enabled) {
            const countEl = document.getElementById(
                key === 'cornerPillar' ? 'cornerPillarCount' :
                key === 'topLight' ? 'topLightCount' : 'outdoorStandCount'
            );
            window.pendingSelectedAddonQtys[addonCode] = parseInt(countEl?.textContent?.replace('\u00D7', '') || '1');
        }

        // Sync with DOM addon checkboxes (if visible)
        const chk = document.querySelector('input[name="userOption"][value="' + addonCode + '"]');
        if (chk) {
            chk.checked = enabled;
            const row = chk.closest('.addon-item-row');
            if (row) {
                const qtyBox = row.querySelector('.addon-qty-box');
                if (qtyBox) qtyBox.style.display = enabled ? 'flex' : 'none';
                if (enabled) {
                    const qtyInput = row.querySelector('.addon-qty-input');
                    if (qtyInput) qtyInput.value = window.pendingSelectedAddonQtys[addonCode] || 1;
                }
            }
        }
        if (window.updateModalTotal) window.updateModalTotal();
    };

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

        // 백업: open3DPreview에서 initWallsFromConfig가 호출되지 않은 경우
        const comp = getComp();
        if (window.__wallMode && comp.walls.length === 0) {
            setTimeout(() => {
                if (getComp().walls.length === 0) {
                    initWallsFromConfig();
                }
            }, 500);
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
