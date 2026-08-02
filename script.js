// --- GAME ENGINE STATE ---
let cheese = 0, hp = 3;
let isCaught = false;
let gameStarted = false;
let isJumping = false, jumpVelocity = 0, gravity = -0.012;
let cheeseItems = [], colliders = [], ladders = [], swords = [];
let grandmaAlive = true, catAlive = true;
let blueGrandmaAlive = true, grandpaAlive = true, blueCatAlive = true;
let isOnSecondFloor = false;
let currentHouse = 1; // 1 = Main House, 2 = Blue House, 3 = City
let hasSword = false;

// Sword Animation State Variables
let isSwinging = false;
let swingProgress = 0;

// Safe Spawn Coordinates inside Mouse Home (behind arch door)
const MOUSE_HOLE_SPAWN_1 = { x: -25, y: 0.3, z: -38 };
const MOUSE_HOLE_SPAWN_2 = { x: 175, y: 0.3, z: -38 };

// --- DYNAMIC QUEST TRACKER UI ---
const questUI = document.createElement('div');
questUI.id = 'quest-tracker';
questUI.style.cssText = `
    position: fixed; top: 20px; left: 15px; z-index: 99999;
    background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 14px;
    padding: 10px 16px; color: #fff; font-weight: 700; font-size: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4); pointer-events: none; max-width: 60%;
`;
document.body.appendChild(questUI);

function updateQuestDisplay() {
    if (currentHouse === 1) {
        questUI.innerHTML = `<span style="color:#ffb700;">📜 QUEST:</span> Collect 110 Cheese to unlock Blue House! <span style="color:#00ffcc;">(${cheese}/110)</span>`;
    } else if (currentHouse === 2) {
        questUI.innerHTML = `<span style="color:#00e5ff;">📜 NEW QUEST:</span> Collect 500 Cheese to Escape to the City! <span style="color:#00ffcc;">(${cheese}/500)</span>`;
    } else {
        questUI.innerHTML = `<span style="color:#00ffcc;">🏙️ CITY LEVEL:</span> FREEDOM! Explore the City!`;
    }
}
updateQuestDisplay();

// Audio System Synthesizer
let audioCtx = null;
function playSound(freq, duration, type = 'sawtooth', sweepTo = null) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        if (sweepTo !== null) {
            osc.frequency.exponentialRampToValueAtTime(sweepTo, audioCtx.currentTime + duration);
        } else {
            osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        }
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
}

// --- THREE.JS ENGINE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a12);
scene.fog = new THREE.FogExp2(0x070a12, 0.0025);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Lighting
scene.add(new THREE.AmbientLight(0xddeeff, 0.85));
const dirLight = new THREE.DirectionalLight(0xfffaed, 1.6);
dirLight.position.set(60, 100, 40);
dirLight.castShadow = true;
scene.add(dirLight);

// Outdoor Ground
const landscapeGround = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800),
    new THREE.MeshStandardMaterial({ color: 0x142410, roughness: 0.9 })
);
landscapeGround.rotation.x = -Math.PI / 2;
landscapeGround.position.y = -0.52;
scene.add(landscapeGround);

// Sword Generator
function buildSwordMesh() {
    const swordGroup = new THREE.Group();
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, metalness: 0.95, roughness: 0.05 });
    
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.04), bladeMat);
    blade.position.y = 0.9;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5), handleMat);
    handle.position.y = 0.25;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.12), handleMat);
    guard.position.y = 0.45;

    swordGroup.add(blade, handle, guard);
    return swordGroup;
}

// 🐭 ROUND MOUSE DOORWAY & SAFE HOUSE INTERIOR
function createMouseHomeDoor(offsetX, offsetZ) {
    const homeGroup = new THREE.Group();
    const archColor = 0x3a2312;
    const wallColor = 0x221308;

    const archFrame = new THREE.Group();
    const postGeo = new THREE.BoxGeometry(0.4, 2.2, 0.6);
    const frameMat = new THREE.MeshStandardMaterial({ color: archColor, roughness: 0.5 });
    
    const leftPost = new THREE.Mesh(postGeo, frameMat);
    leftPost.position.set(-1.3, 1.1, 0);
    const rightPost = new THREE.Mesh(postGeo, frameMat);
    rightPost.position.set(1.3, 1.1, 0);

    const topArch = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 1.5, 0.6, 16, 1, false, 0, Math.PI),
        frameMat
    );
    topArch.rotation.x = Math.PI / 2;
    topArch.position.set(0, 2.2, 0);

    const tunnelEntry = new THREE.Mesh(
        new THREE.CylinderGeometry(1.3, 1.3, 2.0, 16, 1, false, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 })
    );
    tunnelEntry.rotation.x = Math.PI / 2;
    tunnelEntry.position.set(0, 1.3, -1.0);

    archFrame.add(leftPost, rightPost, topArch, tunnelEntry);
    archFrame.position.set(-25 + offsetX, 0, -35 + offsetZ);
    homeGroup.add(archFrame);

    // Mouse Home Safe Room
    const roomFloor = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.8 })
    );
    roomFloor.position.set(-25 + offsetX, -0.1, -39 + offsetZ);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 0.4), new THREE.MeshStandardMaterial({ color: wallColor }));
    backWall.position.set(-25 + offsetX, 2.5, -43 + offsetZ);
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 8), new THREE.MeshStandardMaterial({ color: wallColor }));
    leftWall.position.set(-29 + offsetX, 2.5, -39 + offsetZ);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 8), new THREE.MeshStandardMaterial({ color: wallColor }));
    rightWall.position.set(-21 + offsetX, 2.5, -39 + offsetZ);

    colliders.push(
        new THREE.Box3().setFromObject(backWall),
        new THREE.Box3().setFromObject(leftWall),
        new THREE.Box3().setFromObject(rightWall)
    );

    const bed = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 3), new THREE.MeshStandardMaterial({ color: 0xcc3333 }));
    bed.position.set(-27 + offsetX, 0.25, -40 + offsetZ);

    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    pillow.position.set(-27 + offsetX, 0.5, -41 + offsetZ);

    const homeLight = new THREE.PointLight(0xffaa44, 1.5, 10);
    homeLight.position.set(-25 + offsetX, 3, -39 + offsetZ);

    homeGroup.add(roomFloor, backWall, leftWall, rightWall, bed, pillow, homeLight);
    scene.add(homeGroup);
}

// Build House Architecture (Wall Alignments Fully Sealed)
function buildHouse(offsetX, offsetZ, isBlue = false) {
    const wallColor = isBlue ? 0x1e3a5f : 0xd4c7b5;
    const floorColor = isBlue ? 0x0d1b2a : 0x24140b;
    const partitionColor = isBlue ? 0x2b4c7e : 0xb8a892;

    function createWall(x, y, z, w, h, d, color = wallColor) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
        wall.position.set(x + offsetX, y, z + offsetZ);
        scene.add(wall);
        colliders.push(new THREE.Box3().setFromObject(wall));
        return wall;
    }

    function createTable(x, y, z) {
        const tableGroup = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x422817, roughness: 0.6 });
        const top = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 4), woodMat);
        top.position.y = 2.2;
        tableGroup.add(top);
        
        const legGeo = new THREE.BoxGeometry(0.4, 2.2, 0.4);
        for(let dx of [2.6, -2.6]) {
            for(let dz of [1.6, -1.6]) {
                let leg = new THREE.Mesh(legGeo, woodMat);
                leg.position.set(dx, 1.1, dz);
                tableGroup.add(leg);
                colliders.push(new THREE.Box3().setFromObject(leg));
            }
        }
        tableGroup.position.set(x + offsetX, y, z + offsetZ);
        scene.add(tableGroup);
    }

    function createTableWithSword(x, y, z) {
        createTable(x, y, z);
        const swordProp = buildSwordMesh();
        swordProp.position.set(x + offsetX, y + 2.4, z + offsetZ);
        swordProp.rotation.z = Math.PI / 2;
        scene.add(swordProp);
        swords.push(swordProp);
    }

    function createLadder(x, y, z, height) {
        const ladderGroup = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x4d3219, roughness: 0.5 });
        ladderGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, height), mat)).position.x = -0.5;
        ladderGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, height), mat)).position.x = 0.5;

        for(let i = 0; i < Math.floor(height / 0.8); i++) {
            const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0), mat);
            rung.rotation.z = Math.PI / 2;
            rung.position.y = -height/2 + (i * 0.8) + 0.4;
            ladderGroup.add(rung);
        }
        ladderGroup.position.set(x + offsetX, y + height/2, z + offsetZ);
        scene.add(ladderGroup);
        
        let box = new THREE.Box3().setFromObject(ladderGroup);
        box.expandByScalar(1.2);
        ladders.push({ box: box, houseId: isBlue ? 2 : 1 });
    }

    // Ground & Second Floor
    const groundFloor = new THREE.Mesh(new THREE.BoxGeometry(70, 1, 70), new THREE.MeshStandardMaterial({ color: isBlue ? 0x0a1424 : 0x2e1a0e, roughness: 0.9 }));
    groundFloor.position.set(offsetX, -0.5, offsetZ);
    scene.add(groundFloor);

    const secondFloorPlatform = new THREE.Mesh(new THREE.BoxGeometry(68, 1, 68), new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.85 }));
    secondFloorPlatform.position.set(offsetX, 12, offsetZ);
    scene.add(secondFloorPlatform);
    colliders.push(new THREE.Box3().setFromObject(secondFloorPlatform));

    // Fully Sealed Exterior House Walls
    createWall(0, 12, 35, 70, 24, 2);
    createWall(-35, 12, 0, 2, 24, 70);
    createWall(35, 12, 0, 2, 24, 70);
    
    // Back Wall Exact Alignment
    createWall(5, 12, -35, 60, 24, 2);  // Right side wall
    createWall(-31, 12, -35, 8, 24, 2);  // Left side wall
    createWall(-25, 13.5, -35, 4, 21, 2); // Overhead arch connector

    createMouseHomeDoor(offsetX, offsetZ);

    createWall(-12, 6, 0, 1, 12, 25, partitionColor);
    createWall(12, 6, 0, 1, 12, 25, partitionColor);

    createTable(-20, 0, -10); createTable(20, 0, -10);
    createTableWithSword(0, 12, 20);
    createLadder(0, 0, 10, 12);
}

buildHouse(0, 0, false);
buildHouse(200, 0, true);

// 🏙️ CITY ENVIRONMENT
function buildCityEnvironment() {
    const cityGroup = new THREE.Group();
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const buildingColors = [0x2c3e50, 0x34495e, 0x1a252f, 0x7f8c8d, 0x16a085];

    const mainRoad = new THREE.Mesh(new THREE.PlaneGeometry(120, 300), roadMat);
    mainRoad.rotation.x = -Math.PI / 2;
    mainRoad.position.set(0, -0.48, -250);
    cityGroup.add(mainRoad);

    for (let i = 0; i < 20; i++) {
        let h = 40 + Math.random() * 60;
        let w = 15 + Math.random() * 10;
        let d = 15 + Math.random() * 10;
        let mat = new THREE.MeshStandardMaterial({ color: buildingColors[i % buildingColors.length], roughness: 0.4 });
        let bld = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        
        let side = (i % 2 === 0) ? -45 : 45;
        let zPos = -120 - (i * 15);
        bld.position.set(side, h / 2, zPos);
        cityGroup.add(bld);
        colliders.push(new THREE.Box3().setFromObject(bld));
    }

    for (let z = -120; z >= -350; z -= 30) {
        for (let x of [-25, 25]) {
            let pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x111111 }));
            pole.position.set(x, 4, z);
            let light = new THREE.PointLight(0xffaa00, 1.2, 18);
            light.position.set(x, 8, z);
            cityGroup.add(pole, light);
        }
    }

    scene.add(cityGroup);
}
buildCityEnvironment();

// Cheese Items
const cheeseGeo = new THREE.ConeGeometry(0.35, 0.4, 5);
const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xffb700, roughness: 0.3 });

function spawnCheese(x, y, z) {
    const ch = new THREE.Mesh(cheeseGeo, cheeseMat);
    ch.rotation.x = Math.PI;
    ch.position.set(x, y + 0.3, z);
    scene.add(ch);
    cheeseItems.push(ch);
}

spawnCheese(-20, 0, -10); spawnCheese(20, 0, 15); spawnCheese(0, 12, -5);
spawnCheese(180, 0, -10); spawnCheese(220, 0, 15);

setInterval(() => {
    if (!gameStarted || currentHouse === 3) return;
    let baseOffsetX = (currentHouse === 2) ? 200 : 0;
    let rx = baseOffsetX + (Math.random() - 0.5) * 50;
    let rz = (Math.random() - 0.5) * 50;
    let ry = Math.random() > 0.6 ? 12 : 0;
    spawnCheese(rx, ry, rz);
}, 7000);

// Mouse Character
const mouseGroup = new THREE.Group();
const mouseBody = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.6 }));
mouseBody.scale.set(1, 0.6, 1.3);
mouseGroup.add(mouseBody);

const earMat = new THREE.MeshStandardMaterial({ color: 0xffa0b5 });
let ear1 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), earMat); ear1.position.set(0.2, 0.25, 0.08);
let ear2 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), earMat); ear2.position.set(-0.2, 0.25, 0.08);
mouseGroup.add(ear1, ear2);

// Mouse Right Arm & Held Sword Attachment
const armRight = new THREE.Group();
armRight.position.set(0.32, 0, 0.2);
mouseGroup.add(armRight);

const armMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshStandardMaterial({ color: 0x666666 }));
armRight.add(armMesh);

const heldSword = buildSwordMesh();
heldSword.scale.set(0.6, 0.6, 0.6);
heldSword.rotation.x = Math.PI / 3;
heldSword.rotation.z = -Math.PI / 6;
heldSword.position.set(0.05, 0.05, 0.1);
heldSword.visible = false;
armRight.add(heldSword);

scene.add(mouseGroup);
mouseGroup.position.set(MOUSE_HOLE_SPAWN_1.x, MOUSE_HOLE_SPAWN_1.y, MOUSE_HOLE_SPAWN_1.z);

// --- ENEMIES: HOUSE 1 ---
const grandmaGroup = new THREE.Group();
let gBody = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1.5), new THREE.MeshStandardMaterial({ color: 0x6b1fb3 })); gBody.position.y = 2;
let gHead = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffdbc4 })); gHead.position.y = 3.8;
grandmaGroup.add(gBody, gHead); scene.add(grandmaGroup);
grandmaGroup.position.set(15, 0, 10);

const catGroup = new THREE.Group();
let catBody = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 1.8), new THREE.MeshStandardMaterial({ color: 0x111111 })); catBody.position.y = 0.5;
catGroup.add(catBody); scene.add(catGroup);
catGroup.position.set(-15, 0, 10);

// --- ENEMIES: HOUSE 2 ---
const blueGrandmaGroup = new THREE.Group();
let bgBody = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1.5), new THREE.MeshStandardMaterial({ color: 0x0055ff })); bgBody.position.y = 2;
let bgHead = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffdbc4 })); bgHead.position.y = 3.8;
blueGrandmaGroup.add(bgBody, bgHead); scene.add(blueGrandmaGroup);
blueGrandmaGroup.position.set(215, 0, 10);

const grandpaGroup = new THREE.Group();
let gpBody = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.8, 1.5), new THREE.MeshStandardMaterial({ color: 0x228b22 })); gpBody.position.y = 1.9;
let gpHead = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffd3b6 })); gpHead.position.y = 3.6;
let cane = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.5), new THREE.MeshStandardMaterial({ color: 0x4a2e18 }));
cane.position.set(1.2, 1.25, 0.5); cane.rotation.z = -Math.PI / 12;
grandpaGroup.add(gpBody, gpHead, cane); scene.add(grandpaGroup);
grandpaGroup.position.set(185, 0, -10);

const blueCatGroup = new THREE.Group();
let bcBody = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 1.8), new THREE.MeshStandardMaterial({ color: 0xff6600 })); bcBody.position.y = 0.5;
blueCatGroup.add(bcBody); scene.add(blueCatGroup);
blueCatGroup.position.set(185, 0, 15);

// Touch Controller
let moveVector = { x: 0, y: 0 };
const zone = document.getElementById('joystick-zone');
const knob = document.getElementById('joystick-knob');
let joystickActive = false;
let joystickTouchId = null;

function processJoystick(clientX, clientY) {
    let rect = zone.getBoundingClientRect();
    let centerX = rect.left + rect.width / 2;
    let centerY = rect.top + rect.height / 2;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    let dist = Math.min(Math.sqrt(dx * dx + dy * dy), 35);
    let angle = Math.atan2(dy, dx);
    
    let knobX = Math.cos(angle) * dist;
    let knobY = Math.sin(angle) * dist;

    knob.style.transform = `translate(${knobX}px, ${knobY}px)`;
    moveVector.x = knobX / 35;
    moveVector.y = knobY / 35;
}

window.addEventListener('touchstart', (e) => {
    if (!gameStarted) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        let touch = e.changedTouches[i];
        if (touch.clientX < window.innerWidth / 2 && !joystickActive) {
            joystickActive = true;
            joystickTouchId = touch.identifier;
            processJoystick(touch.clientX, touch.clientY);
            break;
        }
    }
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    if (!joystickActive) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        let touch = e.changedTouches[i];
        if (touch.identifier === joystickTouchId) {
            processJoystick(touch.clientX, touch.clientY);
            break;
        }
    }
}, { passive: false });

const resetJoystick = (e) => {
    if (!joystickActive) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId) {
            joystickActive = false;
            joystickTouchId = null;
            knob.style.transform = `translate(0px, 0px)`;
            moveVector = { x: 0, y: 0 };
            break;
        }
    }
};

window.addEventListener('touchend', resetJoystick, { passive: false });
window.addEventListener('touchcancel', resetJoystick, { passive: false });

let isMouseDown = false;
zone.addEventListener('mousedown', (e) => { isMouseDown = true; processJoystick(e.clientX, e.clientY); });
window.addEventListener('mousemove', (e) => { if (isMouseDown) processJoystick(e.clientX, e.clientY); });
window.addEventListener('mouseup', () => { if (isMouseDown) { isMouseDown = false; knob.style.transform = `translate(0px, 0px)`; moveVector = { x: 0, y: 0 }; } });

// Jump Button
const btnContainer = document.createElement('div');
btnContainer.style.cssText = "position:fixed; bottom:30px; right:30px; display:flex; flex-direction:column; gap:12px; z-index:99999; pointer-events:auto;";
document.body.appendChild(btnContainer);

const jumpBtn = document.createElement('button');
jumpBtn.innerText = "🦘 JUMP";
jumpBtn.style.cssText = "width:70px; height:70px; background:linear-gradient(135deg, #00c6ff, #0072ff); color:white; border-radius:50%; font-weight:bold; border:2px solid rgba(255,255,255,0.8); font-size:12px; cursor:pointer; box-shadow:0 6px 16px rgba(0,0,0,0.4);";
btnContainer.appendChild(jumpBtn);

function triggerJump(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!isJumping) { isJumping = true; jumpVelocity = 0.28; playSound(400, 0.15, 'sine'); }
}
jumpBtn.addEventListener('click', triggerJump);
jumpBtn.addEventListener('touchstart', triggerJump);

// ⚔️ SLAY BUTTON & SWORD SLASH ANIMATION
const slayBtn = document.createElement('button');
slayBtn.innerText = "⚔️ SLAY";
slayBtn.style.cssText = "position:fixed; bottom:115px; right:35px; width:70px; height:70px; background:linear-gradient(135deg, #ff0844, #ffb199); color:white; border-radius:50%; font-weight:bold; border:2px solid rgba(255,255,255,0.9); font-size:12px; cursor:pointer; display:none; z-index:99999; box-shadow:0 6px 16px rgba(255,8,68,0.5); pointer-events:auto;";
document.body.appendChild(slayBtn);

function triggerSlay(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!hasSword) return;

    // Trigger Sword Swing Sound Effect (High Pitch Metallic Swoosh)
    playSound(1200, 0.2, 'sawtooth', 200);

    // Trigger Visual Swing Animation
    isSwinging = true;
    swingProgress = 0;
    
    let killedAny = false;

    if (currentHouse === 1) {
        if (grandmaAlive && mouseGroup.position.distanceTo(grandmaGroup.position) < 6.0) {
            grandmaAlive = false; grandmaGroup.position.y = -50; killedAny = true;
        }
        if (catAlive && mouseGroup.position.distanceTo(catGroup.position) < 6.0) {
            catAlive = false; catGroup.position.y = -50; killedAny = true;
        }
    } else if (currentHouse === 2) {
        if (blueGrandmaAlive && mouseGroup.position.distanceTo(blueGrandmaGroup.position) < 6.0) {
            blueGrandmaAlive = false; blueGrandmaGroup.position.y = -50; killedAny = true;
        }
        if (grandpaAlive && mouseGroup.position.distanceTo(grandpaGroup.position) < 6.0) {
            grandpaAlive = false; grandpaGroup.position.y = -50; killedAny = true;
        }
        if (blueCatAlive && mouseGroup.position.distanceTo(blueCatGroup.position) < 6.0) {
            blueCatAlive = false; blueCatGroup.position.y = -50; killedAny = true;
        }
    }

    if (killedAny) {
        // Deep Impact Defeat Sound
        playSound(200, 0.4, 'square', 40);
        let alertBox = document.getElementById('death-reason');
        alertBox.style.color = "#00ffcc";
        document.getElementById('death-reason').innerText = "⚔️ You slayed the enemy near you!";
        document.getElementById('game-over').style.display = 'flex';
        setTimeout(() => { document.getElementById('game-over').style.display = 'none'; }, 2000);
    }
}
slayBtn.addEventListener('click', triggerSlay);
slayBtn.addEventListener('touchstart', triggerSlay);

// Navigation Buttons
const goDownBtn = document.createElement('button');
goDownBtn.innerText = "⬇️ GO DOWN TO FIRST FLOOR";
goDownBtn.style.cssText = "position:fixed; top:85px; left:50%; transform:translateX(-50%); padding:12px 24px; background:linear-gradient(135deg, #ff9900, #ff5500); color:white; border-radius:30px; font-weight:bold; border:2px solid #fff; font-size:13px; cursor:pointer; display:none; z-index:99999; box-shadow:0 8px 20px rgba(0,0,0,0.5); pointer-events:auto;";
document.body.appendChild(goDownBtn);

function triggerGoDown(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    isOnSecondFloor = false;
    isJumping = false;
    jumpVelocity = 0;
    
    if (currentHouse === 1) {
        mouseGroup.position.set(MOUSE_HOLE_SPAWN_1.x, MOUSE_HOLE_SPAWN_1.y, MOUSE_HOLE_SPAWN_1.z);
    } else {
        mouseGroup.position.set(MOUSE_HOLE_SPAWN_2.x, MOUSE_HOLE_SPAWN_2.y, MOUSE_HOLE_SPAWN_2.z);
    }
    
    goDownBtn.style.display = 'none';
    playSound(400, 0.2, 'sine');
}
goDownBtn.addEventListener('click', triggerGoDown);
goDownBtn.addEventListener('touchstart', triggerGoDown);

const switchHouseBtn = document.createElement('button');
switchHouseBtn.innerText = "🏠 BLUE HOUSE";
switchHouseBtn.style.cssText = "position:fixed; top:75px; left:15px; padding:10px 18px; background:linear-gradient(135deg, #8a2be2, #4a00e0); color:white; border-radius:16px; font-weight:bold; border:2px solid white; font-size:12px; cursor:pointer; display:none; z-index:99999; box-shadow:0 6px 16px rgba(0,0,0,0.4); pointer-events:auto;";
document.body.appendChild(switchHouseBtn);

function triggerSwitchHouse(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (currentHouse === 2) {
        currentHouse = 1;
        mouseGroup.position.set(MOUSE_HOLE_SPAWN_1.x, MOUSE_HOLE_SPAWN_1.y, MOUSE_HOLE_SPAWN_1.z);
        switchHouseBtn.innerText = "🏠 BLUE HOUSE";
    } else {
        currentHouse = 2;
        mouseGroup.position.set(MOUSE_HOLE_SPAWN_2.x, MOUSE_HOLE_SPAWN_2.y, MOUSE_HOLE_SPAWN_2.z);
        switchHouseBtn.innerText = "🏠 OLD HOUSE";
    }
    isOnSecondFloor = false;
    goDownBtn.style.display = 'none';
    updateQuestDisplay();
    playSound(600, 0.3, 'sine');
}
switchHouseBtn.addEventListener('click', triggerSwitchHouse);
switchHouseBtn.addEventListener('touchstart', triggerSwitchHouse);

// Camera Orbit
let cameraAngleY = 0, cameraAngleX = 0.4;
let lastTouchX = 0, lastTouchY = 0, isRotatingCam = false;

window.addEventListener('touchstart', (e) => {
    for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].clientX > window.innerWidth / 2) {
            lastTouchX = e.touches[i].clientX;
            lastTouchY = e.touches[i].clientY;
            isRotatingCam = true;
        }
    }
});
window.addEventListener('touchmove', (e) => {
    if (!isRotatingCam) return;
    for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].clientX > window.innerWidth / 2) {
            cameraAngleY -= (e.touches[i].clientX - lastTouchX) * 0.007;
            cameraAngleX += (e.touches[i].clientY - lastTouchY) * 0.007;
            cameraAngleX = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, cameraAngleX));
            lastTouchX = e.touches[i].clientX;
            lastTouchY = e.touches[i].clientY;
        }
    }
});
window.addEventListener('touchend', () => { isRotatingCam = false; });

const playBtn = document.getElementById('play-btn');
function handlePlay(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    document.getElementById('joystick-zone').style.display = 'block';
    gameStarted = true;
}
playBtn.addEventListener('click', handlePlay);
playBtn.addEventListener('touchstart', handlePlay);

function updateHealthBar() {
    let hearts = ""; for (let i = 0; i < hp; i++) hearts += "♥";
    document.getElementById('health-bar').innerText = hearts;
}

function takeDamage(enemyName) {
    if (isCaught || isOnSecondFloor) return;
    if (mouseGroup.position.z < -35) return;

    hp--; updateHealthBar(); playSound(150, 0.3, 'sawtooth');
    if (hp <= 0) {
        isCaught = true;
        isOnSecondFloor = false;
        goDownBtn.style.display = 'none';
        document.getElementById('death-reason').innerText = enemyName + " caught you! RESPAWNING IN MOUSE HOME...";
        document.getElementById('game-over').style.display = 'flex';
        
        setTimeout(() => {
            hp = 3; updateHealthBar();
            if (currentHouse === 1) {
                mouseGroup.position.set(MOUSE_HOLE_SPAWN_1.x, MOUSE_HOLE_SPAWN_1.y, MOUSE_HOLE_SPAWN_1.z);
            } else {
                mouseGroup.position.set(MOUSE_HOLE_SPAWN_2.x, MOUSE_HOLE_SPAWN_2.y, MOUSE_HOLE_SPAWN_2.z);
            }
            document.getElementById('game-over').style.display = 'none'; isCaught = false;
        }, 3000);
    }
}

function checkSwordPickup() {
    if (!gameStarted || isCaught || hasSword) return;
    swords.forEach((sw) => {
        if (sw.visible && mouseGroup.position.distanceTo(sw.position) < 3.5) {
            sw.visible = false;
            hasSword = true;
            heldSword.visible = true;
            slayBtn.style.display = 'block';
            playSound(850, 0.4, 'sine');
            
            let alertBox = document.getElementById('death-reason');
            alertBox.style.color = "#00ffcc";
            document.getElementById('death-reason').innerText = "⚔️ Sword Equipped! Click SLAY to defeat enemies!";
            document.getElementById('game-over').style.display = 'flex';
            setTimeout(() => { document.getElementById('game-over').style.display = 'none'; }, 2500);
        }
    });
}

window.addEventListener('click', checkSwordPickup);
window.addEventListener('touchstart', checkSwordPickup);

const winScreen = document.getElementById('win-screen');

// Animation Loop
function animate() {
    requestAnimationFrame(animate);

    if (gameStarted && !isCaught) {
        let moveX = -moveVector.x * Math.cos(cameraAngleY) - moveVector.y * Math.sin(cameraAngleY);
        let moveZ = moveVector.x * Math.sin(cameraAngleY) - moveVector.y * Math.cos(cameraAngleY);

        let nextX = mouseGroup.position.x + moveX * 0.3;
        let nextZ = mouseGroup.position.z + moveZ * 0.3;

        mouseGroup.position.y += jumpVelocity;
        jumpVelocity += gravity;

        for (let l of ladders) {
            if (!isOnSecondFloor && l.houseId === currentHouse && l.box.containsPoint(mouseGroup.position)) {
                mouseGroup.position.y = 12.3;
                isOnSecondFloor = true;
                jumpVelocity = 0;
                isJumping = false;
                goDownBtn.style.display = 'block';
                playSound(600, 0.15, 'sine');
                break;
            }
        }

        let targetGroundY = isOnSecondFloor ? 12.3 : 0.3;
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

        // SWORD SLASH ANIMATION FRAME LOGIC
        if (isSwinging) {
            swingProgress += 0.15;
            if (swingProgress <= Math.PI) {
                // Smooth arc slice motion
                armRight.rotation.y = Math.sin(swingProgress) * 2.2;
                armRight.rotation.x = -Math.sin(swingProgress) * 1.2;
            } else {
                isSwinging = false;
                swingProgress = 0;
                armRight.rotation.y = 0;
                armRight.rotation.x = 0;
            }
        }

        // Cheese Pickups
        cheeseItems.forEach((ch) => {
            if (ch.visible && mouseGroup.position.distanceTo(ch.position) < 1.5) {
                ch.visible = false;
                cheese += 25;
                document.getElementById('cheese-count').innerText = cheese;
                playSound(600, 0.1, 'sine');
                updateQuestDisplay();

                if (cheese >= 110 && currentHouse === 1) {
                    currentHouse = 2;
                    winScreen.querySelector('h2').innerText = "🏡 UNLOCKED BLUE HOUSE!";
                    winScreen.querySelector('p').innerText = "Spawned inside your Blue House Mouse Home!";
                    winScreen.style.display = 'flex';
                    updateQuestDisplay();
                    playSound(900, 0.5, 'sine');
                    setTimeout(() => {
                        winScreen.style.display = 'none';
                        mouseGroup.position.set(MOUSE_HOLE_SPAWN_2.x, MOUSE_HOLE_SPAWN_2.y, MOUSE_HOLE_SPAWN_2.z);
                        switchHouseBtn.style.display = 'block';
                        switchHouseBtn.innerText = "🏠 OLD HOUSE";
                    }, 3000);
                }

                if (cheese >= 500 && currentHouse === 2) {
                    currentHouse = 3;
                    winScreen.querySelector('h2').innerText = "🏙️ ESCAPED TO THE CITY!";
                    winScreen.querySelector('p').innerText = "You escaped Grandma & Grandpa and made it into the City!";
                    winScreen.style.display = 'flex';
                    updateQuestDisplay();
                    switchHouseBtn.style.display = 'none';
                    playSound(1000, 0.8, 'sine');
                    setTimeout(() => {
                        winScreen.style.display = 'none';
                        mouseGroup.position.set(0, 0.3, -120);
                    }, 3500);
                }
            }
        });

        // Enemy AI Pathing
        if (!isOnSecondFloor && mouseGroup.position.z >= -35) {
            if (currentHouse === 1) {
                if (grandmaAlive) {
                    let gDist = grandmaGroup.position.distanceTo(mouseGroup.position);
                    if (gDist < 30) {
                        grandmaGroup.lookAt(mouseGroup.position.x, grandmaGroup.position.y, mouseGroup.position.z);
                        grandmaGroup.translateZ(0.055);
                    }
                    if (gDist < 2.0) takeDamage('Grandma');
                }

                if (catAlive) {
                    let cDist = catGroup.position.distanceTo(mouseGroup.position);
                    if (cDist < 30) {
                        catGroup.lookAt(mouseGroup.position.x, catGroup.position.y, mouseGroup.position.z);
                        catGroup.translateZ(0.085);
                    }
                    if (cDist < 1.6) takeDamage('The Cat');
                }
            } else if (currentHouse === 2) {
                if (blueGrandmaAlive) {
                    let bgDist = blueGrandmaGroup.position.distanceTo(mouseGroup.position);
                    if (bgDist < 30) {
                        blueGrandmaGroup.lookAt(mouseGroup.position.x, blueGrandmaGroup.position.y, mouseGroup.position.z);
                        blueGrandmaGroup.translateZ(0.06);
                    }
                    if (bgDist < 2.0) takeDamage('Blue Grandma');
                }

                if (grandpaAlive) {
                    let gpDist = grandpaGroup.position.distanceTo(mouseGroup.position);
                    if (gpDist < 30) {
                        grandpaGroup.lookAt(mouseGroup.position.x, grandpaGroup.position.y, mouseGroup.position.z);
                        grandpaGroup.translateZ(0.05);
                    }
                    if (gpDist < 2.0) takeDamage('Grandpa');
                }

                if (blueCatAlive) {
                    let bcDist = blueCatGroup.position.distanceTo(mouseGroup.position);
                    if (bcDist < 30) {
                        blueCatGroup.lookAt(mouseGroup.position.x, blueCatGroup.position.y, mouseGroup.position.z);
                        blueCatGroup.translateZ(0.095);
                    }
                    if (bcDist < 1.6) takeDamage('Orange Cat');
                }
            }
        }
    }

    // Camera Orbit
    let camDist = 7.5;
    camera.position.x = mouseGroup.position.x - Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * camDist;
    camera.position.z = mouseGroup.position.z - Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * camDist;
    camera.position.y = mouseGroup.position.y + Math.sin(cameraAngleX) * camDist + 1.5;
    camera.lookAt(mouseGroup.position.x, mouseGroup.position.y + 0.5, mouseGroup.position.z);

    renderer.render(scene, camera);
}

animate();
