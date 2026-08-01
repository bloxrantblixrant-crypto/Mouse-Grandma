// --- GAME STATE ---
let cheese = 0, hp = 3;
let isCaught = false, hasSword = false;
let gameStarted = false;
let isJumping = false, jumpVelocity = 0, gravity = -0.012;
let cheeseItems = [], colliders = [], ladders = [];
let grandmaAlive = true, catAlive = true;
let isOnSecondFloor = false;

// Audio Setup
let audioCtx = null;
function playSound(freq, duration, type = 'sawtooth') {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
}

// --- THREE.JS SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x161625);
scene.fog = new THREE.FogExp2(0x161625, 0.003);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Landscape / Window Resize Adaptation
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Enhanced Lighting & Atmosphere
scene.add(new THREE.AmbientLight(0xffeedd, 0.7));
const dirLight = new THREE.DirectionalLight(0xfffaf0, 1.4);
dirLight.position.set(50, 90, 50);
dirLight.castShadow = true;
scene.add(dirLight);

// --- OUTDOOR LANDSCAPE & ENVIRONMENT ---
const landscapeGround = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x2e461e, roughness: 0.85, metalness: 0.1 })
);
landscapeGround.rotation.x = -Math.PI / 2;
landscapeGround.position.y = -0.52;
landscapeGround.receiveShadow = true;
scene.add(landscapeGround);

function createFence(x, y, z, w, d, rotY = 0) {
    const fenceGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x734a27, roughness: 0.8 });
    for(let i = -w/2; i <= w/2; i += 4) {
        let post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 0.4), woodMat);
        post.position.x = i; post.castShadow = true;
        fenceGroup.add(post);
    }
    let rail1 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 0.2), woodMat); rail1.position.y = 1.0;
    let rail2 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 0.2), woodMat); rail2.position.y = 2.0;
    fenceGroup.add(rail1, rail2);
    
    fenceGroup.position.set(x, y, z);
    fenceGroup.rotation.y = rotY;
    scene.add(fenceGroup);
    colliders.push(new THREE.Box3().setFromObject(fenceGroup));
}

createFence(0, 0, -120, 240, 1, 0);
createFence(0, 0, 120, 240, 1, 0);
createFence(-120, 0, 0, 240, 1, Math.PI/2);
createFence(120, 0, 0, 240, 1, Math.PI/2);

function createTree(x, z) {
    const treeGroup = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0x4d311b }));
    trunk.position.y = 4; trunk.castShadow = true;
    const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(5.5), new THREE.MeshStandardMaterial({ color: 0x224d2d, roughness: 0.9 }));
    leaves.position.y = 9; leaves.castShadow = true;
    treeGroup.add(trunk, leaves);
    treeGroup.position.set(x, 0, z);
    scene.add(treeGroup);
    colliders.push(new THREE.Box3().setFromObject(leaves));
}

createTree(-60, -60);
createTree(70, -50);
createTree(-80, 50);
createTree(60, 70);

// --- BUILDERS & PROP CREATION ---
function createWall(x, y, z, w, h, d, color = 0xe2dbcd, hasCollision = true) {
    const wall = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness: 0.75 })
    );
    wall.position.set(x, y, z);
    wall.castShadow = true; wall.receiveShadow = true;
    scene.add(wall);
    if (hasCollision) colliders.push(new THREE.Box3().setFromObject(wall));
    return wall;
}

function createWindow(x, y, z, rotY = 0) {
    const winGroup = new THREE.Group();
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x99ddff, transparent: true, opacity: 0.35, roughness: 0.05, transmission: 0.9 });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 0.2), glassMat);
    winGroup.add(glass);
    winGroup.position.set(x, y, z);
    winGroup.rotation.y = rotY;
    scene.add(winGroup);
}

function createDoor(x, y, z, rotY = 0) {
    const door = new THREE.Mesh(
        new THREE.BoxGeometry(3, 6, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.5 })
    );
    door.position.set(x, y, z);
    door.rotation.y = rotY;
    scene.add(door);
    colliders.push(new THREE.Box3().setFromObject(door));
}

function createTable(x, y, z) {
    const tableGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.6 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 4), woodMat);
    top.position.y = 2.2; top.castShadow = true;
    tableGroup.add(top);
    const legGeo = new THREE.BoxGeometry(0.4, 2.2, 0.4);
    for(let dx of [2.6, -2.6]) {
        for(let dz of [1.6, -1.6]) {
            let leg = new THREE.Mesh(legGeo, woodMat);
            leg.position.set(dx, 1.1, dz); leg.castShadow = true;
            tableGroup.add(leg);
        }
    }
    tableGroup.position.set(x, y, z);
    scene.add(tableGroup);
    colliders.push(new THREE.Box3().setFromObject(tableGroup));
}

function createBookshelf(x, y, z, rotY = 0) {
    const shelf = new THREE.Mesh(
        new THREE.BoxGeometry(3, 6, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x381f0a, roughness: 0.7 })
    );
    shelf.position.set(x, y + 3, z);
    shelf.rotation.y = rotY;
    shelf.castShadow = true;
    scene.add(shelf);
    colliders.push(new THREE.Box3().setFromObject(shelf));
}

function createLadder(x, y, z, height) {
    const ladderGroup = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.5 });
    const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, height), mat); pole1.position.x = -0.5;
    const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, height), mat); pole2.position.x = 0.5;
    ladderGroup.add(pole1, pole2);

    for(let i = 0; i < Math.floor(height / 0.8); i++) {
        const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0), mat);
        rung.rotation.z = Math.PI / 2;
        rung.position.y = -height/2 + (i * 0.8) + 0.4;
        ladderGroup.add(rung);
    }
    ladderGroup.position.set(x, y + height/2, z);
    scene.add(ladderGroup);
    
    let box = new THREE.Box3().setFromObject(ladderGroup);
    box.expandByScalar(0.4);
    ladders.push({ box: box, topY: y + height });
}

// --- HOUSE INTERIOR ARCHITECTURE ---
const groundFloor = new THREE.Mesh(new THREE.BoxGeometry(70, 1, 70), new THREE.MeshStandardMaterial({ color: 0x362111, roughness: 0.9 }));
groundFloor.position.set(0, -0.5, 0);
groundFloor.receiveShadow = true;
scene.add(groundFloor);

const floorMat = new THREE.MeshStandardMaterial({ color: 0x2b180d, roughness: 0.85 });
const floorLeft = new THREE.Mesh(new THREE.BoxGeometry(32, 1, 68), floorMat); floorLeft.position.set(-19, 12, 0); scene.add(floorLeft); colliders.push(new THREE.Box3().setFromObject(floorLeft));
const floorRight = new THREE.Mesh(new THREE.BoxGeometry(32, 1, 68), floorMat); floorRight.position.set(19, 12, 0); scene.add(floorRight); colliders.push(new THREE.Box3().setFromObject(floorRight));
const floorBack = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 30), floorMat); floorBack.position.set(0, 12, -19); scene.add(floorBack); colliders.push(new THREE.Box3().setFromObject(floorBack));

createWall(0, 12, -35, 70, 24, 2);
createWall(-35, 12, 0, 2, 24, 70);
createWall(35, 12, 0, 2, 24, 70);
createWall(0, 12, 35, 70, 24, 2);

createWindow(-15, 6, -35, 0);
createWindow(15, 6, -35, 0);
createWindow(-35, 6, 0, Math.PI / 2);
createWindow(35, 6, 0, Math.PI / 2);
createDoor(0, 3, 35, 0);

createWall(-12, 6, 0, 1, 12, 25, 0xc2b59b);
createWall(12, 6, 0, 1, 12, 25, 0xc2b59b);
createWall(0, 18, 0, 1, 12, 30, 0xc2b59b);

createTable(-20, 0, -10);
createTable(20, 0, -10);
createBookshelf(-33, 0, 20, Math.PI / 2);
createBookshelf(33, 0, -20, -Math.PI / 2);
createTable(0, 12, 20);

// Ladder to 2nd Floor
createLadder(0, 0, 10, 12);

// Safe Mouse House (Safe Zone Area)
const mouseFloor = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 16), new THREE.MeshStandardMaterial({ color: 0x6e4723 }));
mouseFloor.position.set(-25, -0.5, -25);
scene.add(mouseFloor);
createWall(-25, 4, -33, 16, 8, 1, 0x1f1005);
createWall(-33, 4, -25, 1, 8, 16, 0x1f1005);
const bed = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.6, 4), new THREE.MeshStandardMaterial({ color: 0xb82e2e }));
bed.position.set(-28, 0.3, -28);
scene.add(bed);

// Sword & Chest
const chestGroup = new THREE.Group();
const chestBase = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 1.5), new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.5 }));
const chestLid = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.4, 1.6), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.2 }));
chestLid.position.y = 0.8;
chestGroup.add(chestBase, chestLid);
chestGroup.position.set(0, 12.8, -25);
scene.add(chestGroup);

const rareSwordGroup = new THREE.Group();
const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 0.25), new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00aabb, emissiveIntensity: 0.6 })); blade.position.y = 1.0;
const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8 }));
rareSwordGroup.add(blade, hilt);
rareSwordGroup.position.set(0, 13.5, -25);
scene.add(rareSwordGroup);
const swordLight = new THREE.PointLight(0x00ffff, 2.5, 8);
swordLight.position.set(0, 14, -25);
scene.add(swordLight);

// --- CHEESE ITEMS ---
const cheeseGeo = new THREE.ConeGeometry(0.35, 0.4, 5);
const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xffb700, roughness: 0.4 });

function spawnCheese(x, y, z) {
    const ch = new THREE.Mesh(cheeseGeo, cheeseMat);
    ch.rotation.x = Math.PI;
    ch.position.set(x, y + 0.3, z);
    ch.castShadow = true;
    scene.add(ch);
    cheeseItems.push(ch);
}

spawnCheese(-20, 0, -10);
spawnCheese(20, 0, 15);
spawnCheese(0, 12, -5);
spawnCheese(-50, 0, -50);
spawnCheese(60, 0, 40);

// --- PLAYER (MOUSE) ---
const mouseGroup = new THREE.Group();
const mouseBody = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), new THREE.MeshStandardMaterial({ color: 0x6e6e6e, roughness: 0.7 }));
mouseBody.scale.set(1, 0.6, 1.3);
mouseBody.castShadow = true;
mouseGroup.add(mouseBody);
const earMat = new THREE.MeshStandardMaterial({ color: 0xffaabb });
const ear1 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), earMat); ear1.position.set(0.2, 0.25, 0.08);
const ear2 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), earMat); ear2.position.set(-0.2, 0.25, 0.08);
mouseGroup.add(ear1, ear2);
scene.add(mouseGroup);
mouseGroup.position.set(-25, 0.3, -25);

// --- ENEMIES ---
const grandmaGroup = new THREE.Group();
const gBody = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1.5), new THREE.MeshStandardMaterial({ color: 0x7b22d4, roughness: 0.7 })); gBody.position.y = 2; gBody.castShadow = true;
const gHead = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffdbc4 })); gHead.position.y = 3.8; gHead.castShadow = true;
grandmaGroup.add(gBody, gHead);
scene.add(grandmaGroup);
grandmaGroup.position.set(15, 0, 10);

const catGroup = new THREE.Group();
const catBody = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 1.8), new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 })); catBody.position.y = 0.5; catBody.castShadow = true;
catGroup.add(catBody);
scene.add(catGroup);
catGroup.position.set(-15, 0, 10);

// --- STANDARD NON-INVERTED JOYSTICK CONTROLS ---
let moveVector = { x: 0, y: 0 };
const knob = document.getElementById('joystick-knob');
const zone = document.getElementById('joystick-zone');

function processJoystick(clientX, clientY) {
    let rect = zone.getBoundingClientRect();
    let centerX = rect.left + rect.width / 2;
    let centerY = rect.top + rect.height / 2;
    let x = clientX - centerX;
    let y = clientY - centerY;
    let dist = Math.min(Math.sqrt(x*x + y*y), 45);
    let angle = Math.atan2(y, x);
    
    knob.style.transform = `translate(${Math.cos(angle)*dist}px, ${Math.sin(angle)*dist}px)`;
    moveVector.x = Math.cos(angle) * (dist / 45);
    moveVector.y = Math.sin(angle) * (dist / 45);
}

zone.addEventListener('touchmove', (e) => { processJoystick(e.touches[0].clientX, e.touches[0].clientY); }, {passive: true});
zone.addEventListener('touchend', () => { knob.style.transform = `translate(0px, 0px)`; moveVector = { x: 0, y: 0 }; });

let isDraggingJoystick = false;
zone.addEventListener('mousedown', (e) => { isDraggingJoystick = true; processJoystick(e.clientX, e.clientY); });
window.addEventListener('mousemove', (e) => { if (isDraggingJoystick) processJoystick(e.clientX, e.clientY); });
window.addEventListener('mouseup', () => { if (isDraggingJoystick) { isDraggingJoystick = false; knob.style.transform = `translate(0px, 0px)`; moveVector = { x: 0, y: 0 }; } });

// HUD Action Buttons Container
const btnContainer = document.createElement('div');
btnContainer.style.cssText = "position:absolute; bottom:30px; right:30px; display:flex; flex-direction:column; gap:15px; z-index:5;";
document.body.appendChild(btnContainer);

// Fixed Jump Button (Supports touch & click seamlessly)
const jumpBtn = document.createElement('button');
jumpBtn.innerText = "🦘 JUMP";
jumpBtn.style.cssText = "width:75px; height:75px; background:linear-gradient(135deg, #2196F3, #0d47a1); color:white; border-radius:50%; font-weight:bold; border:3px solid white; font-size:13px; cursor:pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); pointer-events: auto;";
btnContainer.appendChild(jumpBtn);

function triggerJump(e) {
    if (e) e.preventDefault();
    if (!isJumping) { 
        isJumping = true; 
        jumpVelocity = 0.28; 
        playSound(400, 0.15, 'sine'); 
    }
}
jumpBtn.addEventListener('click', triggerJump);
jumpBtn.addEventListener('touchstart', triggerJump, {passive: false});

// Dynamic "GO DOWN" Button for Second Floor
const goDownBtn = document.createElement('button');
goDownBtn.innerText = "⬇️ GO DOWN";
goDownBtn.style.cssText = "position:absolute; top:30px; left:50%; transform:translateX(-50%); width:140px; height:50px; background:linear-gradient(135deg, #ff9800, #e65100); color:white; border-radius:25px; font-weight:bold; border:3px solid white; font-size:14px; cursor:pointer; display:none; z-index:10; box-shadow: 0 4px 10px rgba(0,0,0,0.3); pointer-events: auto;";
document.body.appendChild(goDownBtn);

function triggerGoDown(e) {
    if (e) e.preventDefault();
    mouseGroup.position.set(0, 0.3, 5); // Teleports player back down near the ladder base
    isOnSecondFloor = false;
    goDownBtn.style.display = 'none';
    playSound(450, 0.2, 'sine');
}
goDownBtn.addEventListener('click', triggerGoDown);
goDownBtn.addEventListener('touchstart', triggerGoDown, {passive: false});

const attackBtn = document.createElement('button');
attackBtn.innerText = "SLAY 🗡️";
attackBtn.style.cssText = "width:75px; height:75px; background:linear-gradient(135deg, #e91e63, #880e4f); color:white; border-radius:50%; font-weight:bold; border:3px solid white; display:none; font-size:13px; cursor:pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3);";
btnContainer.appendChild(attackBtn);
attackBtn.addEventListener('click', () => {
    if (!hasSword) return;
    playSound(700, 0.2, 'square');
    rareSwordGroup.rotation.x = -1.5;
    setTimeout(() => rareSwordGroup.rotation.x = 0, 200);
    if (catAlive && mouseGroup.position.distanceTo(catGroup.position) < 4.0) { catAlive = false; scene.remove(catGroup); playSound(100, 0.5, 'sawtooth'); }
    if (grandmaAlive && mouseGroup.position.distanceTo(grandmaGroup.position) < 4.5) { grandmaAlive = false; scene.remove(grandmaGroup); playSound(100, 0.5, 'sawtooth'); }
});

// --- FULLY FREE ORBIT CAMERA CONTROLS ---
let cameraAngleY = 0, cameraAngleX = 0.4;
let lastTouchX = 0, lastTouchY = 0, isRotatingCam = false;

window.addEventListener('touchstart', (e) => {
    for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].clientX > window.innerWidth / 3) {
            lastTouchX = e.touches[i].clientX;
            lastTouchY = e.touches[i].clientY;
            isRotatingCam = true;
        }
    }
});
window.addEventListener('touchmove', (e) => {
    if (!isRotatingCam) return;
    for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].clientX > window.innerWidth / 3) {
            cameraAngleY -= (e.touches[i].clientX - lastTouchX) * 0.007;
            cameraAngleX += (e.touches[i].clientY - lastTouchY) * 0.007;
            cameraAngleX = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, cameraAngleX));
            lastTouchX = e.touches[i].clientX;
            lastTouchY = e.touches[i].clientY;
        }
    }
});
window.addEventListener('touchend', () => { isRotatingCam = false; });

window.addEventListener('mousedown', (e) => {
    if (e.clientX > window.innerWidth / 3) {
        lastTouchX = e.clientX;
        lastTouchY = e.clientY;
        isRotatingCam = true;
    }
});
window.addEventListener('mousemove', (e) => {
    if (!isRotatingCam) return;
    cameraAngleY -= (e.clientX - lastTouchX) * 0.007;
    cameraAngleX += (e.clientY - lastTouchY) * 0.007;
    cameraAngleX = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, cameraAngleX));
    lastTouchX = e.clientX;
    lastTouchY = e.clientY;
});
window.addEventListener('mouseup', () => { isRotatingCam = false; });

function startGame() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    document.getElementById('joystick-zone').style.display = 'block';
    gameStarted = true;
}

function updateHealthBar() {
    let hearts = ""; for (let i = 0; i < hp; i++) hearts += "♥";
    document.getElementById('health-bar').innerText = hearts;
}

function takeDamage(enemyName) {
    let px = mouseGroup.position.x;
    let pz = mouseGroup.position.z;
    if (px >= -33 && px <= -17 && pz >= -33 && pz <= -17) {
        return; // Safe inside mouse hole!
    }

    if (isCaught) return;
    hp--; updateHealthBar(); playSound(150, 0.3, 'sawtooth');
    if (hp <= 0) {
        isCaught = true;
        isOnSecondFloor = false;
        goDownBtn.style.display = 'none';
        document.getElementById('death-reason').innerText = enemyName + " caught you! YOU DIED!\nRespawning in Safe House...";
        document.getElementById('game-over').style.display = 'flex';
        setTimeout(() => {
            hp = 3; updateHealthBar(); mouseGroup.position.set(-25, 0.3, -25);
            document.getElementById('game-over').style.display = 'none'; isCaught = false;
        }, 3000);
    }
}

// --- ENGINE LOOP ---
function animate() {
    requestAnimationFrame(animate);

    if (gameStarted && !isCaught) {
        let moveX = -moveVector.x * Math.cos(cameraAngleY) - moveVector.y * Math.sin(cameraAngleY);
        let moveZ = moveVector.x * Math.sin(cameraAngleY) - moveVector.y * Math.cos(cameraAngleY);

        let nextX = mouseGroup.position.x + moveX * 0.3;
        let nextZ = mouseGroup.position.z + moveZ * 0.3;

        mouseGroup.position.y += jumpVelocity;
        jumpVelocity += gravity;

        let targetGroundY = 0.3;
        if (mouseGroup.position.y >= 11.5 && Math.abs(mouseGroup.position.x) < 32 && Math.abs(mouseGroup.position.z) < 32) {
            targetGroundY = 12.3;
        }

        // Automatic Ladder Touch Teleportation to Second Floor
        for (let l of ladders) {
            if (!isOnSecondFloor && l.box.containsPoint(mouseGroup.position)) {
                mouseGroup.position.y = l.topY + 0.3; // Teleports straight up to the 2nd floor platform
                jumpVelocity = 0;
                isJumping = false;
                isOnSecondFloor = true;
                goDownBtn.style.display = 'block'; // Show "GO DOWN" button
                playSound(600, 0.15, 'sine');
                break;
            }
        }

        if (mouseGroup.position.y <= targetGroundY) {
            mouseGroup.position.y = targetGroundY;
            jumpVelocity = 0; isJumping = false;
        }

        let playerBox = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(nextX, mouseGroup.position.y, nextZ),
            new THREE.Vector3(0.5, 0.5, 0.5)
        );

        let collided = false;
        for (let box of colliders) {
            if (box.intersectsBox(playerBox)) { collided = true; break; }
        }

        if (!collided) {
            mouseGroup.position.x = nextX;
            mouseGroup.position.z = nextZ;
        }

        if (moveX !== 0 || moveZ !== 0) {
            mouseGroup.rotation.y = Math.atan2(moveX, moveZ);
        }

        if (!hasSword && mouseGroup.position.distanceTo(rareSwordGroup.position) < 2.0) {
            hasSword = true; scene.remove(swordLight);
            mouseGroup.add(rareSwordGroup);
            rareSwordGroup.position.set(0.3, 0.2, 0.2); rareSwordGroup.rotation.set(0, 0, 0);
            attackBtn.style.display = 'block'; playSound(800, 0.5, 'sine');
        }

        cheeseItems.forEach((ch) => {
            if (ch.visible && mouseGroup.position.distanceTo(ch.position) < 1.5) {
                ch.visible = false; cheese += 25;
                document.getElementById('cheese-count').innerText = cheese;
                playSound(600, 0.1, 'sine');
            }
        });

        if (grandmaAlive) {
            let gDist = grandmaGroup.position.distanceTo(mouseGroup.position);
            if (gDist < 30 && Math.abs(grandmaGroup.position.y - mouseGroup.position.y) < 3) {
                grandmaGroup.lookAt(mouseGroup.position.x, grandmaGroup.position.y, mouseGroup.position.z);
                grandmaGroup.translateZ(0.055);
            }
            if (gDist < 2.0 && Math.abs(grandmaGroup.position.y - mouseGroup.position.y) < 2) takeDamage('Grandma');
        }

        if (catAlive) {
            let cDist = catGroup.position.distanceTo(mouseGroup.position);
            if (cDist < 30 && Math.abs(catGroup.position.y - mouseGroup.position.y) < 3) {
                catGroup.lookAt(mouseGroup.position.x, mouseGroup.position.y, mouseGroup.position.z);
                catGroup.translateZ(0.085);
            }
            if (cDist < 1.6 && Math.abs(catGroup.position.y - mouseGroup.position.y) < 2) takeDamage('The Cat');
        }
    }

    let camDist = 7.5;
    camera.position.x = mouseGroup.position.x - Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * camDist;
    camera.position.z = mouseGroup.position.z - Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * camDist;
    camera.position.y = mouseGroup.position.y + Math.sin(cameraAngleX) * camDist + 1.5;
    camera.lookAt(mouseGroup.position.x, mouseGroup.position.y + 0.5, mouseGroup.position.z);

    renderer.render(scene, camera);
}

animate();
