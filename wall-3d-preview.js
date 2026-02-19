// wall-3d-preview.js — 허니콤보드 가벽 3D 미리보기
(function () {
    'use strict';

    let scene, camera, renderer, wallGroup;
    let isInitialized = false;
    let threeLoaded = false;
    let animFrameId = null;
    let frontTexture = null;
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

    function setupControls(domElement) {
        domElement.addEventListener('mousedown', (e) => {
            if (e.button === 0) { isDragging = true; isPanning = false; }
            if (e.button === 2) { isPanning = true; isDragging = false; }
            prevX = e.clientX; prevY = e.clientY;
        });
        domElement.addEventListener('mousemove', (e) => {
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

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
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

    // ─── Build Wall ───
    function buildWall(widthMM, heightMM, canvasDataUrl) {
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
        const depth = 0.1;

        currentWidthMM = widthMM;
        currentHeightMM = heightMM;

        // ── 1. Main Panel ──
        const panelGeo = new THREE.BoxGeometry(width, height, depth);

        if (frontTexture) frontTexture.dispose();
        frontTexture = null;

        const sideMat = new THREE.MeshStandardMaterial({ color: COL_SIDE, roughness: 0.5 });
        const backMat = new THREE.MeshStandardMaterial({ color: COL_BACK, roughness: 0.6 });

        let frontMat;
        if (canvasDataUrl) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () {
                frontTexture = new THREE.Texture(img);
                frontTexture.needsUpdate = true;
                frontTexture.encoding = THREE.sRGBEncoding;
                panel.material[4] = new THREE.MeshStandardMaterial({ map: frontTexture, roughness: 0.4 });
            };
            img.src = canvasDataUrl;
            frontMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
        } else {
            frontMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
        }

        // BoxGeometry faces: +X, -X, +Y, -Y, +Z(front), -Z(back)
        const materials = [sideMat, sideMat, sideMat, sideMat, frontMat, backMat];
        const panel = new THREE.Mesh(panelGeo, materials);
        panel.castShadow = true;
        panel.receiveShadow = true;
        panel.name = 'mainPanel';
        wallGroup.add(panel);

        // ── 2. Back Structural Frame ──
        const frameMat = new THREE.MeshStandardMaterial({ color: COL_FRAME, roughness: 0.6 });
        const bracketMat = new THREE.MeshStandardMaterial({ color: COL_BRACKET, roughness: 0.5 });

        const frameZ = -depth / 2 - 0.015;
        const railThick = 0.05;
        const railDepth = 0.025;

        // Frame rails
        addBox(width - 0.02, railThick, railDepth, 0, height / 2 - railThick / 2, frameZ, frameMat);
        addBox(width - 0.02, railThick, railDepth, 0, -height / 2 + railThick / 2, frameZ, frameMat);
        addBox(railThick, height, railDepth, -width / 2 + railThick / 2, 0, frameZ, frameMat);
        addBox(railThick, height, railDepth, width / 2 - railThick / 2, 0, frameZ, frameMat);
        addBox(width - 0.02, 0.04, railDepth, 0, 0, frameZ, frameMat);

        // Vertical dividers (every 1m)
        const numSections = Math.max(1, Math.round(widthMM / 1000));
        for (let i = 1; i < numSections; i++) {
            const x = -width / 2 + (i * width / numSections);
            addBox(0.04, height - 0.1, railDepth, x, 0, frameZ, frameMat);
            addBox(0.06, 0.06, 0.02, x, height / 2 - 0.05, frameZ - 0.01, bracketMat);
            addBox(0.06, 0.06, 0.02, x, 0, frameZ - 0.01, bracketMat);
            addBox(0.06, 0.06, 0.02, x, -height / 2 + 0.05, frameZ - 0.01, bracketMat);
        }

        // Corner brackets
        [[-width / 2 + 0.04, height / 2 - 0.04], [width / 2 - 0.04, height / 2 - 0.04],
         [-width / 2 + 0.04, -height / 2 + 0.04], [width / 2 - 0.04, -height / 2 + 0.04]
        ].forEach(([cx, cy]) => addBox(0.06, 0.06, 0.02, cx, cy, frameZ - 0.01, bracketMat));

        // ── 3. Triangular Support Stands ──
        const standMat = new THREE.MeshStandardMaterial({ color: COL_STAND, roughness: 0.5 });
        const numStands = Math.max(2, numSections + 1);
        const standSpacing = width / (numStands - 1);

        for (let i = 0; i < numStands; i++) {
            const sx = -width / 2 + i * standSpacing;
            createTriangleStand(sx, -height / 2, -depth / 2, standMat);
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
        const label = document.getElementById('wall3dDimLabel');
        if (label) label.textContent = widthMM + 'mm \u00D7 ' + heightMM + 'mm \u00D7 100mm';
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
        mesh.position.set(x - standWidth / 2, bottomY, backZ);
        mesh.castShadow = true;
        wallGroup.add(mesh);

        // Connecting plate
        const plateGeo = new THREE.BoxGeometry(0.08, 0.12, 0.015);
        const plate = new THREE.Mesh(plateGeo, mat);
        plate.position.set(x, bottomY + 0.06, backZ - 0.008);
        wallGroup.add(plate);
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

    // ─── Public API ───
    window.open3DPreview = async function () {
        const modal = document.getElementById('wall3DModal');
        if (!modal) return;
        modal.style.display = 'flex';

        // Load Three.js on demand
        if (!threeLoaded) {
            try { await loadThreeJS(); }
            catch (e) { console.error(e); alert('3D library load failed'); return; }
        }

        const container = document.getElementById('threeDContainer');
        if (!container) return;

        const fabricCanvas = window.canvas;
        if (!fabricCanvas) return;

        const board = fabricCanvas.getObjects().find(o => o.isBoard);
        if (!board) return;

        const widthMM = Math.round(board.width);
        const heightMM = Math.round(board.height);
        const dataUrl = captureCanvas();

        initScene(container);
        buildWall(widthMM, heightMM, dataUrl);
        startAnimate();
    };

    window.refresh3DTexture = function () {
        if (!wallGroup || !isInitialized) return;
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

})();
