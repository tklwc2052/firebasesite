const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      lightCanvas.width = window.innerWidth;
      lightCanvas.height = window.innerHeight;
    }

    // LIGHTING SYSTEM CANVAS
    const lightCanvas = document.createElement('canvas');
    const lctx = lightCanvas.getContext('2d');
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // PHYSICS CONSTANTS
    const TILE_SIZE = 64; 
    const BOMB_FALL_SPEED = 600;

    const WORLD_WIDTH = 150; 
    const WORLD_HEIGHT = 15000; 
    const SEED = 12345;
    const CAVE_MIN_DEPTH = 9500;
    const CAVE_MAX_DEPTH = 13500;
    const CAVE_COUNT = 48;
    const BOMB_COST = 20; 
    const DYNAMITE_COST = 10;
    
    // Default physics values (mutated by enchants)
    const BASE_GRAVITY = 1600;
    const BASE_JUMP = -650;

    let lastTime = performance.now();
    let isMapLoaded = false;
    let gameMap = [];
    const bombs = []; 
    
    const worldTorches = []; // Persistent storage for placed torches
    const worldFurnaces = []; // Persistent, placeable furnaces
    const worldTrees = []; // Persistent saplings and trees

    const firebaseConfig = { databaseURL: "https://avern-game-default-rtdb.firebaseio.com" };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    const SAVE_VERSION = 3;
    const ORE_PRICES = { coal: 2, rawIron: 6, ironBar: 12, rawGold: 12, goldBar: 25, diamond: 75 };
    const INVENTORY_LIMITS = { dirt:999, coal:250, rawIron:150, rawGold:100, diamond:50, lapis:100, ironBar:200, goldBar:200, torch:250, furnace:10, sapling:99, wood:999, enchantTable:10, bomb:99, dynamite:99 };
    const ITEM_INFO = {
      dirt:{name:'DIRT',desc:'A basic placeable block.'}, coal:{name:'COAL',desc:'Fuel for furnaces or sell it for coins.'},
      rawIron:{name:'RAW IRON',desc:'Smelt this into valuable iron bars.'}, rawGold:{name:'RAW GOLD',desc:'Smelt this into valuable gold bars.'},
      diamond:{name:'DIAMOND',desc:'A rare gem that sells for many coins.'}, lapis:{name:'LAPIS',desc:'Used for enchanting.'},
      ironBar:{name:'IRON BAR',desc:'Smelted iron. Sell it or save it for crafting.'}, goldBar:{name:'GOLD BAR',desc:'Smelted gold worth more than raw ore.'},
      torch:{name:'TORCH',desc:'Place it to light dark tunnels.'}, furnace:{name:'FURNACE',desc:'Place it, then interact to smelt ores.'}, sapling:{name:'SAPLING',desc:'Plant on top of any solid block. Needs a clear 3x6 area.'}, wood:{name:'WOOD',desc:'A versatile building and crafting material.'},
      enchantTable:{name:'ENCHANT TABLE',desc:'Place it to access enchantments.'}, bomb:{name:'BOMB',desc:'A small explosive.'}, dynamite:{name:'DYNAMITE',desc:'A stronger explosive.'}
    };

    const UPGRADES = {
        efficiency: [
            { id: 1, name: "SHARP PICK", cost: 40, power: 1.5 },
            { id: 2, name: "STEEL DRILL", cost: 120, power: 2.5 },
            { id: 3, name: "SONIC BLADE", cost: 450, power: 4.5 },
            { id: 4, name: "PLASMA CORE", cost: 1200, power: 8.0 }
        ],
        fortune: [
            { id: 1, name: "SMALL BAG", cost: 60, chance: 0.20 },
            { id: 2, name: "ORE MAGNET", cost: 200, chance: 0.40 },
            { id: 3, name: "DEEP SCANNER", cost: 600, chance: 0.65 },
            { id: 4, name: "MIDAS CORE", cost: 1800, chance: 0.90 }
        ]
    };

    // GENERATE 50 ENCHANTMENTS (5 Categories * 10 Levels)
    const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
    const ENCHANTS = { hp: [], speed: [], jump: [], feather: [], wealth: [] };
    for(let i=1; i<=10; i++) {
        ENCHANTS.hp.push({ name: "VITALITY " + ROMAN[i], cost: i*15 + i*i*5, val: 500 + i*50 });
        ENCHANTS.speed.push({ name: "HASTE " + ROMAN[i], cost: i*15 + i*i*5, val: 400 + i*20 });
        ENCHANTS.jump.push({ name: "LEAP " + ROMAN[i], cost: i*20 + i*i*5, val: BASE_JUMP - i*25 });
        ENCHANTS.feather.push({ name: "LIGHTWEIGHT " + ROMAN[i], cost: i*20 + i*i*5, val: BASE_GRAVITY - i*60 });
        ENCHANTS.wealth.push({ name: "WEALTH " + ROMAN[i], cost: i*30 + i*i*10, val: 1 + i*0.2 });
    }

    const ACHIEVEMENT_LIST = [
        { id: 'dirt_10', type: 'dirt', threshold: 10, name: "DIRT DIGGER I", desc: "Mine 10 blocks of dirt" },
        { id: 'dirt_100', type: 'dirt', threshold: 100, name: "DIRT DIGGER II", desc: "Mine 100 blocks of dirt" },
        { id: 'gold_5', type: 'gold', threshold: 5, name: "GOLD RUSH I", desc: "Collect 5 pieces of gold" },
        { id: 'gold_50', type: 'gold', threshold: 50, name: "GOLD RUSH II", desc: "Collect 50 pieces of gold" },
        { id: 'diamond_1', type: 'diamond', threshold: 1, name: "SHINY FIND", desc: "Find your first diamond" },
        { id: 'diamond_10', type: 'diamond', threshold: 10, name: "DIAMOND HANDS", desc: "Collect 10 diamonds" },
        { id: 'blocks_100', type: 'total', threshold: 100, name: "MINING APPRENTICE", desc: "Mine 100 total blocks" },
        { id: 'blocks_1000', type: 'total', threshold: 1000, name: "MASTER MINER", desc: "Mine 1000 total blocks" },
        { id: 'depth_100', type: 'depth', threshold: 100, name: "DEEP DIVER I", desc: "Reach a depth of 100m" },
        { id: 'depth_500', type: 'depth', threshold: 500, name: "DEEP DIVER II", desc: "Reach a depth of 500m" }
    ];

    const sprites = {
      hidden: new Image(), top: new Image(), ore: new Image(), diamond: new Image(),
      surfaceVariants: [new Image(), new Image(), new Image()],
      idle: new Image(), up: new Image(), 
      fall: new Image(), crouch: new Image(),
      walk: [new Image(), new Image()], miningSide: [new Image(), new Image()],
      bomb: new Image(), torch: new Image(),
      hats: { hardHat: new Image(), crown: new Image(), goggles: new Image() },
      achievementIcon: new Image(),
      iron: new Image(), coal: new Image(), lapis: new Image(), enchantTable: new Image(),
      
    };
    sprites.hidden.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/nothing.png';
    sprites.top.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/top.png';
    sprites.surfaceVariants[0].src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/surface1.png';
    sprites.surfaceVariants[1].src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/surface3.png';
    sprites.surfaceVariants[2].src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/surface2.png';
    sprites.ore.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/gold.png';
    sprites.diamond.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/diamond.png';
    sprites.idle.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/idle.png';
    sprites.up.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/up.png';
    sprites.fall.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/down.png';
    sprites.crouch.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/crouch.png';
    sprites.walk[0].src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/right1.png';
    sprites.walk[1].src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/right2.png';
    sprites.miningSide[0].src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/pic1.png';
    sprites.miningSide[1].src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/pic2.png';
    sprites.bomb.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/bomb.png';
    sprites.torch.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/torch.png'; 
    sprites.hats.hardHat.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/hat3.png';
    sprites.hats.crown.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/hat6.png';
    sprites.hats.goggles.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/hat7.png';
    
    sprites.iron.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/iron.png'; 
    sprites.coal.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/coall.png';
    sprites.lapis.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/lapis.png';
    sprites.enchantTable.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/etable.png';

    
    sprites.achievementIcon.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/achivementboko.png';
    sprites.achievementIcon.onload = () => {
        document.getElementById('achievement-btn').style.backgroundImage = `url(${sprites.achievementIcon.src})`;
    };

    const savedData = JSON.parse(localStorage.getItem('driller_save') || '{}');
    const myId = savedData.id || "driller_" + Math.random().toString(36).substring(7);
    let myUsername = savedData.username || prompt("Enter username:") || "Miner_" + Math.random().toString(36).substring(7);
    myUsername = String(myUsername).replace(/[^a-zA-Z0-9_ -]/g, '').trim().slice(0, 16) || 'Miner';

    const player = { 
        x: savedData.x ?? (WORLD_WIDTH * TILE_SIZE) / 2, y: savedData.y ?? 100, 
        vx: 0, vy: 0, w: 40, h: 50,
        hp: savedData.hp ?? 500, baseHp: 500, maxHp: 500,
        baseSpeed: 400, moveSpeed: 400,
        moveAcceleration: 3200, moveDeceleration: 4200,
        baseJump: BASE_JUMP, jumpForce: BASE_JUMP,
        baseGravity: BASE_GRAVITY, gravity: BASE_GRAVITY,
        onGround: false, jumpCount: 0, res: savedData.res || 0,
        lapis: savedData.lapis || 0,
        torchCount: savedData.torchCount ?? 10,
        selectedSlot: 1, upgrades: savedData.upgrades || { efficiency: 0, fortune: 0 },
        enchantUpgrades: savedData.enchantUpgrades || { hp: 0, speed: 0, jump: 0, feather: 0, wealth: 0 },
        hasEnchantTable: savedData.hasEnchantTable || false,
        hat: savedData.hat || 'none', dir: 'down', isMoving: false, flip: false, isMining: false, isCrouching: false, username: myUsername,
        stats: savedData.stats || { dirt: 0, gold: 0, diamond: 0, iron: 0, coal: 0, lapis: 0, total: 0, maxDepth: 0 },
        inventory: savedData.inventory || {
          dirt: savedData.ores?.dirt ?? savedData.stats?.dirt ?? 0,
          coal: savedData.ores?.coal ?? savedData.stats?.coal ?? 0,
          rawIron: savedData.ores?.iron ?? savedData.stats?.iron ?? 0,
          rawGold: savedData.ores?.gold ?? savedData.stats?.gold ?? 0,
          diamond: savedData.ores?.diamond ?? savedData.stats?.diamond ?? 0,
          lapis: savedData.lapis || 0, ironBar:0, goldBar:0,
          torch: savedData.torchCount ?? 10, furnace:0, sapling:0, wood:0,
          enchantTable: savedData.hasEnchantTable ? 1 : 0, bomb:0, dynamite:0
        },
        furnaceJob: savedData.furnaceJob || null,
        achieved: savedData.achieved || []
    };

    for(const key of Object.keys(INVENTORY_LIMITS)) if(!Number.isFinite(player.inventory[key])) player.inventory[key]=0;
    player.lapis=player.inventory.lapis;
    player.torchCount=player.inventory.torch;
    player.hasEnchantTable=player.inventory.enchantTable>0;
    window.setSlot = (s) => { player.selectedSlot = s; updateInventoryUI(); };

    function recalculateStats() {
        player.maxHp = player.enchantUpgrades.hp > 0 ? ENCHANTS.hp[player.enchantUpgrades.hp - 1].val : player.baseHp;
        player.moveSpeed = player.enchantUpgrades.speed > 0 ? ENCHANTS.speed[player.enchantUpgrades.speed - 1].val : player.baseSpeed;
        player.jumpForce = player.enchantUpgrades.jump > 0 ? ENCHANTS.jump[player.enchantUpgrades.jump - 1].val : player.baseJump;
        player.gravity = player.enchantUpgrades.feather > 0 ? ENCHANTS.feather[player.enchantUpgrades.feather - 1].val : player.baseGravity;
    }
    recalculateStats();

    let camera = { x: player.x, y: player.y, shake: 0 }; 
    const otherPlayers = {};
    const keys = {};
    let miningProgress = 0, shopOpen = false, achievementMenuOpen = false, enchantMenuOpen = false, infoMenuOpen = false;
    let inventoryOpen = false, furnaceOpen = false, selectedInventoryItem = null, currentFurnaceKey = null;
    let currentEnchantTable = null;

    const chatContainer = document.getElementById('chat-container');
    const chatBox = document.getElementById('chat-box');
    const chatInput = document.getElementById('chat-input');
    let isTyping = false;

    function initOrSyncMap() {
        // Deterministic generation gives every player the same world.
        let randomState = SEED >>> 0;
        function seededRandom() {
            randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
            return randomState / 4294967296;
        }

        // Build the base world. Ores and caves are generated afterward.
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            gameMap[y] = [];
            for (let x = 0; x < WORLD_WIDTH; x++) {
                if (y < 12) gameMap[y][x] = 0;
                else if (y === 12) gameMap[y][x] = 3;
                else gameMap[y][x] = 1 + (Math.floor(seededRandom() * 3) / 10);
            }
        }

        function oreChance(type, y) {
            if (type === 4) return y >= 5000 && y <= 8500 ? 0.00125 : 0;
            if (type === 7) return y >= 500 && y <= 9000 ? 0.00375 : 0;
            if (type === 2) return y >= 100 && y <= 7500 ? 0.01 : 0;
            if (type === 5) return y >= 1000 && y <= 10000 ? 0.015 : 0;
            if (type === 6 && y >= 40 && y <= 5000) {
                const depthFactor = (y - 40) / 4960;
                return (0.05 + depthFactor * 0.10) / 4;
            }
            return 0;
        }

        function placeOreVein(startX, startY, type) {
            const targetSize = 3 + Math.floor(seededRandom() * 3);
            let x = startX, y = startY, placed = 0, attempts = 0;
            while (placed < targetSize && attempts < targetSize * 10) {
                attempts++;
                if (x >= 0 && x < WORLD_WIDTH && y > 12 && y < WORLD_HEIGHT &&
                    gameMap[y][x] > 0 && ![2, 4, 5, 6, 7].includes(gameMap[y][x])) {
                    gameMap[y][x] = type;
                    placed++;
                }
                const direction = Math.floor(seededRandom() * 4);
                if (direction === 0) x++;
                else if (direction === 1) x--;
                else if (direction === 2) y++;
                else y--;
                x = Math.max(0, Math.min(WORLD_WIDTH - 1, x));
                y = Math.max(13, Math.min(WORLD_HEIGHT - 1, y));
            }
        }

        // Vein-start chances are reduced to keep overall ore amounts balanced.
        const oreTypes = [4, 7, 2, 5, 6];
        for (let y = 13; y < WORLD_HEIGHT; y++) {
            for (let x = 0; x < WORLD_WIDTH; x++) {
                for (const type of oreTypes) {
                    if (seededRandom() < oreChance(type, y)) {
                        placeOreVein(x, y, type);
                        break;
                    }
                }
            }
        }

        function carveCircle(cx, cy, radius) {
            for (let y = cy - radius; y <= cy + radius; y++) {
                for (let x = cx - radius; x <= cx + radius; x++) {
                    if (x < 1 || x >= WORLD_WIDTH - 1 || y < CAVE_MIN_DEPTH || y > CAVE_MAX_DEPTH) continue;
                    const dx = x - cx, dy = y - cy;
                    if (dx * dx + dy * dy <= radius * radius) gameMap[y][x] = 0;
                }
            }
        }

        // Random cave tunnels only between depths 9,500 and 13,500.
        for (let cave = 0; cave < CAVE_COUNT; cave++) {
            let x = 4 + Math.floor(seededRandom() * (WORLD_WIDTH - 8));
            let y = CAVE_MIN_DEPTH + Math.floor(seededRandom() * (CAVE_MAX_DEPTH - CAVE_MIN_DEPTH + 1));
            let angle = seededRandom() * Math.PI * 2;
            const length = 70 + Math.floor(seededRandom() * 151);
            for (let step = 0; step < length; step++) {
                carveCircle(Math.round(x), Math.round(y), 1 + Math.floor(seededRandom() * 3));
                angle += (seededRandom() - 0.5) * 0.9;
                x += Math.cos(angle) * (0.7 + seededRandom() * 0.8);
                y += Math.sin(angle) * (0.45 + seededRandom() * 0.65);
                if (x < 3 || x > WORLD_WIDTH - 4) angle = Math.PI - angle;
                if (y < CAVE_MIN_DEPTH + 2 || y > CAVE_MAX_DEPTH - 2) angle = -angle;
                x = Math.max(3, Math.min(WORLD_WIDTH - 4, x));
                y = Math.max(CAVE_MIN_DEPTH + 2, Math.min(CAVE_MAX_DEPTH - 2, y));
            }
        }
        db.ref('world_breaks').once('value', (snap) => {
            const data = snap.val();
            if (data) Object.values(data).forEach(b => applyBreak(b));
            isMapLoaded = true;
            updateInventoryUI();
            updateHealthUI();
        });
        db.ref('world_breaks').on('child_added', (snap) => { if (isMapLoaded) applyBreak(snap.val()); });
        
        db.ref('torches').on('child_added', (snap) => {
            const data = snap.val();
            if (!worldTorches.some(t => t.x === data.x && t.y === data.y)) {
                worldTorches.push({ ...data, key: snap.key });
            }
        });
        db.ref('torches').on('child_removed', (snap) => {
            const data = snap.val();
            const index = worldTorches.findIndex(t => t.x === data.x && t.y === data.y);
            if (index !== -1) worldTorches.splice(index, 1);
        });


        db.ref('furnaces').on('child_added', (snap) => {
            if (!worldFurnaces.some(f => f.key === snap.key)) worldFurnaces.push({ ...snap.val(), key: snap.key });
        });
        db.ref('furnaces').on('child_changed', (snap) => {
            const index = worldFurnaces.findIndex(f => f.key === snap.key);
            if (index !== -1) worldFurnaces[index] = { ...snap.val(), key: snap.key };
            if (furnaceOpen && currentFurnaceKey === snap.key) renderFurnace();
        });
        db.ref('furnaces').on('child_removed', (snap) => {
            const index = worldFurnaces.findIndex(f => f.key === snap.key);
            if (index !== -1) worldFurnaces.splice(index, 1);
            if (currentFurnaceKey === snap.key) {
                currentFurnaceKey = null;
                if (furnaceOpen) toggleFurnace();
            }
        });

        db.ref('trees').on('child_added', snap => { if(!worldTrees.some(t=>t.key===snap.key)) worldTrees.push({...snap.val(),key:snap.key}); });
        db.ref('trees').on('child_changed', snap => { const i=worldTrees.findIndex(t=>t.key===snap.key); if(i>=0)worldTrees[i]={...snap.val(),key:snap.key}; });
        db.ref('trees').on('child_removed', snap => { const i=worldTrees.findIndex(t=>t.key===snap.key); if(i>=0)worldTrees.splice(i,1); });

        db.ref('bomb_drops').orderByChild('timestamp').startAt(Date.now()).on('child_added', (snap) => {
            const data = snap.val();
            if (data.id !== myId && Number.isFinite(data.x) && Number.isFinite(data.y)) bombs.push({ x: data.x, y: data.y, vy: 0, fuse: 2.5, owner: data.id });
        });
        db.ref('chat').limitToLast(20).on('child_added', (snap) => {
            const data = snap.val();
            if (Date.now() - data.timestamp < 300000) addChatMessage(data.user, data.msg);
        });
    }

    function updateHealthUI() {
        const hpEl = document.getElementById('hp-display');
        hpEl.innerText = `HP: ${Math.max(0, Math.floor(player.hp))}/${player.maxHp}`;
        if (player.hp <= 0) respawn();
    }
    
    function updateResUI() {
        const furnaceCount = document.getElementById('inv-furnace');
        if (furnaceCount) furnaceCount.innerText = player.inventory.furnace || 0;
        const saplingCount=document.getElementById('inv-sapling'); if(saplingCount)saplingCount.innerText=player.inventory.sapling||0;
        document.getElementById('inv-lapis').innerText = player.inventory.lapis || 0;
    }

    function updateTorchUI() { 
        document.getElementById('inv-torch').innerText = player.inventory.torch || 0; 
    }

    function respawn() {
        player.hp = player.maxHp;
        player.y = 100; 
        player.x = (WORLD_WIDTH * TILE_SIZE) / 2;
        player.vy = 0;
        updateHealthUI();
        alert("YOU PERISHED IN THE MINES!");
    }


    function checkAchievements() {
        ACHIEVEMENT_LIST.forEach(ach => {
            if (player.achieved.includes(ach.id)) return;
            let val = 0;
            if (ach.type === 'depth') val = Math.floor(player.y / TILE_SIZE);
            else val = player.stats[ach.type];
            if (val >= ach.threshold) {
                player.achieved.push(ach.id); showAchievement(ach.name);
            }
        });
    }

    function showAchievement(name) {
        const pop = document.getElementById('achievement-popup');
        document.getElementById('achievement-name').innerText = name;
        pop.classList.add('show'); setTimeout(() => pop.classList.remove('show'), 4000);
    }

    function toggleAchievementMenu() {
        if (isTyping) return;
        achievementMenuOpen = !achievementMenuOpen;
        document.getElementById('achievement-menu').style.display = achievementMenuOpen ? 'block' : 'none';
        if (achievementMenuOpen) renderAchievementMenu();
    }

    function toggleInfoMenu() {
        if (isTyping) return;
        infoMenuOpen = !infoMenuOpen;
        document.getElementById('info-menu').style.display = infoMenuOpen ? 'block' : 'none';
    }

    function renderAchievementMenu() {
        const container = document.getElementById('achievement-list-content');
        container.innerHTML = '';
        ACHIEVEMENT_LIST.forEach(ach => {
            const isDone = player.achieved.includes(ach.id);
            const row = document.createElement('div');
            row.className = `ach-row ${isDone ? 'completed' : ''}`;
            row.innerHTML = `
                <div class="ach-info"><span class="ach-name">${ach.name}</span><span class="ach-desc">${ach.desc}</span></div>
                <div class="ach-status">${isDone ? '✓' : ''}</div>
            `;
            container.appendChild(row);
        });
    }

    function addChatMessage(user, msg) {
        if (!user) return; 
        const div = document.createElement('div');
        div.className = 'chat-msg';
        const name = document.createElement('span');
        name.style.color = '#888';
        name.textContent = `[${String(user).slice(0,16).toUpperCase()}] `;
        const text = document.createElement('span');
        text.textContent = String(msg).slice(0,100);
        div.append(name, text);
        chatBox.appendChild(div); chatBox.scrollTop = chatBox.scrollHeight;
    }

    function sendChatMessage(msg) {
        if (msg.trim().length > 0) db.ref('chat').push({ user: player.username, msg: msg.trim(), timestamp: firebase.database.ServerValue.TIMESTAMP });
    }

    function applyBreak(b) {
        if (!b || !Number.isInteger(b.x) || !Number.isInteger(b.y) || b.x < 0 || b.x >= WORLD_WIDTH || b.y < 0 || b.y >= WORLD_HEIGHT) return;
        if (b.type === 'single') { if (gameMap[b.y]) gameMap[b.y][b.x] = 0; }
        else if (b.type === 'place') { if (gameMap[b.y]) gameMap[b.y][b.x] = b.block; }
        else if (b.type === 'area') {
            for (let iy = b.y - b.radius; iy <= b.y + b.radius; iy++) {
                for (let ix = b.x - b.radius; ix <= b.x + b.radius; ix++) {
                    if (gameMap[iy] && gameMap[iy][ix] !== undefined && gameMap[iy][ix] !== 2 && gameMap[iy][ix] !== 4 && gameMap[iy][ix] !== 8) gameMap[iy][ix] = 0;
                }
            }
        }
    }

    db.ref(".info/connected").on("value", (snap) => {
        const el = document.getElementById('status');
        el.innerText = snap.val() ? "SYSTEM ONLINE" : "SYSTEM OFFLINE";
        el.style.color = snap.val() ? "#00ff00" : "#ff0000";
    });

    const myPlayerRef = db.ref('players/' + myId);
    db.ref('.info/connected').on('value', snap => {
        if (snap.val()) myPlayerRef.onDisconnect().remove();
    });
    let lastSentPlayer = '';
    setInterval(() => {
        const state = {
            id: myId, x: player.x, y: player.y, vx: player.vx,
            dir: player.dir, isMoving: player.isMoving, flip: player.flip,
            isMining: player.isMining, username: player.username, hat: player.hat,
            lastSeen: firebase.database.ServerValue.TIMESTAMP,
            onGround: player.onGround, vy: player.vy,
            isCrouching: player.isCrouching, hp: Math.round(player.hp)
        };
        const comparable = JSON.stringify({...state, lastSeen: 0});
        if (comparable !== lastSentPlayer) {
            myPlayerRef.update(state);
            lastSentPlayer = comparable;
        }
    }, 50);
    function syncRemotePlayer(id, data) {
      if (id===myId || !data || !Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
      data.username=String(data.username||'Miner').slice(0,16);
      if (!otherPlayers[id]) otherPlayers[id]={...data,x:data.x,y:data.y,targetX:data.x,targetY:data.y,receivedAt:performance.now()};
      else { const op=otherPlayers[id]; const {x,y,...state}=data; Object.assign(op,state); op.targetX=x; op.targetY=y; op.receivedAt=performance.now(); }
      if (document.getElementById('user-list-overlay').style.display==='block') renderUserList();
    }
    const playersRef = db.ref('players');
    playersRef.on('child_added', snap => syncRemotePlayer(snap.key, snap.val()));
    playersRef.on('child_changed', snap => syncRemotePlayer(snap.key, snap.val()));
    playersRef.on('child_removed', snap => { delete otherPlayers[snap.key]; });
    setInterval(() => {
        const now = Date.now();
        for (const id in otherPlayers) if (now - (otherPlayers[id].lastSeen || 0) > 15000) delete otherPlayers[id];
    }, 5000);
    function renderUserList() {
        const container = document.getElementById('user-list-content');
        container.replaceChildren();
        const add = (name, mine=false) => {
            const row = document.createElement('div'); row.className = 'user-entry';
            const span = document.createElement('span');
            if (mine) span.className = 'me';
            span.textContent = String(name || 'Miner').slice(0,16).toUpperCase() + (mine ? ' (YOU)' : '');
            row.appendChild(span); container.appendChild(row);
        };
        add(player.username, true);
        for (const id in otherPlayers) add(otherPlayers[id].username);
    }
    function saveLocal() {
        localStorage.setItem('driller_save', JSON.stringify({
            saveVersion: SAVE_VERSION, id: myId, x: player.x, y: player.y, res: player.res, lapis: player.inventory.lapis,
            torchCount: player.torchCount, hasEnchantTable: player.hasEnchantTable, enchantUpgrades: player.enchantUpgrades,
            username: player.username, upgrades: player.upgrades, 
            hat: player.hat, hp: player.hp, stats: player.stats, inventory: player.inventory, achieved: player.achieved
        }));
    }
    setInterval(saveLocal, 5000);
    setInterval(() => { if (furnaceOpen) renderFurnace(); }, 250);

    function updateInventoryUI() {
        for(let i=1; i<=10; i++) {
            const el = document.getElementById('slot-'+i);
            if(el) el.classList.toggle('active', i === player.selectedSlot);
        }
        
        document.getElementById('slot-3-text').innerText = player.hasEnchantTable ? "TABLE" : "HAND";
        const slot3Img = document.getElementById('slot-3-img');
        if (player.hasEnchantTable) {
            slot3Img.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/surface2.png';
            slot3Img.style.filter = "drop-shadow(0 0 4px #aa00aa)";
        } else {
            slot3Img.src = 'https://raw.githubusercontent.com/tklwc2052/take2/refs/heads/main/idle.png';
            slot3Img.style.filter = "none";
        }

        document.getElementById('inv-dirt').innerText = player.inventory.dirt || 0;
        document.getElementById('inv-diamond').innerText = player.inventory.diamond || 0;
        document.getElementById('inv-coal').innerText = player.inventory.coal || 0;
        
        updateResUI();
        updateTorchUI();
    }

    function toggleShop() {
        if (isTyping || enchantMenuOpen || inventoryOpen || furnaceOpen) return;
        shopOpen = !shopOpen;
        document.getElementById('shop').style.display = shopOpen ? 'block' : 'none';
        if (shopOpen) renderShop();
    }

    function toggleEnchantMenu(tx = null, ty = null) {
        if (isTyping || shopOpen) return;
        enchantMenuOpen = !enchantMenuOpen;
        document.getElementById('enchant-menu').style.display = enchantMenuOpen ? 'block' : 'none';
        
        if (enchantMenuOpen && tx !== null && ty !== null) {
            currentEnchantTable = {tx, ty};
            renderEnchantMenu();
        } else {
            currentEnchantTable = null;
        }
    }

    function renderShop() {
        const effList = document.getElementById('eff-list');
        const fortList = document.getElementById('fort-list');
        effList.innerHTML = ''; fortList.innerHTML = '';
        
        const title=document.querySelector('#shop h2'); if(title) title.innerText=`VILLAGE TRADER - ${player.res} COINS`;
        let sell=document.getElementById('ore-sell-section'); if(!sell){sell=document.createElement('div');sell.id='ore-sell-section';sell.className='upgrade-section';document.getElementById('shop').insertBefore(sell,document.querySelector('#shop .upgrade-section'));}
        sell.innerHTML='<h3>SELL MATERIALS</h3>';
        const saplingRow=document.createElement('div');saplingRow.className='upgrade-row';saplingRow.innerHTML=`<span>SAPLING (${player.inventory.sapling||0} OWNED)</span><button class="upgrade-btn" ${player.res<25?'disabled':''} onclick="buySapling()">25 COINS</button>`;sell.appendChild(saplingRow);
        for(const [type,price] of Object.entries(ORE_PRICES)){const amount=player.inventory[type]||0;const row=document.createElement('div');row.className='upgrade-row';row.innerHTML=`<span>${ITEM_INFO[type].name}: ${amount} (${price} COINS)</span><span><button class="upgrade-btn" ${!amount?'disabled':''} onclick="sellItem('${type}',1)">SELL 1</button> <button class="upgrade-btn" ${!amount?'disabled':''} onclick="sellItem('${type}',${amount})">SELL ALL</button></span>`;sell.appendChild(row)}
        const total=Object.entries(ORE_PRICES).reduce((sum,[t,p])=>sum+(player.inventory[t]||0)*p,0);const all=document.createElement('button');all.className='upgrade-btn';all.disabled=!total;all.innerText=`SELL EVERYTHING (${total} COINS)`;all.onclick=sellAllMaterials;sell.appendChild(all);

        const btnBuyEnchant = document.getElementById('btn-buy-enchant');
        if (player.hasEnchantTable) {
            btnBuyEnchant.innerText = "OWNED"; btnBuyEnchant.disabled = true;
        } else {
            btnBuyEnchant.innerText = "1000 COINS"; btnBuyEnchant.disabled = player.res < 1000;
        }

        UPGRADES.efficiency.forEach((upg, i) => {
            const row = document.createElement('div'); row.className = 'upgrade-row';
            const isUnlocked = player.upgrades.efficiency >= i, isOwned = player.upgrades.efficiency > i;
            row.innerHTML = `<span>${upg.name}</span> 
                <button class="upgrade-btn" ${(!isUnlocked || isOwned || player.res < upg.cost) ? 'disabled' : ''} 
                onclick="buyUpgrade('efficiency', ${i})">${isOwned ? 'OWNED' : upg.cost}</button>`;
            effList.appendChild(row);
        });
        UPGRADES.fortune.forEach((upg, i) => {
            const row = document.createElement('div'); row.className = 'upgrade-row';
            const isUnlocked = player.upgrades.fortune >= i, isOwned = player.upgrades.fortune > i;
            row.innerHTML = `<span>${upg.name}</span> 
                <button class="upgrade-btn" ${(!isUnlocked || isOwned || player.res < upg.cost) ? 'disabled' : ''} 
                onclick="buyUpgrade('fortune', ${i})">${isOwned ? 'OWNED' : upg.cost}</button>`;
            fortList.appendChild(row);
        });
    }

    function renderEnchantMenu() {
        if (!currentEnchantTable) return;
        const {tx, ty} = currentEnchantTable;
        const list = document.getElementById('enchant-options-list');
        list.innerHTML = '';
        
        // Find block underneath the table
        let blockUnder = gameMap[ty+1] ? gameMap[ty+1][tx] : 0;
        
        // Tier limits based on block
        let maxTiers = {0: 1, 1: 2, 3: 2, 6: 4, 5: 6, 2: 8, 7: 9, 4: 10};
        let maxTier = maxTiers[blockUnder] || 2;
        
        let blockNames = {0: "AIR", 1: "DIRT", 3: "GRASS", 6: "COAL", 5: "IRON", 2: "GOLD", 7: "LAPIS", 4: "DIAMOND"};
        let bName = blockNames[blockUnder] || "UNKNOWN";
        
        const statusEl = document.getElementById('enchant-table-status');
        statusEl.innerText = `POWER SOURCE: ${bName} (MAX TIER ${maxTier})`;
        
        // Deterministic random seed based on position and total blocks mined
        // So mining blocks will re-roll the table options!
        let s = tx * 31 + ty * 17 + player.stats.total;
        function seededRandom() {
            let x = Math.sin(s++) * 10000;
            return x - Math.floor(x);
        }
        
        let keys = ['hp', 'speed', 'jump', 'feather', 'wealth'];
        let options = [];
        let pool = [...keys];
        for(let i=0; i<3; i++) {
            let idx = Math.floor(seededRandom() * pool.length);
            options.push(pool.splice(idx, 1)[0]);
        }
        
        options.forEach(type => {
            let curLvl = player.enchantUpgrades[type] || 0;
            let nextLvl = curLvl + 1;
            
            const row = document.createElement('div'); row.className = 'upgrade-row';
            
            if (curLvl >= 10) {
                row.innerHTML = `<span style="color:#888">${type.toUpperCase()} MAXED</span> <button class="upgrade-btn enchant-btn" disabled>MAX</button>`;
            } else if (nextLvl > maxTier) {
                // Determine the name of what they WOULD be getting to tease them
                let upgName = ENCHANTS[type][curLvl].name;
                row.innerHTML = `<span style="color:#aa5555">${upgName} (NEEDS STRONGER BLOCK)</span> <button class="upgrade-btn enchant-btn" disabled>WEAK</button>`;
            } else {
                let upg = ENCHANTS[type][curLvl];
                let canAfford = player.lapis >= upg.cost;
                row.innerHTML = `<span>${upg.name}</span> 
                    <button class="upgrade-btn enchant-btn" ${!canAfford ? 'disabled' : ''} 
                    onclick="buyEnchant('${type}', ${curLvl})">${upg.cost} LAPIS</button>`;
            }
            list.appendChild(row);
        });
    }

    function toast(message){const el=document.getElementById('game-toast');el.innerText=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),1400)}
    function addItem(type,amount){const limit=INVENTORY_LIMITS[type]??999;const before=player.inventory[type]||0;player.inventory[type]=Math.min(limit,before+amount);if(type==='lapis')player.lapis=player.inventory.lapis;const added=player.inventory[type]-before;if(added>0)toast(`+${added} ${ITEM_INFO[type]?.name||type}`);if(added<amount)toast(`${ITEM_INFO[type]?.name||type} FULL`);return added}
    window.buySapling=()=>{if(player.res<25)return;if((player.inventory.sapling||0)>=INVENTORY_LIMITS.sapling){toast('SAPLING STACK FULL');return}player.res-=25;addItem('sapling',1);renderShop();updateInventoryUI();saveLocal()};
    window.sellItem=(type,wanted)=>{if(!(type in ORE_PRICES))return;const amount=Math.min(player.inventory[type]||0,Math.max(0,Math.floor(wanted)));if(!amount)return;player.inventory[type]-=amount;const coins=amount*ORE_PRICES[type];player.res+=coins;toast(`SOLD ${amount} ${ITEM_INFO[type].name} FOR ${coins} COINS`);updateInventoryUI();renderShop();renderInventory();saveLocal()};
    window.sellAllMaterials=()=>{let total=0;for(const [type,price] of Object.entries(ORE_PRICES)){total+=(player.inventory[type]||0)*price;player.inventory[type]=0}if(total){player.res+=total;toast(`SOLD EVERYTHING FOR ${total} COINS`);updateInventoryUI();renderShop();renderInventory();saveLocal()}};
    window.toggleInventory=()=>{if(shopOpen||enchantMenuOpen||furnaceOpen)return;inventoryOpen=!inventoryOpen;document.getElementById('inventory-menu').style.display=inventoryOpen?'block':'none';if(inventoryOpen)renderInventory()};
    function renderInventory(){const grid=document.getElementById('inventory-grid');if(!grid)return;grid.replaceChildren();let used=0,total=0;for(const [type,limit] of Object.entries(INVENTORY_LIMITS)){const count=player.inventory[type]||0;used+=count;total+=limit;const b=document.createElement('button');b.className='inventory-item'+(selectedInventoryItem===type?' selected':'');b.innerHTML=`<strong>${ITEM_INFO[type]?.name||type}</strong><div class="count">${count} / ${limit}</div>`;b.onclick=()=>{selectedInventoryItem=type;renderInventoryDetails(type);renderInventory()};grid.appendChild(b)}document.getElementById('inventory-capacity').innerText=`STACK CAPACITY: ${used} ITEMS STORED`;
      if(selectedInventoryItem)renderInventoryDetails(selectedInventoryItem)}
    function renderInventoryDetails(type){const item=ITEM_INFO[type],count=player.inventory[type]||0,box=document.getElementById('inventory-details');if(!item)return;let actions='';if(type==='furnace'&&count===0)actions='<button class="upgrade-btn" onclick="craftFurnace()">CRAFT FURNACE: 20 DIRT + 10 RAW IRON</button>';else if(type==='furnace')actions='<button class="upgrade-btn" onclick="setSlot(6); toggleInventory(); toast(\'FURNACE EQUIPPED IN SLOT 6\')">EQUIP TO SLOT 6</button>';if(type in ORE_PRICES&&count)actions+=`<button class="upgrade-btn" onclick="sellItem('${type}',1)">SELL 1</button>`;box.innerHTML=`<h3>${item.name} x${count}</h3><p>${item.desc}</p>${actions}`}
    window.craftFurnace=()=>{if((player.inventory.dirt||0)<20||(player.inventory.rawIron||0)<10){toast('NEED 20 DIRT AND 10 RAW IRON');return}player.inventory.dirt-=20;player.inventory.rawIron-=10;addItem('furnace',1);renderInventory();saveLocal()};
    function getCurrentFurnace(){return worldFurnaces.find(f=>f.key===currentFurnaceKey)||null}
    window.toggleFurnace=(key=null)=>{
      if(key)currentFurnaceKey=key;
      if(shopOpen||enchantMenuOpen||inventoryOpen)return;
      if(!currentFurnaceKey){toast('INTERACT WITH A PLACED FURNACE');return}
      furnaceOpen=!furnaceOpen;
      document.getElementById('furnace-menu').style.display=furnaceOpen?'block':'none';
      if(furnaceOpen)renderFurnace();else currentFurnaceKey=null;
    };
    function furnaceReady(f){return !!(f&&f.job&&Date.now()>=f.job.finishTime)}
    function renderFurnace(){
      const f=getCurrentFurnace(),el=document.getElementById('furnace-status');
      if(!f){el.innerText='FURNACE NOT FOUND.';return}
      document.getElementById('furnace-fuel').innerText=`${f.fuel||0} COAL`;document.getElementById('furnace-input').innerText=f.job?`${f.job.amount} ${ITEM_INFO[f.job.input].name}`:'EMPTY';document.getElementById('furnace-output').innerText=f.job&&furnaceReady(f)?`${f.job.amount} ${ITEM_INFO[f.job.output].name}`:'EMPTY';
      if(!f.job)el.innerText=`FURNACE AT X ${f.tx}, Y ${f.ty} IS IDLE.`;
      else if(furnaceReady(f))el.innerText=`READY: ${f.job.amount} ${ITEM_INFO[f.job.output].name}`;
      else el.innerText=`SMELTING ${f.job.amount} ITEM(S): ${Math.max(0,Math.ceil((f.job.finishTime-Date.now())/1000))}s`;
    }
    window.startSmelting=async(input,amount)=>{
      const f=getCurrentFurnace();
      if(!f){toast('FURNACE NOT FOUND');return}
      if(f.job){toast('COLLECT THE CURRENT OUTPUT FIRST');return}
      const output=input==='rawIron'?'ironBar':input==='rawGold'?'goldBar':null;
      if(!output)return;
      if((player.inventory[input]||0)<amount){toast('NOT ENOUGH ORE');return}if((f.fuel||0)<amount){toast('ADD COAL TO THE FUEL SLOT');return}
      player.inventory[input]-=amount;f.fuel=(f.fuel||0)-amount;await db.ref('furnaces/'+f.key+'/fuel').set(f.fuel);
      const job={input,output,amount,finishTime:Date.now()+4000*amount};
      await db.ref('furnaces/'+f.key+'/job').set(job);
      f.job=job;toast('SMELTING STARTED');renderFurnace();renderInventory();saveLocal();
    };
    window.addFurnaceFuel=async amount=>{const f=getCurrentFurnace();if(!f)return;amount=Math.min(player.inventory.coal||0,Math.max(0,Math.floor(amount)));if(!amount)return;player.inventory.coal-=amount;f.fuel=(f.fuel||0)+amount;await db.ref('furnaces/'+f.key+'/fuel').set(f.fuel);renderFurnace();renderInventory();saveLocal()};
    window.removeFurnaceFuel=async()=>{const f=getCurrentFurnace();if(!f||!(f.fuel||0))return;const space=INVENTORY_LIMITS.coal-(player.inventory.coal||0),amount=Math.min(space,f.fuel);if(!amount){toast('COAL STACK FULL');return}player.inventory.coal+=amount;f.fuel-=amount;await db.ref('furnaces/'+f.key+'/fuel').set(f.fuel);renderFurnace();renderInventory();saveLocal()};
    window.collectFurnace=async()=>{
      const f=getCurrentFurnace();
      if(!f||!furnaceReady(f)){toast('NOTHING READY');return}
      const space=(INVENTORY_LIMITS[f.job.output]||999)-(player.inventory[f.job.output]||0);
      if(space<f.job.amount){toast('NOT ENOUGH INVENTORY SPACE');return}
      addItem(f.job.output,f.job.amount);
      await db.ref('furnaces/'+f.key+'/job').remove();
      delete f.job;renderFurnace();renderInventory();updateInventoryUI();saveLocal();
    };
    window.pickupFurnace=async()=>{
      const f=getCurrentFurnace();if(!f)return;
      if(f.ownerId!==myId){toast('ONLY THE OWNER CAN PICK THIS UP');return}
      if(f.job){toast('COLLECT THE FURNACE OUTPUT FIRST');return}if(f.fuel){toast('TAKE THE FUEL OUT FIRST');return}
      if((player.inventory.furnace||0)>=INVENTORY_LIMITS.furnace){toast('FURNACE STACK IS FULL');return}
      player.inventory.furnace++;await db.ref('furnaces/'+f.key).remove();
      furnaceOpen=false;currentFurnaceKey=null;document.getElementById('furnace-menu').style.display='none';
      updateInventoryUI();renderInventory();saveLocal();toast('FURNACE PICKED UP');
    };

    window.buyUpgrade = (type, index) => {
        const upg = UPGRADES[type][index];
        if (player.res >= upg.cost && player.upgrades[type] === index) {
            player.res -= upg.cost; player.upgrades[type]++;
            updateInventoryUI(); renderShop(); saveLocal();
        }
    };

    window.buyEnchant = (type, index) => {
        const upg = ENCHANTS[type][index];
        if (player.lapis >= upg.cost && player.enchantUpgrades[type] === index) {
            player.lapis -= upg.cost; player.inventory.lapis = player.lapis; player.enchantUpgrades[type]++;
            recalculateStats(); updateInventoryUI(); renderEnchantMenu(); saveLocal();
        }
    };

    window.buyEnchantTable = () => {
        if (player.res >= 1000 && !player.hasEnchantTable) {
            player.res -= 1000;
            player.hasEnchantTable = true;
            updateInventoryUI(); renderShop(); saveLocal();
        }
    }

    window.buyTorches = () => {
        if (player.res >= 15) {
            player.res -= 15; player.torchCount += 5;
            updateInventoryUI(); saveLocal();
        }
    }

    window.setHat = (hatKey) => { player.hat = hatKey; saveLocal(); };

    function drawLighting(cx, cy) {
        lctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        const depth = player.y;
        
        const darknessIntensity = Math.min(0.98, Math.max(0, (depth - 500) / 5000));
        lctx.fillStyle = `rgba(0, 0, 5, ${darknessIntensity})`;
        lctx.fillRect(0, 0, canvas.width, canvas.height);
        
        lctx.globalCompositeOperation = 'destination-out';
        
        drawLightCircle(player.x - cx + 20, player.y - cy + 25, 150);
        worldTorches.forEach(t => { drawLightCircle(t.x - cx, t.y - cy, 400); });
        for (let id in otherPlayers) { drawLightCircle(otherPlayers[id].x - cx + 20, otherPlayers[id].y - cy + 25, 120); }

        const sy = Math.max(0, Math.floor(cy/TILE_SIZE)), ey = Math.min(WORLD_HEIGHT, Math.ceil((cy+canvas.height)/TILE_SIZE));
        const sx = Math.max(0, Math.floor(cx/TILE_SIZE)), ex = Math.min(WORLD_WIDTH, Math.ceil((cx+canvas.width)/TILE_SIZE));
        
        for (let y = sy; y < ey; y++) {
            for (let x = sx; x < ex; x++) {
                const tid = gameMap[y][x];
                // Light piercing for new ores
                if ((tid === 2 || tid === 4 || tid === 5 || tid === 6 || tid === 7 || tid === 8) && isExposed(x, y)) {
                    drawLightCircle(x * TILE_SIZE - cx + 32, y * TILE_SIZE - cy + 32, 80);
                }
            }
        }

        lctx.globalCompositeOperation = 'source-over';
        for (let y = sy; y < ey; y++) {
            for (let x = sx; x < ex; x++) {
                const tid = gameMap[y][x];
                if ((tid === 2 || tid === 4 || tid === 5 || tid === 6 || tid === 7 || tid === 8) && isExposed(x, y)) {
                    const centerX = x * TILE_SIZE - cx + 32, centerY = y * TILE_SIZE - cy + 32;
                    let color = 'rgba(255, 255, 255, 0.1)';
                    if (tid === 2) color = 'rgba(255, 200, 0, 0.2)';       // Gold
                    else if (tid === 4) color = 'rgba(0, 180, 255, 0.2)';  // Diamond
                    else if (tid === 5) color = 'rgba(200, 200, 200, 0.2)';// Iron
                    else if (tid === 6) color = 'rgba(50, 50, 50, 0.4)';   // Coal
                    else if (tid === 7) color = 'rgba(50, 50, 255, 0.3)';  // Lapis
                    else if (tid === 8) color = 'rgba(200, 0, 200, 0.4)';  // Enchant Table
                    
                    const g = lctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 80);
                    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    lctx.fillStyle = g; lctx.beginPath(); lctx.arc(centerX, centerY, 80, 0, Math.PI * 2); lctx.fill();
                }
            }
        }
        ctx.drawImage(lightCanvas, 0, 0);
    }

    function drawLightCircle(x, y, radius) {
        const grad = lctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)'); grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        lctx.fillStyle = grad; lctx.beginPath(); lctx.arc(x, y, radius, 0, Math.PI * 2); lctx.fill();
    }

    function updateBombs(dt) {
      for (let i = bombs.length - 1; i >= 0; i--) {
        const b = bombs[i];
        b.fuse -= dt;
        b.vy = Math.min((b.vy || 0) + BOMB_FALL_SPEED * dt, 900);
        const nextY = b.y + b.vy * dt;
        const tx = Math.floor((b.x + 24) / TILE_SIZE);
        const ty = Math.floor((nextY + 48) / TILE_SIZE);
        if (gameMap[ty] && gameMap[ty][tx] > 0) { b.y = ty * TILE_SIZE - 48; b.vy = 0; }
        else b.y = nextY;
        if (b.fuse <= 0) {
          const ex = Math.floor((b.x + 24) / TILE_SIZE), ey = Math.floor((b.y + 24) / TILE_SIZE);
          if (b.owner === myId) db.ref('world_breaks').push({type:'area', x:ex, y:ey, radius:2, timestamp:firebase.database.ServerValue.TIMESTAMP});
          camera.shake = 14; bombs.splice(i,1);
        }
      }
    }
    function treeHasSpace(x,groundY,ignoreKey=null){
      // A tree occupies the three columns centered on x and the six tiles above its base.
      if(x<1||x>=WORLD_WIDTH-1||groundY<6||groundY>=WORLD_HEIGHT)return false;
      if(!gameMap[groundY]||gameMap[groundY][x]===0)return false;
      for(let yy=groundY-6;yy<groundY;yy++){
        for(let xx=x-1;xx<=x+1;xx++){
          if(gameMap[yy]?.[xx]>0)return false;
          if(worldFurnaces.some(f=>f.tx===xx&&f.ty===yy))return false;
        }
      }
      return !worldTrees.some(t=>t.key!==ignoreKey&&Math.abs(t.x-x)<3&&Math.abs(t.groundY-groundY)<6);
    }
    function treeParts(t){
      const grown=Date.now()>=t.growAt;
      if(!grown)return[{x:t.x,y:t.groundY-1,type:'sapling'}];
      const parts=[];
      for(let y=t.groundY-1;y>=t.groundY-4;y--)parts.push({x:t.x,y,type:'wood'});
      for(let y=t.groundY-6;y<=t.groundY-3;y++){
        for(let x=t.x-1;x<=t.x+1;x++){
          if(!(y===t.groundY-6&&x!==t.x))parts.push({x,y,type:'leaves'});
        }
      }
      return parts;
    }
    function treeAt(x,y){for(const t of worldTrees)if(treeParts(t).some(p=>p.x===x&&p.y===y))return t;return null}
    async function chopTree(t){const grown=Date.now()>=t.growAt;if(grown){addItem('wood',5);if(Math.random()<.45)addItem('sapling',1)}else addItem('sapling',1);await db.ref('trees/'+t.key).remove();updateInventoryUI();renderInventory();saveLocal()}

    function update(dt) {
      const remoteBlend=1-Math.exp(-14*dt), now=performance.now();
      for(const id in otherPlayers){const op=otherPlayers[id];const age=Math.min((now-(op.receivedAt||now))/1000,.16);const dx=op.targetX+(op.vx||0)*age,dy=op.targetY+(op.vy||0)*age;const dist=Math.hypot(dx-op.x,dy-op.y);if(dist>TILE_SIZE*8){op.x=op.targetX;op.y=op.targetY}else{op.x+=(dx-op.x)*remoteBlend;op.y+=(dy-op.y)*remoteBlend}}
      if (shopOpen || inventoryOpen || furnaceOpen || enchantMenuOpen || achievementMenuOpen || infoMenuOpen || !isMapLoaded || isTyping) return;
      if (player.hp < player.maxHp) {
        player.hp += 1 * dt; 
        if (player.hp > player.maxHp) player.hp = player.maxHp;
        updateHealthUI(); 
      }

      
      player.vy += player.gravity * dt;
      player.isMoving = false;
      player.isMining = false;
      player.isCrouching = keys['s'] && player.onGround;
      let moveDirection = 0;
      if (!keys['shift'] && keys['a']) moveDirection--;
      if (!keys['shift'] && keys['d']) moveDirection++;
      const targetVx = moveDirection * player.moveSpeed;
      const rate = moveDirection === 0 ? player.moveDeceleration : player.moveAcceleration;
      const change = rate * dt;
      const difference = targetVx - player.vx;
      player.vx = Math.abs(difference) <= change ? targetVx : player.vx + Math.sign(difference) * change;
      if (moveDirection) { player.dir='side'; player.isMoving=true; player.flip=moveDirection<0; }

      if (keys['shift']) {
          if (player.selectedSlot === 2) {
              player.isMining = true; 
              
          } else {
              let mx = 0, my = 0;
              let isDir = false;
              if (keys['w']) { my = -1; player.dir = 'up'; isDir = true; }
              else if (keys['s']) { my = 1; player.dir = 'down'; isDir = true; }
              else if (keys['a']) { mx = -1; player.dir = 'side'; isDir = true; }
              else if (keys['d']) { mx = 1; player.dir = 'side'; isDir = true; }

              const tx = Math.floor((player.x + player.w/2 + mx*40)/TILE_SIZE);
              const ty = Math.floor((player.y + player.h/2 + my*40)/TILE_SIZE);
              const hit = gameMap[ty] ? gameMap[ty][tx] : 0;
              const targetedTree = treeAt(tx,ty);
              if(player.selectedSlot===1 && targetedTree && isDir){chopTree(targetedTree);keys['shift']=false;return;}
              
              // SLOT 1: PICKAXE
              if (player.selectedSlot === 1 && hit > 0 && isDir) {
                  player.isMining = true; camera.shake = 2;
                  let pwr = player.upgrades.efficiency > 0 ? UPGRADES.efficiency[player.upgrades.efficiency - 1].power : 1;
                  let hard = ((hit === 4 ? 400 : hit === 2 ? 150 : hit === 8 ? 200 : 50) + (Math.floor(ty / 20) * 30)) / pwr;
                  miningProgress += (dt * 65);
                  
                  if (miningProgress >= hard) {
                    player.stats.total++;
                    if (hit === 8) {
                        player.hasEnchantTable = true;
                        db.ref('world_breaks').push({ type: 'single', x: tx, y: ty, timestamp: firebase.database.ServerValue.TIMESTAMP });
                    } else {
                        const types={4:'diamond',2:'rawGold',5:'rawIron',6:'coal',7:'lapis'};
                        const type=types[hit]||'dirt';
                        const statType={rawGold:'gold',rawIron:'iron'}[type]||type;
                        const fortune=player.upgrades.fortune>0?UPGRADES.fortune[player.upgrades.fortune-1].chance:0;
                        const amount=Math.random()<fortune?2:1;
                        player.stats[statType]=(player.stats[statType]||0)+amount;
                        addItem(type,amount);
                        checkAchievements();
                        db.ref('world_breaks').push({type:'single',x:tx,y:ty,timestamp:firebase.database.ServerValue.TIMESTAMP});
                    }
                    updateInventoryUI(); miningProgress = 0; saveLocal();
                  }
              } 
              // SLOT 3: HAND/TABLE
              else if (player.selectedSlot === 3 && isDir) {
                  if (hit === 8) {
                      toggleEnchantMenu(tx, ty);
                      keys['shift'] = false; 
                  } else if (hit === 0 && my === 0 && player.hasEnchantTable) {
                      db.ref('world_breaks').push({ type: 'place', x: tx, y: ty, block: 8, timestamp: firebase.database.ServerValue.TIMESTAMP });
                      player.hasEnchantTable = false;
                      updateInventoryUI(); saveLocal();
                      keys['shift'] = false;
                  }
              }
              // SLOT 7: SAPLING (surface planting)
              else if (player.selectedSlot === 7 && isDir) {
                  const plantX=tx;
                  const groundY=ty+1;
                  if((player.inventory.sapling||0)<1){toast('NO SAPLINGS');keys['shift']=false;}
                  else if(hit!==0 || !gameMap[groundY] || gameMap[groundY][plantX]===0){toast('PLANT THE SAPLING ON TOP OF A BLOCK');keys['shift']=false;}
                  else if(!treeHasSpace(plantX,groundY)){toast('TREE NEEDS A CLEAR 3x6 SPACE');keys['shift']=false;}
                  else {player.inventory.sapling--;const growAt=Date.now()+45000+Math.floor(Math.random()*75001);db.ref('trees').push({x:plantX,groundY,growAt,ownerId:myId});updateInventoryUI();renderInventory();saveLocal();toast('SAPLING PLANTED');keys['shift']=false;}
              }
              // SLOT 6: FURNACE (Place / Interact)
              else if (player.selectedSlot === 6 && isDir) {
                  const placed = worldFurnaces.find(f => f.tx === tx && f.ty === ty);
                  if (placed) {
                      currentFurnaceKey = placed.key;
                      toggleFurnace(placed.key);
                      keys['shift'] = false;
                  } else if (hit === 0 && (player.inventory.furnace || 0) > 0) {
                      player.inventory.furnace--;
                      db.ref('furnaces').push({ tx, ty, ownerId: myId, ownerName: player.username, fuel: 0, placedAt: firebase.database.ServerValue.TIMESTAMP });
                      updateInventoryUI(); renderInventory(); saveLocal(); toast('FURNACE PLACED');
                      keys['shift'] = false;
                  }
              }
              // SLOT 4: DIRT (Placing)
              else if (player.selectedSlot === 4 && isDir) {
                  if (hit === 0 && player.inventory.dirt > 0) {
                      db.ref('world_breaks').push({ type: 'place', x: tx, y: ty, block: 1, timestamp: firebase.database.ServerValue.TIMESTAMP });
                      player.inventory.dirt--;
                      updateInventoryUI(); saveLocal();
                      keys['shift'] = false;
                  }
              }
              // SLOT 5: TORCH (Placing/Picking up)
              else if (player.selectedSlot === 5) {
                  let pickedUp = false;
                  for (let i = worldTorches.length - 1; i >= 0; i--) {
                      const t = worldTorches[i];
                      const ttx = Math.floor(t.x / TILE_SIZE);
                      const tty = Math.floor(t.y / TILE_SIZE);
                      if (ttx === tx && tty === ty) {
                          if (t.key) db.ref('torches/' + t.key).remove();
                          worldTorches.splice(i, 1); player.inventory.torch++; updateInventoryUI(); saveLocal(); pickedUp = true; break; 
                      }
                  }
                  if (!pickedUp && hit === 0 && player.inventory.torch > 0) {
                      db.ref('torches').push({ x: tx * TILE_SIZE + 32, y: ty * TILE_SIZE + 32 });
                      player.inventory.torch--; updateInventoryUI(); saveLocal();
                  }
                  keys['shift'] = false; // Prevent accidentally dropping all your torches in one tick
              }
          }
      } else { miningProgress = 0; }

      let nextX = player.x + player.vx * dt;
      let nextY = player.y + player.vy * dt;
      player.onGround = false;
      const hitY = checkCollision(player.x, nextY);
      if (hitY) {
          if (player.vy > 0) { player.y = hitY.y * TILE_SIZE - player.h; player.onGround = true; player.jumpCount = 0; }
          else { player.y = (hitY.y + 1) * TILE_SIZE; }
          player.vy = 0;
      } else { player.y = nextY; }
      const hitX = checkCollision(nextX, player.y);
      if (hitX) { player.vx = 0; } else { player.x = nextX; }

      if (keys['b']) { 
          keys['b'] = false; 
          if (player.res >= BOMB_COST) {
              player.res -= BOMB_COST; updateInventoryUI();
              const bomb = { x: player.x + player.w/2 - 24, y: player.y, vy: 0, fuse: 2.5, owner: myId };
              bombs.push(bomb);
              db.ref('bomb_drops').push({ x: bomb.x, y: bomb.y, id: myId, timestamp: firebase.database.ServerValue.TIMESTAMP })
                .then(ref => setTimeout(() => ref.remove(), 10000));
              saveLocal();
          }
      }
      if (keys['n']) {
          keys['n'] = false;
          if (player.res >= DYNAMITE_COST) {
              player.res -= DYNAMITE_COST; updateInventoryUI();
              db.ref('world_breaks').push({ type: 'area', x: Math.floor((player.x+20)/TILE_SIZE), y: Math.floor((player.y+20)/TILE_SIZE), radius: 1, timestamp: firebase.database.ServerValue.TIMESTAMP });
          }
      }

      updateBombs(dt);
      const cameraBlend=1-Math.exp(-10*dt); camera.x+=(player.x-camera.x)*cameraBlend; camera.y+=(player.y-camera.y)*cameraBlend;
      if (camera.shake > 0) camera.shake *= 0.9;
      const curDepth = Math.floor(player.y / TILE_SIZE);
      if (curDepth > player.stats.maxDepth) { player.stats.maxDepth = curDepth; checkAchievements(); }
      document.getElementById('coords').innerText = `X: ${Math.floor(player.x/TILE_SIZE)} Y: ${curDepth}`;
    }

    function checkCollision(nx, ny) {
      const e=.001,l=Math.floor(nx/TILE_SIZE),r=Math.floor((nx+player.w-e)/TILE_SIZE),t=Math.floor(ny/TILE_SIZE),b=Math.floor((ny+player.h-e)/TILE_SIZE);
      for (let i=l; i<=r; i++) for (let j=t; j<=b; j++) if (gameMap[j] && gameMap[j][i] > 0) return {x:i, y:j, type:gameMap[j][i]};
      return null;
    }

    function isExposed(x, y) {
      if (y <= 12) return true;
      const ns = [[0,-1], [0,1], [-1,0], [1,0]];
      for (let [dx, dy] of ns) { if (gameMap[y+dy] && gameMap[y+dy][x+dx] === 0) return true; }
      return false;
    }

    function drawSprite(p, cx, cy) {
      const frame = Math.floor(Date.now()/200)%2;
      let img = sprites.idle;
      if (p.isMining) img = sprites.miningSide[frame];
      else if (!p.onGround) img = p.vy < 0 ? sprites.up : sprites.fall;
      else if (p.isCrouching) img = sprites.crouch;
      else if (p.isMoving) img = sprites.walk[frame];
      if (!img.complete) return;
      ctx.save(); ctx.translate(p.x-cx+20, p.y-cy+25);
      ctx.fillStyle = "#fff"; ctx.font = "14px 'MinecraftSeven'"; ctx.textAlign = "center"; 
      ctx.fillText(p.username.toUpperCase(), 0, -45);
      if (p.flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -28, -28, 56, 56);
      const h = sprites.hats[p.hat]; if (h && h.complete) ctx.drawImage(h, -15, -35, 30, 30);
      ctx.restore();
    }

    

    function drawIndicator(p, cx, cy) {
        const screenX = p.x - cx + 20, screenY = p.y - cy + 20, margin = 40;
        if (screenX < 0 || screenX > canvas.width || screenY < 0 || screenY > canvas.height) {
            const edgeX = Math.max(margin, Math.min(canvas.width - margin, screenX)), edgeY = Math.max(margin, Math.min(canvas.height - margin, screenY));
            const dx = p.x - player.x, dy = p.y - player.y, dist = Math.floor(Math.sqrt(dx*dx + dy*dy) / TILE_SIZE);
            ctx.save(); ctx.translate(edgeX, edgeY);
            const angle = Math.atan2(screenY - edgeY, screenX - edgeX);
            ctx.rotate(angle); ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, -7); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill();
            ctx.rotate(-angle); ctx.font = "12px 'MinecraftSeven'"; ctx.fillStyle = "#fff"; ctx.textAlign = "center";
            ctx.fillText(`${p.username.toUpperCase()}`, 0, -15); ctx.fillStyle = "#aaa"; ctx.fillText(`${dist}m`, 0, 25); ctx.restore();
        }
    }

    function draw(t) {
      const dt = Math.min((t - lastTime) / 1000, 0.1); lastTime = t;
      update(dt);
      ctx.fillStyle = "#0f0f1b"; ctx.fillRect(0,0,canvas.width,canvas.height);
      if (!isMapLoaded) { 
          ctx.fillStyle="#fff"; ctx.font = "20px 'MinecraftSeven'";
          ctx.fillText("SYNCING SYSTEM...", canvas.width/2-100, canvas.height/2); 
          return requestAnimationFrame(draw); 
      }
      const cx = camera.x - canvas.width/2 + (Math.random()*camera.shake), cy = camera.y - canvas.height/2 + (Math.random()*camera.shake);
      const sy = Math.max(0, Math.floor(cy/TILE_SIZE)), ey = Math.min(WORLD_HEIGHT, Math.ceil((cy+canvas.height)/TILE_SIZE));
      const sx = Math.max(0, Math.floor(cx/TILE_SIZE)), ex = Math.min(WORLD_WIDTH, Math.ceil((cx+canvas.width)/TILE_SIZE));
      
      for (let y=sy; y<ey; y++) {
        for (let x=sx; x<ex; x++) {
          if (gameMap[y][x] > 0) {
            let img = sprites.hidden;
            if (isExposed(x, y)) {
              const tid = gameMap[y][x];
              if (tid === 3) img = sprites.top; 
              else if (tid === 2) img = sprites.ore; 
              else if (tid === 4) img = sprites.diamond;
              else if (tid === 5) img = sprites.iron;
              else if (tid === 6) img = sprites.coal;
              else if (tid === 7) img = sprites.lapis;
              else if (tid === 8) img = sprites.enchantTable;
              else img = sprites.surfaceVariants[Math.round((tid-1)*10)] || sprites.surfaceVariants[0];
            }
            if (img.complete) {
                // Apply color tints dynamically if base textures are being reused for new items
                ctx.save();
                ctx.drawImage(img, x*TILE_SIZE-cx, y*TILE_SIZE-cy, TILE_SIZE, TILE_SIZE);
                
                ctx.restore();
            }
          }
        }
      }
      worldTrees.forEach(t=>treeParts(t).forEach(part=>{const x=part.x*TILE_SIZE-cx,y=part.y*TILE_SIZE-cy;ctx.save();if(part.type==='wood'){ctx.fillStyle='#7a4b25';ctx.fillRect(x+18,y,28,TILE_SIZE);ctx.fillStyle='#9b6434';ctx.fillRect(x+24,y,7,TILE_SIZE)}else if(part.type==='leaves'){ctx.fillStyle='#2d7a39';ctx.fillRect(x+3,y+3,TILE_SIZE-6,TILE_SIZE-6);ctx.fillStyle='#47a34f';ctx.fillRect(x+10,y+10,16,16)}else{ctx.fillStyle='#79502a';ctx.fillRect(x+29,y+34,6,26);ctx.fillStyle='#45a34b';ctx.fillRect(x+15,y+14,34,25)}ctx.restore()}));
      worldTorches.forEach(t => { if (sprites.torch.complete) ctx.drawImage(sprites.torch, t.x - cx - 16, t.y - cy - 16, 32, 32); });
      worldFurnaces.forEach(f => {
        const x=f.tx*TILE_SIZE-cx, y=f.ty*TILE_SIZE-cy;
        ctx.save();
        ctx.fillStyle='#4a4a4a';ctx.fillRect(x+4,y+4,TILE_SIZE-8,TILE_SIZE-8);
        ctx.strokeStyle=furnaceReady(f)?'#ff9a22':'#888';ctx.lineWidth=3;ctx.strokeRect(x+5,y+5,TILE_SIZE-10,TILE_SIZE-10);
        ctx.fillStyle=furnaceReady(f)?'#ff6a00':'#171717';ctx.fillRect(x+17,y+34,30,18);
        ctx.fillStyle='#222';ctx.fillRect(x+14,y+13,36,13);
        ctx.restore();
      });
      bombs.forEach(b => { if (sprites.bomb.complete) ctx.drawImage(sprites.bomb, b.x - cx, b.y - cy, 48, 48); });
      
      for (let id in otherPlayers) { drawSprite(otherPlayers[id], cx, cy); drawIndicator(otherPlayers[id], cx, cy); }
      drawSprite(player, cx, cy);
      drawLighting(cx, cy);
      requestAnimationFrame(draw);
    }

    window.onkeydown = (e) => { 
        if (e.key === 'Tab') { e.preventDefault(); document.getElementById('user-list-overlay').style.display = 'block'; renderUserList(); return; }
        if (e.key.toLowerCase() === 't' && !isTyping && !shopOpen && !enchantMenuOpen && !infoMenuOpen) { e.preventDefault(); isTyping = true; chatContainer.classList.add('active'); chatInput.style.display = 'block'; chatInput.focus(); return; }
        if (e.key === 'Enter' && isTyping) { sendChatMessage(chatInput.value); chatInput.value = ''; chatInput.blur(); chatInput.style.display = 'none'; chatContainer.classList.remove('active'); isTyping = false; return; }
        if (e.key === 'Escape') { 
            if (isTyping) { chatInput.value = ''; chatInput.blur(); chatInput.style.display = 'none'; chatContainer.classList.remove('active'); isTyping = false; } 
            else if (inventoryOpen) toggleInventory();
            else if (furnaceOpen) toggleFurnace();
            else if (shopOpen) toggleShop(); 
            else if (enchantMenuOpen) toggleEnchantMenu(); 
            else if (achievementMenuOpen) toggleAchievementMenu();
            else if (infoMenuOpen) toggleInfoMenu();
            return; 
        }
        if (isTyping) return;
        keys[e.key.toLowerCase()] = true; 
        if (e.key === ' ') {
            e.preventDefault();
            const wallLeft = checkCollision(player.x - 10, player.y) || checkCollision(player.x - 10, player.y + player.h - 1);
            const wallRight = checkCollision(player.x + player.w + 10, player.y) || checkCollision(player.x + player.w + 10, player.y + player.h - 1);
            if (player.onGround) { player.vy = player.jumpForce; player.jumpCount = 1; }
            else if (wallLeft || wallRight) { player.vy = player.jumpForce; player.vx = wallLeft ? player.moveSpeed : -player.moveSpeed; player.flip = wallLeft ? false : true; }
            else if (player.jumpCount < 2) { player.vy = player.jumpForce; player.jumpCount = 2; }
        }

        if (e.key.toLowerCase() === 'e') toggleShop();
        if (e.key.toLowerCase() === 'i') toggleInventory();
        
        // Inventory Selection
        if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
            setSlot(parseInt(e.key));
        } else if (e.key === '0') {
            setSlot(10);
        }

        if (e.key === "Shift") e.preventDefault();
    };
    window.onkeyup = (e) => { if (e.key === 'Tab') { e.preventDefault(); document.getElementById('user-list-overlay').style.display = 'none'; return; } keys[e.key.toLowerCase()] = false; }
    window.addEventListener('pagehide', () => { saveLocal(); myPlayerRef.remove(); });
    initOrSyncMap(); requestAnimationFrame(draw);
