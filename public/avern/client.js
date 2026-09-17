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
    const WORLD_HEIGHT = 10000; 
    const SEED = 12345;
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

    const firebaseConfig = { databaseURL: "https://avern-game-default-rtdb.firebaseio.com" };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    const ORE_PRICES = { coal: 2, iron: 10, gold: 20, diamond: 75 };

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
        // Ores are now inventory items. Stats remain lifetime totals for achievements.
        ores: savedData.ores || {
            dirt: savedData.stats?.dirt || 0,
            gold: savedData.stats?.gold || 0,
            diamond: savedData.stats?.diamond || 0,
            iron: savedData.stats?.iron || 0,
            coal: savedData.stats?.coal || 0
        },
        achieved: savedData.achieved || []
    };

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
    let currentEnchantTable = null;

    const chatContainer = document.getElementById('chat-container');
    const chatBox = document.getElementById('chat-box');
    const chatInput = document.getElementById('chat-input');
    let isTyping = false;

    function initOrSyncMap() {
        let s = SEED;
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            gameMap[y] = [];
            for (let x = 0; x < WORLD_WIDTH; x++) {
                let r = Math.sin(s++) * 10000; r = r - Math.floor(r);
                if (y < 12) gameMap[y][x] = 0; 
                else if (y === 12) gameMap[y][x] = 3; 
                else {
                    let block = 1 + (Math.floor(r * 3) / 10); // default dirt
                    
                    // Diamond (4): 5000 - 8500 (Rarer: r > 0.995)
                    if (y >= 5000 && y <= 8500 && r > 0.995) block = 4;
                    // Lapis (7): 500 - 9000
                    else if (y >= 500 && y <= 9000 && r > 0.985) block = 7;
                    // Gold (2): 100 - 7500
                    else if (y >= 100 && y <= 7500 && r > 0.96) block = 2;
                    // Iron (5): 1000 - 10000 (Spread out)
                    else if (y >= 1000 && y <= 10000 && r > 0.94) block = 5;
                    // Coal (6): 40 - 5000 (More common the deeper you are in its range)
                    else if (y >= 40 && y <= 5000) {
                        let depthFactor = (y - 40) / 4960;
                        let chanceThreshold = 0.95 - (depthFactor * 0.1); // becomes more common deeper
                        if (r > chanceThreshold) block = 6;
                    }
                    
                    gameMap[y][x] = block;
                }
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
        document.getElementById('inv-gold').innerText = player.ores.gold || 0;
        document.getElementById('inv-lapis').innerText = player.lapis;
    }

    function updateTorchUI() { 
        document.getElementById('inv-torch').innerText = player.torchCount; 
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
            onGround: player.onGround, vy: Math.round(player.vy),
            isCrouching: player.isCrouching, hp: Math.round(player.hp)
        };
        const comparable = JSON.stringify({...state, lastSeen: 0});
        if (comparable !== lastSentPlayer) {
            myPlayerRef.update(state);
            lastSentPlayer = comparable;
        }
    }, 50);
    function syncRemotePlayer(id, data) {
        if (id === myId || !data || !Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
        data.username = String(data.username || 'Miner').slice(0, 16);
        const receivedAt = performance.now();

        if (!otherPlayers[id]) {
            otherPlayers[id] = {
                ...data,
                x: data.x,
                y: data.y,
                snapshots: [{ x: data.x, y: data.y, time: receivedAt }]
            };
        } else {
            const op = otherPlayers[id];
            const { x, y, ...remoteState } = data;
            Object.assign(op, remoteState);

            if (!op.snapshots) op.snapshots = [];
            const previous = op.snapshots[op.snapshots.length - 1];
            if (!previous || previous.x !== x || previous.y !== y) {
                op.snapshots.push({ x, y, time: receivedAt });
            }

            // Keep only a short history so interpolation remains lightweight.
            const oldestUsefulTime = receivedAt - 1000;
            while (op.snapshots.length > 2 && op.snapshots[1].time < oldestUsefulTime) {
                op.snapshots.shift();
            }
        }

        if (document.getElementById('user-list-overlay').style.display === 'block') renderUserList();
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
            id: myId, x: player.x, y: player.y, res: player.res, lapis: player.lapis,
            torchCount: player.torchCount, hasEnchantTable: player.hasEnchantTable, enchantUpgrades: player.enchantUpgrades,
            username: player.username, upgrades: player.upgrades, 
            hat: player.hat, hp: player.hp, stats: player.stats, ores: player.ores, achieved: player.achieved
        }));
    }
    setInterval(saveLocal, 5000);

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

        document.getElementById('inv-dirt').innerText = player.ores.dirt || 0;
        document.getElementById('inv-iron').innerText = player.ores.iron || 0;
        document.getElementById('inv-diamond').innerText = player.ores.diamond || 0;
        document.getElementById('inv-coal').innerText = player.ores.coal || 0;
        
        updateResUI();
        updateTorchUI();
    }

    function toggleShop() {
        if (isTyping || enchantMenuOpen) return;
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
        const shopTitle = document.querySelector('#shop h2');
        if (shopTitle) shopTitle.innerText = `VILLAGE TRADER - ${player.res} GOLD`;
        const effList = document.getElementById('eff-list');
        const fortList = document.getElementById('fort-list');
        effList.innerHTML = ''; fortList.innerHTML = '';
        
        let sellSection = document.getElementById('ore-sell-section');
        if (!sellSection) {
            sellSection = document.createElement('div');
            sellSection.id = 'ore-sell-section';
            sellSection.className = 'upgrade-section';
            const firstSection = document.querySelector('#shop .upgrade-section');
            document.getElementById('shop').insertBefore(sellSection, firstSection);
        }
        sellSection.innerHTML = '<h3>Sell Ores</h3>';
        const oreNames = { coal: 'COAL', iron: 'IRON', gold: 'GOLD ORE', diamond: 'DIAMOND' };
        Object.keys(ORE_PRICES).forEach(type => {
            const amount = player.ores[type] || 0;
            const row = document.createElement('div');
            row.className = 'upgrade-row';
            row.innerHTML = `<span>${oreNames[type]}: ${amount} (${ORE_PRICES[type]} GOLD EACH)</span>
                <span><button class="upgrade-btn" ${amount < 1 ? 'disabled' : ''} onclick="sellOre('${type}', 1)">SELL 1</button>
                <button class="upgrade-btn" ${amount < 1 ? 'disabled' : ''} onclick="sellOre('${type}', ${amount})">SELL ALL</button></span>`;
            sellSection.appendChild(row);
        });

        const btnBuyEnchant = document.getElementById('btn-buy-enchant');
        if (player.hasEnchantTable) {
            btnBuyEnchant.innerText = "OWNED"; btnBuyEnchant.disabled = true;
        } else {
            btnBuyEnchant.innerText = "1000 GOLD"; btnBuyEnchant.disabled = player.res < 1000;
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

    window.sellOre = (type, requestedAmount) => {
        if (!Object.prototype.hasOwnProperty.call(ORE_PRICES, type)) return;
        const owned = player.ores[type] || 0;
        const amount = Math.max(0, Math.min(owned, Math.floor(requestedAmount)));
        if (amount < 1) return;
        player.ores[type] -= amount;
        player.res += amount * ORE_PRICES[type];
        updateInventoryUI();
        renderShop();
        saveLocal();
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
            player.lapis -= upg.cost; player.enchantUpgrades[type]++;
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
    function update(dt) {
      // Render remote players slightly behind real time. This gives us two
      // confirmed network positions to interpolate between instead of chasing
      // each new update, which removes the remaining Firebase jitter.
      const interpolationDelay = 85;
      const renderTime = performance.now() - interpolationDelay;

      for (const id in otherPlayers) {
        const op = otherPlayers[id];
        const snapshots = op.snapshots || [];
        if (snapshots.length === 0) continue;

        while (snapshots.length >= 2 && snapshots[1].time <= renderTime) {
          snapshots.shift();
        }

        if (snapshots.length >= 2) {
          const from = snapshots[0];
          const to = snapshots[1];
          const duration = Math.max(1, to.time - from.time);
          const blend = Math.max(0, Math.min(1, (renderTime - from.time) / duration));
          const smoothBlend = blend * blend * (3 - 2 * blend);
          op.x = from.x + (to.x - from.x) * smoothBlend;
          op.y = from.y + (to.y - from.y) * smoothBlend;
        } else {
          const latest = snapshots[0];
          const distance = Math.hypot(latest.x - op.x, latest.y - op.y);
          if (distance > TILE_SIZE * 8) {
            op.x = latest.x;
            op.y = latest.y;
          }
        }
      }

      if (shopOpen || enchantMenuOpen || achievementMenuOpen || infoMenuOpen || !isMapLoaded || isTyping) return;
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
      if (!keys['shift'] && keys['a']) moveDirection -= 1;
      if (!keys['shift'] && keys['d']) moveDirection += 1;

      const targetVx = moveDirection * player.moveSpeed;
      const rate = moveDirection === 0 ? player.moveDeceleration : player.moveAcceleration;
      const maxVelocityChange = rate * dt;
      const velocityDifference = targetVx - player.vx;
      if (Math.abs(velocityDifference) <= maxVelocityChange) player.vx = targetVx;
      else player.vx += Math.sign(velocityDifference) * maxVelocityChange;

      if (moveDirection !== 0) {
          player.dir = 'side';
          player.isMoving = true;
          player.flip = moveDirection < 0;
      }

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
                        const oreTypes = { 4: 'diamond', 2: 'gold', 5: 'iron', 6: 'coal' };
                        const oreType = oreTypes[hit];
                        const fortuneChance = player.upgrades.fortune > 0 ? UPGRADES.fortune[player.upgrades.fortune - 1].chance : 0;
                        const multiplier = Math.random() < fortuneChance ? 2 : 1;
                        const wealthMult = player.enchantUpgrades.wealth > 0 ? ENCHANTS.wealth[player.enchantUpgrades.wealth - 1].val : 1;
                        const amountFound = Math.max(1, Math.floor(multiplier * wealthMult));

                        if (oreType) {
                            player.stats[oreType] += amountFound;
                            player.ores[oreType] += amountFound;
                        } else if (hit === 7) {
                            player.stats.lapis += amountFound;
                            player.lapis += amountFound;
                        } else {
                            player.stats.dirt += amountFound;
                            player.ores.dirt += amountFound;
                        }

                        checkAchievements();
                        db.ref('world_breaks').push({ type: 'single', x: tx, y: ty, timestamp: firebase.database.ServerValue.TIMESTAMP });
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
              // SLOT 4: DIRT (Placing)
              else if (player.selectedSlot === 4 && isDir) {
                  if (hit === 0 && player.ores.dirt > 0) {
                      db.ref('world_breaks').push({ type: 'place', x: tx, y: ty, block: 1, timestamp: firebase.database.ServerValue.TIMESTAMP });
                      player.ores.dirt--;
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
                          worldTorches.splice(i, 1); player.torchCount++; updateInventoryUI(); saveLocal(); pickedUp = true; break; 
                      }
                  }
                  if (!pickedUp && hit === 0 && player.torchCount > 0) {
                      db.ref('torches').push({ x: tx * TILE_SIZE + 32, y: ty * TILE_SIZE + 32 });
                      player.torchCount--; updateInventoryUI(); saveLocal();
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
      const cameraFollow = 1 - Math.exp(-10 * dt);
      camera.x += (player.x - camera.x) * cameraFollow;
      camera.y += (player.y - camera.y) * cameraFollow;
      if (camera.shake > 0) camera.shake *= 0.9;
      const curDepth = Math.floor(player.y / TILE_SIZE);
      if (curDepth > player.stats.maxDepth) { player.stats.maxDepth = curDepth; checkAchievements(); }
      document.getElementById('coords').innerText = `X: ${Math.floor(player.x/TILE_SIZE)} Y: ${curDepth}`;
    }

    function checkCollision(nx, ny) {
      const edgePadding = 0.001;
      const l = Math.floor(nx / TILE_SIZE);
      const r = Math.floor((nx + player.w - edgePadding) / TILE_SIZE);
      const t = Math.floor(ny / TILE_SIZE);
      const b = Math.floor((ny + player.h - edgePadding) / TILE_SIZE);
      for (let i = l; i <= r; i++) {
        for (let j = t; j <= b; j++) {
          if (gameMap[j] && gameMap[j][i] > 0) return { x:i, y:j, type:gameMap[j][i] };
        }
      }
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
      worldTorches.forEach(t => { if (sprites.torch.complete) ctx.drawImage(sprites.torch, t.x - cx - 16, t.y - cy - 16, 32, 32); });
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

        if (e.key === 'e') toggleShop();
        
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
