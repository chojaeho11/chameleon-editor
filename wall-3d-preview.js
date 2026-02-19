// wall-3d-preview.js — 허니콤보드 가벽 3D 미리보기
(function () {
    'use strict';

    let scene, camera, renderer, controls, wallGroup;
    let isInitialized = false;
    let animFrameId = null;
    let frontTexture = null;
    let currentWidthMM = 0, currentHeightMM = 0;

    // ─── Colors ───
    const COL_SIDE = 0xf0f0f0;
    const COL_BACK = 0xe8e8e8;
    const COL_FRAME = 0xbbbbbb;
    const COL_BRACKET = 0x999999;
    const COL_STAND = 0xd0d0d0;
    const COL_FLOOR = 0x2a2a3e;
    const COL_BG = 0x1a1a2e;

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
        container.appendChild(renderer.domElement);

        // Controls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 0.5;
        controls.maxDistance = 20;

        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 8, 5);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 30;
        dirLight.shadow.camera.left = -5;
        dirLight.shadow.camera.right = 5;
        dirLight.shadow.camera.top = 5;
        dirLight.shadow.camera.bottom = -5;
        scene.add(dirLight);

        const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
        backLight.position.set(-3, 4, -5);
        scene.add(backLight);

        // Floor
        const floorGeo = new THREE.PlaneGeometry(20, 20);
        const floorMat = new THREE.MeshStandardMaterial({ color: COL_FLOOR, roughness: 0.9 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        scene.add(floor);

        // Grid helper
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
        if (controls) controls.update();
        if (renderer && scene && camera) renderer.render(scene, camera);
    }

    function startAnimate() {
        if (!animFrameId) animate();
    }

    // ─── Build Wall ───
    function buildWall(widthMM, heightMM, canvasDataUrl) {
        // Remove old wall
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

        const width = widthMM / 1000;   // mm → m
        const height = heightMM / 1000;
        const depth = 0.1;              // 10cm

        currentWidthMM = widthMM;
        currentHeightMM = heightMM;

        // ── 1. Main Panel ──
        const panelGeo = new THREE.BoxGeometry(width, height, depth);

        // Load front texture from canvas
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
                frontTexture.colorSpace = THREE.SRGBColorSpace;
                panel.material[4] = new THREE.MeshStandardMaterial({
                    map: frontTexture, roughness: 0.4
                });
                panel.material[4].needsUpdate = true;
            };
            img.src = canvasDataUrl;
            frontMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
        } else {
            frontMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
        }

        // BoxGeometry faces order: +X, -X, +Y, -Y, +Z(front), -Z(back)
        const materials = [
            sideMat,     // +X (right)
            sideMat,     // -X (left)
            sideMat,     // +Y (top)
            sideMat,     // -Y (bottom)
            frontMat,    // +Z (front — canvas design)
            backMat      // -Z (back)
        ];
        const panel = new THREE.Mesh(panelGeo, materials);
        panel.castShadow = true;
        panel.receiveShadow = true;
        panel.name = 'mainPanel';
        wallGroup.add(panel);

        // ── 2. Back Structural Frame ──
        const frameMat = new THREE.MeshStandardMaterial({ color: COL_FRAME, roughness: 0.6 });
        const bracketMat = new THREE.MeshStandardMaterial({ color: COL_BRACKET, roughness: 0.5 });

        const frameZ = -depth / 2 - 0.015; // behind the panel
        const railThick = 0.05;
        const railDepth = 0.025;

        // Top rail
        addBox(width - 0.02, railThick, railDepth, 0, height / 2 - railThick / 2, frameZ, frameMat);
        // Bottom rail
        addBox(width - 0.02, railThick, railDepth, 0, -height / 2 + railThick / 2, frameZ, frameMat);
        // Left rail
        addBox(railThick, height, railDepth, -width / 2 + railThick / 2, 0, frameZ, frameMat);
        // Right rail
        addBox(railThick, height, railDepth, width / 2 - railThick / 2, 0, frameZ, frameMat);

        // Middle horizontal rail
        addBox(width - 0.02, 0.04, railDepth, 0, 0, frameZ, frameMat);

        // Vertical dividers (every 1m)
        const numSections = Math.round(widthMM / 1000);
        for (let i = 1; i < numSections; i++) {
            const x = -width / 2 + (i * width / numSections);
            addBox(0.04, height - 0.1, railDepth, x, 0, frameZ, frameMat);

            // Brackets at intersections (top, middle, bottom)
            addBox(0.06, 0.06, 0.02, x, height / 2 - 0.05, frameZ - 0.01, bracketMat);
            addBox(0.06, 0.06, 0.02, x, 0, frameZ - 0.01, bracketMat);
            addBox(0.06, 0.06, 0.02, x, -height / 2 + 0.05, frameZ - 0.01, bracketMat);
        }

        // Corner brackets
        const corners = [
            [-width / 2 + 0.04, height / 2 - 0.04],
            [width / 2 - 0.04, height / 2 - 0.04],
            [-width / 2 + 0.04, -height / 2 + 0.04],
            [width / 2 - 0.04, -height / 2 + 0.04]
        ];
        corners.forEach(([cx, cy]) => {
            addBox(0.06, 0.06, 0.02, cx, cy, frameZ - 0.01, bracketMat);
        });

        // ── 3. Triangular Support Stands ──
        const standMat = new THREE.MeshStandardMaterial({ color: COL_STAND, roughness: 0.5 });
        const numStands = Math.max(2, numSections + 1); // at least 2 stands
        const standSpacing = width / (numStands - 1);

        for (let i = 0; i < numStands; i++) {
            const sx = -width / 2 + i * standSpacing;
            createTriangleStand(sx, -height / 2, -depth / 2, standMat);
        }

        // Position the wall on the floor
        wallGroup.position.set(0, height / 2, 0);
        scene.add(wallGroup);

        // Update camera
        const dist = Math.max(width, height) * 1.5;
        camera.position.set(dist * 0.6, height * 0.6, dist * 0.8);
        controls.target.set(0, height / 2, 0);
        controls.update();

        // Update dimension label
        const label = document.getElementById('wall3dDimLabel');
        if (label) label.textContent = `${widthMM}mm × ${heightMM}mm × 100mm`;
    }

    // ─── Helper: Add Box ───
    function addBox(w, h, d, x, y, z, mat) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        wallGroup.add(mesh);
        return mesh;
    }

    // ─── Helper: Triangle Stand ───
    function createTriangleStand(x, bottomY, backZ, mat) {
        const standWidth = 0.04;   // 4cm wide
        const standBase = 0.35;    // 35cm deep
        const standHeight = 0.45;  // 45cm tall

        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(-standBase, 0);
        shape.lineTo(0, standHeight);
        shape.closePath();

        const extrudeSettings = {
            depth: standWidth,
            bevelEnabled: false
        };
        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const mesh = new THREE.Mesh(geo, mat);

        // Position: bottom of panel, rotated so triangle extends backward
        mesh.position.set(x - standWidth / 2, bottomY, backZ);
        mesh.castShadow = true;
        wallGroup.add(mesh);

        // Add a small connecting plate
        const plateGeo = new THREE.BoxGeometry(0.08, 0.12, 0.015);
        const plate = new THREE.Mesh(plateGeo, mat);
        plate.position.set(x, bottomY + 0.06, backZ - 0.008);
        plate.castShadow = true;
        wallGroup.add(plate);
    }

    // ─── Public API ───
    window.open3DPreview = function () {
        const modal = document.getElementById('wall3DModal');
        if (!modal) return;
        modal.style.display = 'flex';

        const container = document.getElementById('threeDContainer');
        if (!container) return;

        // Get canvas and board info
        const fabricCanvas = window.canvas;
        if (!fabricCanvas) {
            console.warn('3D Preview: Fabric canvas not found');
            return;
        }

        const board = fabricCanvas.getObjects().find(o => o.isBoard);
        if (!board) {
            console.warn('3D Preview: Board not found');
            return;
        }

        const widthMM = Math.round(board.width);
        const heightMM = Math.round(board.height);

        // Capture canvas as image
        let dataUrl = null;
        try {
            // Save current viewport, reset to capture full canvas
            const vpt = fabricCanvas.viewportTransform.slice();
            fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
            fabricCanvas.setDimensions({ width: board.width, height: board.height });
            fabricCanvas.renderAll();

            dataUrl = fabricCanvas.toDataURL({
                format: 'png',
                left: 0,
                top: 0,
                width: board.width,
                height: board.height
            });

            // Restore viewport
            fabricCanvas.viewportTransform = vpt;
            const stage = document.querySelector('.stage');
            if (stage) {
                fabricCanvas.setDimensions({ width: stage.clientWidth, height: stage.clientHeight });
            }
            fabricCanvas.renderAll();
        } catch (e) {
            console.error('3D Preview: canvas capture failed', e);
        }

        // Init scene (once)
        initScene(container);

        // Build/rebuild the wall
        buildWall(widthMM, heightMM, dataUrl);

        // Start animation
        startAnimate();
    };

    window.refresh3DTexture = function () {
        if (!wallGroup || !isInitialized) return;

        const fabricCanvas = window.canvas;
        if (!fabricCanvas) return;

        const board = fabricCanvas.getObjects().find(o => o.isBoard);
        if (!board) return;

        let dataUrl = null;
        try {
            const vpt = fabricCanvas.viewportTransform.slice();
            fabricCanvas.viewportTransform = [1, 0, 0, 1, 0, 0];
            fabricCanvas.setDimensions({ width: board.width, height: board.height });
            fabricCanvas.renderAll();

            dataUrl = fabricCanvas.toDataURL({
                format: 'png',
                left: 0, top: 0,
                width: board.width, height: board.height
            });

            fabricCanvas.viewportTransform = vpt;
            const stage = document.querySelector('.stage');
            if (stage) {
                fabricCanvas.setDimensions({ width: stage.clientWidth, height: stage.clientHeight });
            }
            fabricCanvas.renderAll();
        } catch (e) {
            console.error('3D: texture refresh failed', e);
            return;
        }

        // Update front face texture
        const panel = wallGroup.getObjectByName('mainPanel');
        if (panel && dataUrl) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () {
                if (frontTexture) frontTexture.dispose();
                frontTexture = new THREE.Texture(img);
                frontTexture.needsUpdate = true;
                frontTexture.colorSpace = THREE.SRGBColorSpace;
                panel.material[4] = new THREE.MeshStandardMaterial({
                    map: frontTexture, roughness: 0.4
                });
            };
            img.src = dataUrl;
        }
    };

    // ─── Listen for wall size changes ───
    window.addEventListener('wallSizeChanged', function (e) {
        const modal = document.getElementById('wall3DModal');
        if (!modal || modal.style.display === 'none') return;
        if (!isInitialized) return;

        const { w, h, mode } = e.detail;
        if (mode === 'wall') {
            // Re-open with new dimensions
            window.open3DPreview();
        }
    });

})();
