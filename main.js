// ============================================
// Hand-Tracked 3D Particle System
// Pick up and interact with 3D objects using your hands!
// ============================================

// Global state
let scene, camera, renderer;
let particles = [];
let handTracking = { left: null, right: null };
let grabbedObjects = { left: null, right: null };

// Configuration
const CONFIG = {
    particleCount: 3,
    particleMinSize: 0.25,
    particleMaxSize: 0.4,
    grabDistance: 0.6,          // Increased for easier grabbing
    smoothing: 0.25,            // Faster response
    gravity: 0,
    friction: 0.98,
    bounceEnergy: 0.6,
    pinchThreshold: 0.1,        // Distance threshold for pinch detection
    colors: [
        0xa78bfa, // Purple
        0x60a5fa, // Blue
        0x34d399, // Green
        0xfbbf24, // Yellow
        0xf87171, // Red
        0xf472b6, // Pink
        0x38bdf8, // Cyan
    ]
};

// ============================================
// THREE.JS SETUP
// ============================================

function initThreeJS() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 3;

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('canvas3d'),
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0xa78bfa, 1, 10);
    pointLight1.position.set(2, 2, 2);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x60a5fa, 1, 10);
    pointLight2.position.set(-2, -2, 2);
    scene.add(pointLight2);

    // Create particles
    createParticles();

    // Create hand cursors
    createHandCursors();

    // Resize handler
    window.addEventListener('resize', onWindowResize);
}

function createParticles() {
    const geometries = [
        new THREE.SphereGeometry(1, 32, 32),
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.OctahedronGeometry(1),
        new THREE.IcosahedronGeometry(1),
        new THREE.TorusGeometry(0.7, 0.3, 16, 32),
    ];

    for (let i = 0; i < CONFIG.particleCount; i++) {
        const geometry = geometries[Math.floor(Math.random() * geometries.length)];
        const color = CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];
        const size = CONFIG.particleMinSize + Math.random() * (CONFIG.particleMaxSize - CONFIG.particleMinSize);

        const material = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.1,
            shininess: 100,
            transparent: false,
            opacity: 1.0
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.scale.setScalar(size);

        // Random position (centered)
        mesh.position.x = (Math.random() - 0.5) * 2;
        mesh.position.y = (Math.random() - 0.5) * 1;
        mesh.position.z = (Math.random() - 0.5) * 1;

        // Physics properties
        mesh.userData = {
            velocity: new THREE.Vector3(0, 0, 0),
            rotationSpeed: new THREE.Vector3(
                (Math.random() - 0.5) * 0.02,
                (Math.random() - 0.5) * 0.02,
                (Math.random() - 0.5) * 0.02
            ),
            originalColor: color,
            isGrabbed: false,
            size: size
        };

        scene.add(mesh);
        particles.push(mesh);
    }
}

// Hand cursor visualization
let handCursors = { left: null, right: null };

function createHandCursors() {
    ['left', 'right'].forEach(hand => {
        const group = new THREE.Group();

        // Palm sphere
        const palmGeo = new THREE.SphereGeometry(0.06, 16, 16);
        const palmMat = new THREE.MeshPhongMaterial({
            color: hand === 'left' ? 0xa78bfa : 0x60a5fa,
            emissive: hand === 'left' ? 0xa78bfa : 0x60a5fa,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8
        });
        const palm = new THREE.Mesh(palmGeo, palmMat);
        group.add(palm);

        // Finger tips (thumb and index for pinch indicator)
        const fingerGeo = new THREE.SphereGeometry(0.025, 12, 12);

        const thumbMat = new THREE.MeshPhongMaterial({
            color: 0xfbbf24,
            emissive: 0xfbbf24,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.9
        });
        const thumb = new THREE.Mesh(fingerGeo, thumbMat);
        thumb.name = 'thumb';
        group.add(thumb);

        const indexMat = new THREE.MeshPhongMaterial({
            color: 0x34d399,
            emissive: 0x34d399,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.9
        });
        const index = new THREE.Mesh(fingerGeo, indexMat);
        index.name = 'index';
        group.add(index);

        // Pinch line
        const lineGeo = new THREE.BufferGeometry();
        const lineMat = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5
        });
        const line = new THREE.Line(lineGeo, lineMat);
        line.name = 'pinchLine';
        group.add(line);

        group.visible = false;
        scene.add(group);
        handCursors[hand] = group;
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================
// MEDIAPIPE HAND TRACKING
// ============================================

async function initHandTracking() {
    const video = document.getElementById('webcam');
    const statusEl = document.getElementById('status');
    const statusText = document.getElementById('status-text');
    const statusIcon = document.getElementById('status-icon');

    try {
        // Get camera stream
        statusText.textContent = 'Requesting camera access...';
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: 1280,
                height: 720,
                facingMode: 'user'
            }
        });
        video.srcObject = stream;

        statusIcon.textContent = '🤖';
        statusText.textContent = 'Loading hand tracking model...';

        // Initialize MediaPipe Hands
        const hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5
        });

        hands.onResults(onHandResults);

        // Start camera
        const cam = new Camera(video, {
            onFrame: async () => {
                await hands.send({ image: video });
            },
            width: 1280,
            height: 720
        });

        await cam.start();

        statusIcon.textContent = '✨';
        statusText.textContent = 'Ready! Show your hands to interact';

        setTimeout(() => {
            statusEl.classList.add('hidden');
        }, 2000);

    } catch (error) {
        console.error('Error initializing hand tracking:', error);
        statusIcon.textContent = '❌';
        statusText.textContent = 'Camera access denied or not available';
    }
}

function onHandResults(results) {
    const leftIndicator = document.getElementById('left-hand');
    const rightIndicator = document.getElementById('right-hand');

    // Reset tracking
    handTracking.left = null;
    handTracking.right = null;
    leftIndicator.classList.remove('active', 'grabbing');
    rightIndicator.classList.remove('active', 'grabbing');
    handCursors.left.visible = false;
    handCursors.right.visible = false;

    if (results.multiHandLandmarks && results.multiHandedness) {
        results.multiHandLandmarks.forEach((landmarks, index) => {
            const handedness = results.multiHandedness[index];
            // Mirror the hand label since video is mirrored
            const hand = handedness.label === 'Left' ? 'right' : 'left';

            // Get key landmarks
            const wrist = landmarks[0];
            const thumbTip = landmarks[4];
            const indexTip = landmarks[8];
            const middleTip = landmarks[12];

            // Calculate palm center
            const palmX = (wrist.x + thumbTip.x + indexTip.x + middleTip.x) / 4;
            const palmY = (wrist.y + thumbTip.y + indexTip.y + middleTip.y) / 4;
            const palmZ = (wrist.z + thumbTip.z + indexTip.z + middleTip.z) / 4;

            // Detect pinch (thumb and index finger close together)
            const pinchDistance = Math.sqrt(
                Math.pow(thumbTip.x - indexTip.x, 2) +
                Math.pow(thumbTip.y - indexTip.y, 2) +
                Math.pow(thumbTip.z - indexTip.z, 2)
            );
            const isPinching = pinchDistance < CONFIG.pinchThreshold;

            // Store tracking data
            handTracking[hand] = {
                palm: { x: palmX, y: palmY, z: palmZ },
                thumb: thumbTip,
                index: indexTip,
                pinchDistance,
                isPinching,
                // Pinch point (midpoint between thumb and index)
                pinchPoint: {
                    x: (thumbTip.x + indexTip.x) / 2,
                    y: (thumbTip.y + indexTip.y) / 2,
                    z: (thumbTip.z + indexTip.z) / 2
                }
            };

            // Update UI indicators
            const indicator = hand === 'left' ? leftIndicator : rightIndicator;
            indicator.classList.add('active');
            if (isPinching) {
                indicator.classList.add('grabbing');
            }
        });
    }
}

// ============================================
// INTERACTION & PHYSICS
// ============================================

function updateHandCursors() {
    ['left', 'right'].forEach(hand => {
        const tracking = handTracking[hand];
        const cursor = handCursors[hand];

        if (tracking) {
            cursor.visible = true;

            // Convert normalized coordinates to 3D space
            const x = (tracking.palm.x - 0.5) * -4; // Mirror X
            const y = (tracking.palm.y - 0.5) * -3;
            const z = tracking.palm.z * -2 + 1;

            cursor.position.set(x, y, z);

            // Update thumb position
            const thumb = cursor.getObjectByName('thumb');
            if (thumb && tracking.thumb) {
                thumb.position.set(
                    (tracking.thumb.x - tracking.palm.x) * -4,
                    (tracking.thumb.y - tracking.palm.y) * -3,
                    (tracking.thumb.z - tracking.palm.z) * -2
                );
            }

            // Update index finger position
            const index = cursor.getObjectByName('index');
            if (index && tracking.index) {
                index.position.set(
                    (tracking.index.x - tracking.palm.x) * -4,
                    (tracking.index.y - tracking.palm.y) * -3,
                    (tracking.index.z - tracking.palm.z) * -2
                );
            }

            // Update pinch line
            const line = cursor.getObjectByName('pinchLine');
            if (line && thumb && index) {
                const positions = new Float32Array([
                    thumb.position.x, thumb.position.y, thumb.position.z,
                    index.position.x, index.position.y, index.position.z
                ]);
                line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                line.material.opacity = tracking.isPinching ? 1.0 : 0.3;
            }

            // Change cursor color when pinching
            const palm = cursor.children[0];
            if (palm) {
                palm.material.emissiveIntensity = tracking.isPinching ? 1.0 : 0.5;
                palm.scale.setScalar(tracking.isPinching ? 1.3 : 1.0);
            }
        } else {
            cursor.visible = false;
        }
    });
}

function handleGrabbing() {
    ['left', 'right'].forEach(hand => {
        const tracking = handTracking[hand];

        if (!tracking) {
            // Hand not visible - release any grabbed object
            if (grabbedObjects[hand]) {
                releaseObject(hand);
            }
            return;
        }

        // Get pinch point in 3D space (use palm center for more stable grabbing)
        const pinchX = (tracking.palm.x - 0.5) * -5;   // Wider range
        const pinchY = (tracking.palm.y - 0.5) * -4;   // Wider range  
        const pinchZ = 0;                               // Keep Z flat for easier interaction
        const pinchPos = new THREE.Vector3(pinchX, pinchY, pinchZ);

        if (tracking.isPinching) {
            if (!grabbedObjects[hand]) {
                // Try to grab an object
                let closestParticle = null;
                let closestDistance = CONFIG.grabDistance;

                particles.forEach(particle => {
                    if (particle.userData.isGrabbed) return;

                    const distance = particle.position.distanceTo(pinchPos);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestParticle = particle;
                    }
                });

                if (closestParticle) {
                    grabObject(hand, closestParticle);
                }
            }

            // Move grabbed object
            if (grabbedObjects[hand]) {
                const obj = grabbedObjects[hand];
                // Smooth movement
                obj.position.lerp(pinchPos, CONFIG.smoothing);
                // Store velocity for throwing
                obj.userData.velocity.copy(pinchPos).sub(obj.position).multiplyScalar(0.5);
            }
        } else {
            // Not pinching - release
            if (grabbedObjects[hand]) {
                releaseObject(hand);
            }
        }
    });
}

function grabObject(hand, particle) {
    particle.userData.isGrabbed = true;
    grabbedObjects[hand] = particle;

    // Visual feedback
    particle.material.emissiveIntensity = 0.8;
    particle.scale.setScalar(particle.userData.size * 1.2);
}

function releaseObject(hand) {
    const particle = grabbedObjects[hand];
    if (particle) {
        particle.userData.isGrabbed = false;
        particle.material.emissiveIntensity = 0.2;
        particle.scale.setScalar(particle.userData.size);
    }
    grabbedObjects[hand] = null;
}

function updateParticlePhysics() {
    particles.forEach(particle => {
        if (particle.userData.isGrabbed) {
            // Rotate while grabbed
            particle.rotation.x += 0.05;
            particle.rotation.y += 0.05;
            return;
        }

        // Apply gravity
        particle.userData.velocity.y -= CONFIG.gravity;

        // Apply friction
        particle.userData.velocity.multiplyScalar(CONFIG.friction);

        // Update position
        particle.position.add(particle.userData.velocity);

        // Rotation
        particle.rotation.x += particle.userData.rotationSpeed.x;
        particle.rotation.y += particle.userData.rotationSpeed.y;
        particle.rotation.z += particle.userData.rotationSpeed.z;

        // Boundary collision
        const bounds = { x: 2.5, y: 2, z: 1.5 };

        ['x', 'y', 'z'].forEach(axis => {
            if (particle.position[axis] > bounds[axis]) {
                particle.position[axis] = bounds[axis];
                particle.userData.velocity[axis] *= -CONFIG.bounceEnergy;
            }
            if (particle.position[axis] < -bounds[axis]) {
                particle.position[axis] = -bounds[axis];
                particle.userData.velocity[axis] *= -CONFIG.bounceEnergy;
            }
        });

        // Highlight particles near hands
        let nearHand = false;
        ['left', 'right'].forEach(hand => {
            if (handTracking[hand] && !particle.userData.isGrabbed) {
                const pinchX = (handTracking[hand].palm.x - 0.5) * -5;
                const pinchY = (handTracking[hand].palm.y - 0.5) * -4;
                const pinchZ = 0;
                const pinchPos = new THREE.Vector3(pinchX, pinchY, pinchZ);

                if (particle.position.distanceTo(pinchPos) < CONFIG.grabDistance * 1.2) {
                    nearHand = true;
                }
            }
        });

        // Glow effect when near hand
        const targetEmissive = nearHand ? 0.5 : 0.2;
        particle.material.emissiveIntensity += (targetEmissive - particle.material.emissiveIntensity) * 0.1;
    });
}

// ============================================
// ANIMATION LOOP
// ============================================

function animate() {
    requestAnimationFrame(animate);

    updateHandCursors();
    handleGrabbing();
    updateParticlePhysics();

    renderer.render(scene, camera);
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    initHandTracking();
    animate();
});
