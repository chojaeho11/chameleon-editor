// wall-3d-preview.js — 허니콤보드 가벽 3D 미리보기
(function () {
    'use strict';

    let scene, camera, renderer, wallGroup;
    let isInitialized = false;
    let threeLoaded = false;
    let animFrameId = null;
    let frontTexture = null;
    let backTexture = null;
    let currentWidthMM = 0, currentHeightMM = 0;

    // Orbit state
    let isDragging = false, isPanning = false;
    let prevX = 0, prevY = 0;
    let spherical = { theta: Math.PI / 4, phi: Math.PI / 3, radius: 5 };
    let target = { x: 0, y: 1, z: 0 };

    // Colors
    const COL_SIDE = 0xf0f0f0;
    const COL_BACK = 0xe8e8e8;
    const COL_FRAME = 0xbbbbbb;
    const COL_BRACKET = 0x999999;
    const COL_STAND = 0xd0d0d0;
    const COL_FLOOR = 0x2a2a3e;
    const COL_BG = 0x1a1a2e;

    // ─── Dynamic Three.js Loader ───
    function loadThreeJS() {
        return new Promise((resolve, reject) => {
            if (window.THREE) { threeLoaded = true; resolve(); return; }
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/three@0.137.0/build/three.min.js';
            s.onload = () => { threeLoaded = true; resolve(); };
            s.onerror = () => reject(new Error('Failed to load Three.js'));
            document.head.appendChild(s);
        });
    }

    // ─── Simple Orbit Controls (built-in) ───
    function updateCamera() {
        if (!camera) return;
        const r = spherical.radius;
        const sinPhi = Math.sin(spherical.phi);
        camera.position.set(
            target.x + r * sinPhi * Math.sin(spherical.theta),
            target.y + r * Math.cos(spherical.phi),
            target.z + r * sinPhi * Math.cos(spherical.theta)
        );
        camera.lookAt(target.x, target.y, target.z);
    }

    let isSpaceHeld = false;

    function setupControls(domElement) {
        // Spacebar tracking for pan mode
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.repeat) {
                const modal = document.getElementById('wall3DModal');
                if (modal && modal.style.display === 'flex') {
                    e.preventDefault();
                    isSpaceHeld = true;
                }
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') { isSpaceHeld = false; }
        });

        domElement.addEventListener('mousedown', (e) => {
            // 벽 드래그 중이면 orbit 방지 (wall-3d-walls.js에서 설정)
            if (window.__wallDragMode) return;
            // Space+왼클릭 = 팬, 일반 왼클릭 = 회전
            if (e.button === 0 && isSpaceHeld) { isPanning = true; isDragging = false; }
            else if (e.button === 0) { isDragging = true; isPanning = false; }
            if (e.button === 2) { isPanning = true; isDragging = false; }
            prevX = e.clientX; prevY = e.clientY;
        });
        domElement.addEventListener('mousemove', (e) => {
            if (window.__wallDragMode) return; // 벽 드래그 중이면 orbit 방지
            if (isDragging) {
                const dx = e.clientX - prevX;
                const dy = e.clientY - prevY;
                spherical.theta -= dx * 0.005;
                spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi + dy * 0.005));
                updateCamera();
            }
            if (isPanning) {
                const dx = e.clientX - prevX;
                const dy = e.clientY - prevY;
                const speed = spherical.radius * 0.001;
                // Pan in camera-local space
                const right = new THREE.Vector3();
                const up = new THREE.Vector3(0, 1, 0);
                camera.getWorldDirection(right);
                right.cross(up).normalize();
                target.x -= dx * speed * right.x;
                target.z -= dx * speed * right.z;
                target.y += dy * speed;
                updateCamera();
            }
            prevX = e.clientX; prevY = e.clientY;
        });
        window.addEventListener('mouseup', () => { isDragging = false; isPanning = false; });
        domElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            spherical.radius = Math.max(0.5, Math.min(20, spherical.radius + e.deltaY * 0.003));
            updateCamera();
        }, { passive: false });
        domElement.addEventListener('contextmenu', (e) => e.preventDefault());

        // Touch support
        let touchStartDist = 0;
        domElement.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                prevX = e.touches[0].clientX;
                prevY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                isDragging = false;
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                touchStartDist = Math.sqrt(dx * dx + dy * dy);
            }
        });
        domElement.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && isDragging) {
                const dx = e.touches[0].clientX - prevX;
                const dy = e.touches[0].clientY - prevY;
                spherical.theta -= dx * 0.005;
                spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi + dy * 0.005));
                updateCamera();
                prevX = e.touches[0].clientX;
                prevY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                spherical.radius = Math.max(0.5, Math.min(20, spherical.radius - (dist - touchStartDist) * 0.01));
                touchStartDist = dist;
                updateCamera();
            }
        }, { passive: false });
        domElement.addEventListener('touchend', () => { isDragging = false; });
    }

    // ─── Init Scene ───
    function initScene(container) {
        if (isInitialized) return;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(COL_BG);

        const w = container.clientWidth;
        const h = container.clientHeight;
        camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);

        renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(renderer.domElement);

        // Built-in orbit controls
        setupControls(renderer.domElement);

        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 8, 5);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 512;
        dirLight.shadow.mapSize.height = 512;
        scene.add(dirLight);

        const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
        backLight.position.set(-3, 4, -5);
        scene.add(backLight);

        // Floor
        const floorGeo = new THREE.PlaneGeometry(20, 20);
        const floorMat = new THREE.MeshStandardMaterial({ color: COL_FLOOR, roughness: 0.9 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // Grid
        const grid = new THREE.GridHelper(20, 20, 0x3a3a5e, 0x2a2a4e);
        grid.position.y = 0.001;
        scene.add(grid);

        // Resize
        const ro = new ResizeObserver(() => {
            const cw = container.clientWidth;
            const ch = container.clientHeight;
            if (cw > 0 && ch > 0) {
                camera.aspect = cw / ch;
                camera.updateProjectionMatrix();
                renderer.setSize(cw, ch);
            }
        });
        ro.observe(container);

        isInitialized = true;
    }

    // ─── Animate ───
    function animate() {
        const modal = document.getElementById('wall3DModal');
        if (!modal || modal.style.display === 'none') {
            animFrameId = null;
            return;
        }
        animFrameId = requestAnimationFrame(animate);
        if (renderer && scene && camera) renderer.render(scene, camera);
    }

    function startAnimate() {
        if (!animFrameId) animate();
    }

    // ─── Build Wall (양면 지원) ───
    function buildWall(widthMM, heightMM, frontDataUrl, backDataUrl) {
        if (wallGroup) {
            scene.remove(wallGroup);
            wallGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
        }

        wallGroup = new THREE.Group();

        const width = widthMM / 1000;
        const height = heightMM / 1000;
        const doubleSided = window.__wallConfig?.doubleSided || false;
        const depth = doubleSided ? 0.2 : 0.1; // 양면 200mm, 단면 100mm

        currentWidthMM = widthMM;
        currentHeightMM = heightMM;

        // ── 1. Main Panel ──
        const panelGeo = new THREE.BoxGeometry(width, height, depth);

        if (frontTexture) frontTexture.dispose();
        if (backTexture) backTexture.dispose();
        frontTexture = null;
        backTexture = null;

        const sideMat = new THREE.MeshStandardMaterial({ color: COL_SIDE, roughness: 0.5 });

        // Front face material
        let frontMat;
        if (frontDataUrl) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () {
                frontTexture = new THREE.Texture(img);
                frontTexture.needsUpdate = true;
                frontTexture.encoding = THREE.sRGBEncoding;
                panel.material[4] = new THREE.MeshStandardMaterial({ map: frontTexture, roughness: 0.4 });
            };
            img.src = frontDataUrl;
            frontMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
        } else {
            frontMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
        }

        // Back face material (뒷면 텍스처 — 좌우반전)
        let backMat;
        if (backDataUrl) {
            const backImg = new Image();
            backImg.crossOrigin = 'anonymous';
            backImg.onload = function () {
                backTexture = new THREE.Texture(backImg);
                backTexture.needsUpdate = true;
                backTexture.encoding = THREE.sRGBEncoding;
                backTexture.wrapS = THREE.RepeatWrapping;
                backTexture.repeat.x = -1;
                panel.material[5] = new THREE.MeshStandardMaterial({ map: backTexture, roughness: 0.4 });
            };
            backImg.src = backDataUrl;
            backMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
        } else {
            backMat = new THREE.MeshStandardMaterial({ color: COL_BACK, roughness: 0.6 });
        }

        // BoxGeometry faces: +X, -X, +Y, -Y, +Z(front), -Z(back)
        const materials = [sideMat, sideMat, sideMat, sideMat, frontMat, backMat];
        const panel = new THREE.Mesh(panelGeo, materials);
        panel.castShadow = true;
        panel.receiveShadow = true;
        panel.name = 'mainPanel';
        wallGroup.add(panel);

        if (!doubleSided) {
            // ── 단면: Back Frame + Triangle Stands ──
            const frameMat = new THREE.MeshStandardMaterial({ color: COL_FRAME, roughness: 0.6 });
            const bracketMat = new THREE.MeshStandardMaterial({ color: COL_BRACKET, roughness: 0.5 });

            const frameZ = -depth / 2 - 0.015;
            const railThick = 0.05;
            const railDepth = 0.025;

            addBox(width - 0.02, railThick, railDepth, 0, height / 2 - railThick / 2, frameZ, frameMat);
            addBox(width - 0.02, railThick, railDepth, 0, -height / 2 + railThick / 2, frameZ, frameMat);
            addBox(railThick, height, railDepth, -width / 2 + railThick / 2, 0, frameZ, frameMat);
            addBox(railThick, height, railDepth, width / 2 - railThick / 2, 0, frameZ, frameMat);
            addBox(width - 0.02, 0.04, railDepth, 0, 0, frameZ, frameMat);

            const numSections = Math.max(1, Math.round(widthMM / 1000));
            for (let i = 1; i < numSections; i++) {
                const x = -width / 2 + (i * width / numSections);
                addBox(0.04, height - 0.1, railDepth, x, 0, frameZ, frameMat);
                addBox(0.06, 0.06, 0.02, x, height / 2 - 0.05, frameZ - 0.01, bracketMat);
                addBox(0.06, 0.06, 0.02, x, 0, frameZ - 0.01, bracketMat);
                addBox(0.06, 0.06, 0.02, x, -height / 2 + 0.05, frameZ - 0.01, bracketMat);
            }

            [[-width / 2 + 0.04, height / 2 - 0.04], [width / 2 - 0.04, height / 2 - 0.04],
             [-width / 2 + 0.04, -height / 2 + 0.04], [width / 2 - 0.04, -height / 2 + 0.04]
            ].forEach(([cx, cy]) => addBox(0.06, 0.06, 0.02, cx, cy, frameZ - 0.01, bracketMat));

            const standMat = new THREE.MeshStandardMaterial({ color: COL_STAND, roughness: 0.5 });
            const numStands = Math.max(2, numSections + 1);
            const standSpacing = width / (numStands - 1);

            for (let i = 0; i < numStands; i++) {
                const sx = -width / 2 + i * standSpacing;
                createTriangleStand(sx, -height / 2, -depth / 2, standMat);
            }
        } else {
            // ── 양면: 중간 이음선 (두 패널 경계) ──
            const seamMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.5 });
            // 수평 중간 이음선
            addBox(width + 0.01, 0.005, depth + 0.005, 0, 0, 0, seamMat);
            // 양쪽 테두리
            addBox(0.008, height, depth + 0.005, -width / 2, 0, 0, seamMat);
            addBox(0.008, height, depth + 0.005, width / 2, 0, 0, seamMat);
            addBox(width, 0.008, depth + 0.005, 0, height / 2, 0, seamMat);
            addBox(width, 0.008, depth + 0.005, 0, -height / 2, 0, seamMat);
        }

        // Position wall on floor
        wallGroup.position.set(0, height / 2, 0);
        scene.add(wallGroup);

        // Camera position
        const dist = Math.max(width, height) * 1.5;
        spherical.radius = dist;
        spherical.theta = Math.PI / 5;
        spherical.phi = Math.PI / 3;
        target.x = 0;
        target.y = height / 2;
        target.z = 0;
        updateCamera();

        // Dimension label
        const depthMM = doubleSided ? 200 : 100;
        const label = document.getElementById('wall3dDimLabel');
        if (label) label.textContent = widthMM + 'mm \u00D7 ' + heightMM + 'mm \u00D7 ' + depthMM + 'mm';
    }

    function addBox(w, h, d, x, y, z, mat) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        wallGroup.add(mesh);
    }

    function createTriangleStand(x, bottomY, backZ, mat) {
        const standWidth = 0.04;
        const standBase = 0.35;
        const standHeight = 0.45;

        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(-standBase, 0);
        shape.lineTo(0, standHeight);
        shape.closePath();

        const geo = new THREE.ExtrudeGeometry(shape, { depth: standWidth, bevelEnabled: false });
        const mesh = new THREE.Mesh(geo, mat);
        // 삼각 받침대를 뒤쪽(-Z)으로 향하게 회전
        mesh.rotation.y = -Math.PI / 2;
        mesh.position.set(x, bottomY, backZ);
        mesh.castShadow = true;
        wallGroup.add(mesh);

        // Connecting plate (뒤쪽으로 확장)
        const plateGeo = new THREE.BoxGeometry(0.08, 0.12, standBase * 0.3);
        const plate = new THREE.Mesh(plateGeo, mat);
        plate.position.set(x, bottomY + 0.06, backZ - standBase * 0.15);
        wallGroup.add(plate);
    }

    // ─── Build Box (6-face) ───
    function buildBox(wMM, hMM, dMM, faceDataUrls) {
        if (wallGroup) {
            scene.remove(wallGroup);
            wallGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
        }

        wallGroup = new THREE.Group();

        const width = wMM / 1000;   // Three.js units = meters
        const height = hMM / 1000;
        const depth = dMM / 1000;

        currentWidthMM = wMM;
        currentHeightMM = hMM;

        const boxGeo = new THREE.BoxGeometry(width, height, depth);

        // BoxGeometry face order: [+X(Right), -X(Left), +Y(Top), -Y(Bottom), +Z(Front), -Z(Back)]
        // Our face order: [Front(0), Back(1), Left(2), Right(3), Top(4), Bottom(5)]
        const faceMapping = [3, 2, 4, 5, 0, 1]; // boxGeo index → our face index

        const defaultMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
        const materials = [];

        for (let gi = 0; gi < 6; gi++) {
            const fi = faceMapping[gi]; // our face index
            if (faceDataUrls[fi]) {
                const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
                materials.push(mat);

                // Async texture load
                (function(matRef, dataUrl) {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = function() {
                        const tex = new THREE.Texture(img);
                        tex.needsUpdate = true;
                        tex.encoding = THREE.sRGBEncoding;
                        matRef.map = tex;
                        matRef.needsUpdate = true;
                    };
                    img.src = dataUrl;
                })(mat, faceDataUrls[fi]);
            } else {
                materials.push(defaultMat.clone());
            }
        }

        const box = new THREE.Mesh(boxGeo, materials);
        box.castShadow = true;
        box.receiveShadow = true;
        box.name = 'mainPanel';
        wallGroup.add(box);

        // Position box on floor
        wallGroup.position.set(0, height / 2, 0);
        scene.add(wallGroup);

        // Camera
        const maxDim = Math.max(width, height, depth);
        spherical.radius = maxDim * 2.5;
        spherical.theta = Math.PI / 5;
        spherical.phi = Math.PI / 3;
        target.x = 0;
        target.y = height / 2;
        target.z = 0;
        updateCamera();

        // Dimension label
        const label = document.getElementById('wall3dDimLabel');
        if (label) label.textContent = wMM + 'mm \u00D7 ' + hMM + 'mm \u00D7 ' + dMM + 'mm';
    }

    // ─── Capture all 6 box faces (async) ───
    async function captureAllBoxFaces() {
        const fabricCanvas = window.canvas;
        if (!fabricCanvas) return [];

        // Save current page
        if (window.savePageState) window.savePageState();
        const origIndex = window._getPageIndex ? window._getPageIndex() : 0;
        const pageList = window.__pageDataList;
        if (!pageList || pageList.length < 6) return [];

        const textures = [];
        for (let i = 0; i < 6; i++) {
            // loadFromJSON is async when images exist — must await
            await new Promise(resolve => {
                fabricCanvas.loadFromJSON(pageList[i], () => resolve());
            });

            const board = fabricCanvas.getObjects().find(o => o.isBoard);
            if (!board) { textures.push(null); continue; }

            try {
                const vpt = fabricCanvas.viewportTransform.slice();
                // ★ board의 실제 크기 (scaleX/Y 반영)
                const bW = Math.round(board.width * (board.scaleX || 1));
                const bH = Math.round(board.height * (board.scaleY || 1));
                const bL = board.left || 0;
                const bT = board.top || 0;

                fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
                fabricCanvas.setDimensions({ width: bL + bW, height: bT + bH });
                fabricCanvas.renderAll();

                const dataUrl = fabricCanvas.toDataURL({
                    format: 'png',
                    left: bL, top: bT,
                    width: bW, height: bH
                });
                textures.push(dataUrl);

                fabricCanvas.viewportTransform = vpt;
            } catch (e) {
                console.error('Box face capture failed for face ' + i, e);
                textures.push(null);
            }
        }

        // Restore original page
        await new Promise(resolve => {
            fabricCanvas.loadFromJSON(pageList[origIndex], () => {
                const b = fabricCanvas.getObjects().find(o => o.isBoard);
                if (b) fabricCanvas.sendToBack(b);
                const stage = document.querySelector('.stage');
                if (stage) fabricCanvas.setDimensions({ width: stage.clientWidth, height: stage.clientHeight });
                fabricCanvas.renderAll();
                resolve();
            });
        });

        return textures;
    }

    // ─── Capture all wall faces (양면) ───
    async function captureAllWallFaces() {
        const fabricCanvas = window.canvas;
        if (!fabricCanvas) return [];

        if (window.savePageState) window.savePageState();
        const origIndex = window._getPageIndex ? window._getPageIndex() : 0;
        const pageList = window.__pageDataList;
        if (!pageList || pageList.length < 1) return [];

        const textures = [];
        const doubleSided = window.__wallConfig?.doubleSided || false;
        // 단면: 1페이지(앞면만), 양면: 2페이지(앞+뒤)
        const faceCount = doubleSided ? Math.min(pageList.length, 2) : 1;

        for (let i = 0; i < faceCount; i++) {
            await new Promise(resolve => {
                fabricCanvas.loadFromJSON(pageList[i], () => resolve());
            });

            const board = fabricCanvas.getObjects().find(o => o.isBoard);
            if (!board) { textures.push(null); continue; }

            try {
                const vpt = fabricCanvas.viewportTransform.slice();
                fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
                fabricCanvas.setDimensions({ width: board.width, height: board.height });
                fabricCanvas.renderAll();

                const dataUrl = fabricCanvas.toDataURL({
                    format: 'png', left: 0, top: 0,
                    width: board.width, height: board.height
                });
                textures.push(dataUrl);

                fabricCanvas.viewportTransform = vpt;
            } catch (e) {
                console.error('Wall face capture failed for face ' + i, e);
                textures.push(null);
            }
        }

        // Restore original page
        await new Promise(resolve => {
            fabricCanvas.loadFromJSON(pageList[origIndex], () => {
                const b = fabricCanvas.getObjects().find(o => o.isBoard);
                if (b) fabricCanvas.sendToBack(b);
                const stage = document.querySelector('.stage');
                if (stage) fabricCanvas.setDimensions({ width: stage.clientWidth, height: stage.clientHeight });
                fabricCanvas.renderAll();
                resolve();
            });
        });

        return textures;
    }

    // ─── 벽별 개별 텍스처 캡처 (멀티월용) ───
    async function capturePerWallTextures() {
        const fabricCanvas = window.canvas;
        if (!fabricCanvas) return [];

        if (window.savePageState) window.savePageState();
        const origIndex = window._getPageIndex ? window._getPageIndex() : 0;
        const pageList = window.__pageDataList;
        if (!pageList || pageList.length < 1) return [];

        const cfg = window.__wallConfig;
        const doubleSided = cfg?.doubleSided || false;
        const pagesPerWall = doubleSided ? 2 : 1;
        const wallCount = cfg?.walls?.length || 1;
        const result = [];

        for (let wi = 0; wi < wallCount; wi++) {
            const wallTex = { front: null, back: null };
            const frontIdx = wi * pagesPerWall;

            // Front face
            if (frontIdx < pageList.length) {
                try {
                    await new Promise(resolve => {
                        fabricCanvas.loadFromJSON(pageList[frontIdx], () => resolve());
                    });
                    const board = fabricCanvas.getObjects().find(o => o.isBoard);
                    if (board) {
                        const vpt = fabricCanvas.viewportTransform.slice();
                        fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
                        fabricCanvas.setDimensions({ width: board.width, height: board.height });
                        fabricCanvas.renderAll();
                        wallTex.front = fabricCanvas.toDataURL({
                            format: 'png', left: 0, top: 0,
                            width: board.width, height: board.height
                        });
                        fabricCanvas.viewportTransform = vpt;
                    }
                } catch (e) {
                    console.error('Wall texture capture failed for wall ' + wi + ' front', e);
                }
            }

            // Back face (양면만)
            if (doubleSided) {
                const backIdx = wi * pagesPerWall + 1;
                if (backIdx < pageList.length) {
                    try {
                        await new Promise(resolve => {
                            fabricCanvas.loadFromJSON(pageList[backIdx], () => resolve());
                        });
                        const board = fabricCanvas.getObjects().find(o => o.isBoard);
                        if (board) {
                            const vpt = fabricCanvas.viewportTransform.slice();
                            fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
                            fabricCanvas.setDimensions({ width: board.width, height: board.height });
                            fabricCanvas.renderAll();
                            wallTex.back = fabricCanvas.toDataURL({
                                format: 'png', left: 0, top: 0,
                                width: board.width, height: board.height
                            });
                            fabricCanvas.viewportTransform = vpt;
                        }
                    } catch (e) {
                        console.error('Wall texture capture failed for wall ' + wi + ' back', e);
                    }
                }
            }

            result.push(wallTex);
        }

        // Restore original page
        if (origIndex < pageList.length) {
            await new Promise(resolve => {
                fabricCanvas.loadFromJSON(pageList[origIndex], () => {
                    const b = fabricCanvas.getObjects().find(o => o.isBoard);
                    if (b) fabricCanvas.sendToBack(b);
                    const stage = document.querySelector('.stage');
                    if (stage) fabricCanvas.setDimensions({ width: stage.clientWidth, height: stage.clientHeight });
                    fabricCanvas.renderAll();
                    resolve();
                });
            });
        }

        return result;
    }

    // ─── Canvas Capture Helper ───
    function captureCanvas() {
        const fabricCanvas = window.canvas;
        if (!fabricCanvas) return null;

        const board = fabricCanvas.getObjects().find(o => o.isBoard);
        if (!board) return null;

        try {
            const vpt = fabricCanvas.viewportTransform.slice();
            fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
            fabricCanvas.setDimensions({ width: board.width, height: board.height });
            fabricCanvas.renderAll();

            const dataUrl = fabricCanvas.toDataURL({
                format: 'png', left: 0, top: 0,
                width: board.width, height: board.height
            });

            fabricCanvas.viewportTransform = vpt;
            const stage = document.querySelector('.stage');
            if (stage) fabricCanvas.setDimensions({ width: stage.clientWidth, height: stage.clientHeight });
            fabricCanvas.renderAll();
            return dataUrl;
        } catch (e) {
            console.error('3D: canvas capture failed', e);
            return null;
        }
    }

    // ─── Capture Paper Display faces (4 pages) ───
    async function capturePaperDisplayFaces() {
        const fabricCanvas = window.canvas;
        if (!fabricCanvas) return [];

        if (window.savePageState) window.savePageState();
        const origIndex = window._getPageIndex ? window._getPageIndex() : 0;
        const pageList = window.__pageDataList;
        if (!pageList || pageList.length < 4) return [];

        const textures = [];
        for (let i = 0; i < 4; i++) {
            await new Promise(resolve => {
                fabricCanvas.loadFromJSON(pageList[i], () => resolve());
            });

            const board = fabricCanvas.getObjects().find(o => o.isBoard);
            if (!board) { textures.push(null); continue; }

            try {
                const vpt = fabricCanvas.viewportTransform.slice();
                fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
                fabricCanvas.setDimensions({ width: board.width, height: board.height });
                fabricCanvas.renderAll();

                const dataUrl = fabricCanvas.toDataURL({
                    format: 'png', left: 0, top: 0,
                    width: board.width, height: board.height
                });
                textures.push(dataUrl);

                fabricCanvas.viewportTransform = vpt;
            } catch (e) {
                console.error('PD face capture failed for face ' + i, e);
                textures.push(null);
            }
        }

        // Restore original page
        await new Promise(resolve => {
            fabricCanvas.loadFromJSON(pageList[origIndex], () => {
                const b = fabricCanvas.getObjects().find(o => o.isBoard);
                if (b) fabricCanvas.sendToBack(b);
                const stage = document.querySelector('.stage');
                if (stage) fabricCanvas.setDimensions({ width: stage.clientWidth, height: stage.clientHeight });
                fabricCanvas.renderAll();
                resolve();
            });
        });

        return textures;
    }

    // ─── Build Paper Display 3D ───
    // 참조: 실제 종이매대 구조
    //      ╭──────────╮   ← 상단 간판 (라운딩 상단)
    //      │ Top Ad   │
    //   ┌──┤          ├──┐
    //   │옆│ ▌lip▌   │옆│  ← 옆판: 상단 선반 위 약간만 올라감
    //   │  │_________│  │
    //   │  │ ▌lip▌   │  │
    //   │  │_________│  │
    //   │  │ ▌lip▌   │  │
    //   └──┴─────────┴──┘  ← 바닥판 (땅 위에 놓임)
    //        뒷판 (bgColor)
    function buildPaperDisplay(pd, textures) {
        if (wallGroup) {
            scene.remove(wallGroup);
            wallGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
        }

        wallGroup = new THREE.Group();

        const w = pd.widthMM / 1000;   // meters
        const h = pd.heightMM / 1000;
        const d = pd.depthMM / 1000;
        const adH = pd.adHeightMM / 1000;
        const shH = pd.shelfHeightMM / 1000;
        const thick = 0.005; // 5mm
        const lipH = 0.07;   // 선반 앞면 립 높이 7cm
        const bgColor = new THREE.Color(pd.bgColor || '#ffffff');
        const bgMat = new THREE.MeshStandardMaterial({ color: bgColor, roughness: 0.5 });

        const bodyH = h - adH; // 선반 영역 높이
        const shelfCount = pd.shelfCount || Math.floor(bodyH / shH);
        const innerW = w - thick * 2;
        const sideMargin = 0.07; // 옆판이 상단 선반보다 7cm 위로

        // Helper: create textured material from dataURL
        function makeTexMat(dataUrl, mirror) {
            if (!dataUrl) return bgMat.clone();
            var mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () {
                var tex = new THREE.Texture(img);
                tex.needsUpdate = true;
                tex.encoding = THREE.sRGBEncoding;
                if (mirror) {
                    tex.wrapS = THREE.RepeatWrapping;
                    tex.repeat.x = -1;
                }
                mat.map = tex;
                mat.needsUpdate = true;
            };
            img.src = dataUrl;
            return mat;
        }

        // BoxGeometry face order: [+X(Right), -X(Left), +Y(Top), -Y(Bottom), +Z(Front), -Z(Back)]

        // 1. 뒷판 하단부 (선반 영역, bgColor만)
        var backBodyGeo = new THREE.BoxGeometry(w, bodyH, thick);
        var backBody = new THREE.Mesh(backBodyGeo, bgMat.clone());
        backBody.position.set(0, bodyH / 2, -d / 2);
        wallGroup.add(backBody);

        // 2. 상단 광고판 — 사각 BoxGeometry (텍스처 앞뒤 양면)
        console.log('[PD 3D] ad texture[0]:', textures[0] ? textures[0].substring(0, 60) + '...' : 'NULL');
        var adGeo = new THREE.BoxGeometry(w, adH, thick);
        var adMats = [
            bgMat.clone(), bgMat.clone(),        // +X, -X
            bgMat.clone(), bgMat.clone(),        // +Y, -Y
            makeTexMat(textures[0], false),       // +Z front
            makeTexMat(textures[0], false)        // -Z back (양면 텍스처)
        ];
        var adPanel = new THREE.Mesh(adGeo, adMats);
        adPanel.position.set(0, bodyH + adH / 2, -d / 2);
        wallGroup.add(adPanel);

        // 3. 옆면 — 상단 선반보다 약간 위까지만 (bodyH + sideMargin)
        var sideH = bodyH + sideMargin;
        var sideGeo = new THREE.BoxGeometry(thick, sideH, d);

        // 좌측 옆면
        var leftMats = [
            bgMat.clone(),                       // +X (inner)
            makeTexMat(textures[1], false),       // -X (outer)
            bgMat.clone(), bgMat.clone(),
            bgMat.clone(), bgMat.clone()
        ];
        var leftPanel = new THREE.Mesh(sideGeo, leftMats);
        leftPanel.position.set(-w / 2, sideH / 2, 0);
        wallGroup.add(leftPanel);

        // 우측 옆면 (미러링 없이 동일 디자인)
        var rightMats = [
            makeTexMat(textures[1], false),        // +X (outer, 정상)
            bgMat.clone(),                         // -X (inner)
            bgMat.clone(), bgMat.clone(),
            bgMat.clone(), bgMat.clone()
        ];
        var rightPanel = new THREE.Mesh(sideGeo.clone(), rightMats);
        rightPanel.position.set(w / 2, sideH / 2, 0);
        wallGroup.add(rightPanel);

        // 4. 선반들 — 수평판 (bgColor) + 앞면 립 (텍스처)
        for (var i = 0; i <= shelfCount; i++) {
            var shelfY = bodyH - i * shH;
            if (shelfY < 0) break; // 바닥 아래로 내려가지 않게

            // 수평 선반판
            var platGeo = new THREE.BoxGeometry(innerW, thick, d);
            var plat = new THREE.Mesh(platGeo, bgMat.clone());
            plat.position.set(0, shelfY, 0);
            wallGroup.add(plat);

            // 앞면 립
            var actualLipH = Math.min(lipH, shH - thick);
            var lipGeo = new THREE.BoxGeometry(innerW, actualLipH, thick);
            var lipMats = [
                bgMat.clone(), bgMat.clone(),
                bgMat.clone(), bgMat.clone(),
                makeTexMat(textures[2], false),  // +Z front
                bgMat.clone()
            ];
            var lip = new THREE.Mesh(lipGeo, lipMats);
            lip.position.set(0, shelfY + actualLipH / 2, d / 2 - thick / 2);
            wallGroup.add(lip);
        }

        // 5. 바닥판 (땅 위에 놓임, Y=0 바로 위)
        var bottomGeo = new THREE.BoxGeometry(w, thick, d);
        var bottom = new THREE.Mesh(bottomGeo, bgMat.clone());
        bottom.position.set(0, thick / 2, 0);
        wallGroup.add(bottom);

        // 6. 하단 앞면 패널 (마지막 선반 아래 ~ 바닥까지, textures[3])
        var lastShelfY = bodyH - shelfCount * shH;
        var bottomPanelH = lastShelfY - thick; // 바닥판 두께 제외
        if (bottomPanelH > 0.005) {
            var bpGeo = new THREE.BoxGeometry(innerW, bottomPanelH, thick);
            var bpMats = [
                bgMat.clone(), bgMat.clone(),
                bgMat.clone(), bgMat.clone(),
                makeTexMat(textures[3], false),  // +Z front face
                bgMat.clone()
            ];
            var bottomPanel = new THREE.Mesh(bpGeo, bpMats);
            bottomPanel.position.set(0, thick + bottomPanelH / 2, d / 2 - thick / 2);
            wallGroup.add(bottomPanel);
        }

        // 전체 그룹을 바닥에 맞춤 (Y=0이 바닥)
        wallGroup.position.set(0, 0, 0);
        scene.add(wallGroup);

        // Camera positioning
        var maxDim = Math.max(w, h, d);
        spherical.radius = maxDim * 2.5;
        spherical.theta = Math.PI / 5;
        spherical.phi = Math.PI / 3;
        target.x = 0;
        target.y = h / 2;
        target.z = 0;
        updateCamera();

        // Dimension label
        var label = document.getElementById('wall3dDimLabel');
        if (label) label.textContent = pd.widthMM + 'mm \u00D7 ' + pd.heightMM + 'mm \u00D7 ' + pd.depthMM + 'mm';
    }

    // ─── Public API ───
    window.open3DPreview = async function () {
        const modal = document.getElementById('wall3DModal');
        if (!modal) return;
        modal.style.display = 'flex';

        // Load Three.js on demand
        if (!threeLoaded) {
            try { await loadThreeJS(); }
            catch (e) { console.error(e); showToast('3D library load failed', "error"); return; }
        }

        const container = document.getElementById('threeDContainer');
        if (!container) return;

        initScene(container);

        // 종이매대 모드
        if (window.__pdMode && window.__paperDisplayData) {
            const pd = window.__paperDisplayData;
            const faceTextures = await capturePaperDisplayFaces();
            buildPaperDisplay(pd, faceTextures);
        }
        // 박스 모드
        else if (window.__boxDims && window.__boxMode) {
            const { w, h, d } = window.__boxDims;
            const faceTextures = await captureAllBoxFaces();
            buildBox(w, h, d, faceTextures);
        } else {
            const fabricCanvas = window.canvas;
            if (!fabricCanvas) return;

            const board = fabricCanvas.getObjects().find(o => o.isBoard);
            if (!board) return;

            const PX_PER_MM = 3.7795;
            const widthMM = Math.round(board.width / PX_PER_MM);
            const heightMM = Math.round(board.height / PX_PER_MM);

            // 가벽 멀티월 모드: 벽별 개별 텍스처 캡처 → wall-3d-walls.js가 벽 생성
            if (window.__wallMode) {
                const textures = await capturePerWallTextures();
                window.__wallTextures = textures;
                // buildWall 호출 안 함 — initWallsFromConfig가 멀티월 생성
                if (window.initWallsFromConfig) {
                    window.initWallsFromConfig();
                }
            } else {
                const dataUrl = captureCanvas();
                buildWall(widthMM, heightMM, dataUrl, null);
            }
        }

        // 3D 사이드바 표시 (가벽 모드에서만)
        const sidebar = document.getElementById('wall3DSidebar');
        if (sidebar) {
            sidebar.style.display = (window.__wallMode && !window.__boxMode) ? 'flex' : 'none';
        }

        // 힌트 텍스트 업데이트
        const hint = document.getElementById('wall3dHint');
        if (hint && window.__wallMode && !window.__boxMode) {
            const t = window.t || ((k, d) => d);
            hint.textContent = t('hint_3d_wall_controls', '\uD83D\uDDB1 \uD074\uB9AD+\uB4DC\uB798\uADF8: \uBCBD \uC774\uB3D9 | \uBE48 \uACF3 \uB4DC\uB798\uADF8: \uD68C\uC804 | Space+\uB4DC\uB798\uADF8: \uD654\uBA74 \uC774\uB3D9');
        }

        startAnimate();
    };

    window.refresh3DTexture = async function () {
        if (!isInitialized) return;

        // 종이매대 모드: 3면 재캡처
        if (window.__pdMode && window.__paperDisplayData) {
            const pd = window.__paperDisplayData;
            const faceTextures = await capturePaperDisplayFaces();
            buildPaperDisplay(pd, faceTextures);
            return;
        }

        // 박스 모드: 전체 6면 재캡처
        if (window.__boxDims && window.__boxMode) {
            const { w, h, d } = window.__boxDims;
            const faceTextures = await captureAllBoxFaces();
            buildBox(w, h, d, faceTextures);
            return;
        }

        // 벽 모드: 벽별 텍스처 재캡처 → 멀티월 재생성
        if (window.__wallMode) {
            const textures = await capturePerWallTextures();
            window.__wallTextures = textures;
            if (window.initWallsFromConfig) {
                window.initWallsFromConfig();
            }
            return;
        }

        // 단면 벽: 앞면만 갱신
        const dataUrl = captureCanvas();
        if (!dataUrl) return;

        const panel = wallGroup.getObjectByName('mainPanel');
        if (panel) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () {
                if (frontTexture) frontTexture.dispose();
                frontTexture = new THREE.Texture(img);
                frontTexture.needsUpdate = true;
                frontTexture.encoding = THREE.sRGBEncoding;
                panel.material[4] = new THREE.MeshStandardMaterial({ map: frontTexture, roughness: 0.4 });
            };
            img.src = dataUrl;
        }
    };

    // Listen for wall size changes
    window.addEventListener('wallSizeChanged', function (e) {
        const modal = document.getElementById('wall3DModal');
        if (!modal || modal.style.display === 'none' || !isInitialized) return;
        if (e.detail.mode === 'wall') window.open3DPreview();
    });

    // ─── Screenshot download ───
    window.capture3DScreenshot = function () {
        if (!renderer || !scene || !camera) return;
        renderer.render(scene, camera);
        try {
            const dataUrl = renderer.domElement.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = 'wall-3d-preview.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            console.error('3D screenshot failed:', e);
            if (window.showToast) window.showToast('Screenshot failed', 'error');
        }
    };

    // ─── Phase 3: 공유 상태 노출 ───
    // wall-3d-walls.js 등 외부 모듈이 scene, camera 등에 접근
    window.__wall3D = {
        get scene() { return scene; },
        get camera() { return camera; },
        get renderer() { return renderer; },
        get wallGroup() { return wallGroup; },
        get spherical() { return spherical; },
        get target() { return target; },
        updateCamera: function () { updateCamera(); },
        buildWall: function (w, h, f, b) { buildWall(w, h, f, b); },
        captureAllWallFaces: captureAllWallFaces,
        captureCanvas: captureCanvas,
        addBox: function (w, h, d, x, y, z, mat) { addBox(w, h, d, x, y, z, mat); }
    };

})();
