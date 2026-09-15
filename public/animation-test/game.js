const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;


const keys = {};
window.addEventListener('keydown', (e) => keys[e.key] = true);
window.addEventListener('keyup', (e) => keys[e.key] = false);
window.addEventListener('blur', () => {
    for (let key in keys){
        keys[key] = false;
    
    }
});

let x = 200;
let facing = 'right'; //tracks the diriction
let y = 200;
let velocityY = 0;     // Current upward or downward movement speed
const gravity = 0.8;   // The downward pull added every frame
const jumpForce = -12; // Initial upward launch speed (negative = UP)
const groundY = 400;   // The y-coordinate where the floor sits
let isGrounded = false; // Prevents air jumping
let crouched = false;
let blocking = false;


const speed = 10;
const animationPaths ={ 
    idle: [
    'assets/sprites/bagman/idle1.png',
    'assets/sprites/bagman/idle2.png'
],

    walk: [
    'assets/sprites/bagman/idle1.png',
    'assets/sprites/bagman/idle2.png'
],
    jump: [
        'assets/sprites/bagman/jump1.png'
    ],
    crouch:[
        'assets/sprites/bagman/crouch.png' 
    ],
    fall: [
        'assets/sprites/bagman/fall.png'
    ],
    block: [
        'assets/sprites/bagman/block.png'
    ]
};


const animations = { idle: [], walk: [], jump: [], fall: [], crouch: [], block: [] };
let loadedCount = 0;
let totalImages = animationPaths.idle.length + animationPaths.walk.length + animationPaths.jump.length + animationPaths.fall.length + animationPaths.crouch.length + animationPaths.block.length;  //adds all images together for preloading

function loadCategory(category) {       //reusable animaton loader
    animationPaths[category].forEach((path) => {
        const img = new Image();
        img.src = path;
        img.onload = () => {
            loadedCount++;
            if (loadedCount === totalImages) {
                requestAnimationFrame(gameLoop);
            }
        };
        animations[category].push(img);
    });
}

loadCategory('idle'); //upload every image in folder
loadCategory('walk');
loadCategory('jump');
loadCategory('fall');
loadCategory('crouch');
loadCategory('block');






// 4. ANIMATION STATE ENGINE
let currentState = 'idle';
let currentFrameIndex = 0;
let frameCounter = 0;
const frameDelay = 10;

function gameLoop() {
    // A. CHECK MOVEMENTS
    let isMoving = false;

    //chck for jum
    if ((keys[' '] || keys['w'] || keys['W'] || keys['ArrowUp'])&& isGrounded){
        velocityY =jumpForce //change y velocity to the jump force varible
        isGrounded = false//set isgrounded to false so player cant jump in air
    };

    velocityY += gravity; //every frame pulls down
    y += velocityY; //update y pos

    if (y >= groundY) {
        y = groundY;
        velocityY = 0;
        isGrounded = true;
    }

    //check to see if block/crouch keys are pressed
    crouched = keys['ArrowDown'] || keys['s'] || keys['S'] || keys['Shift']
    blocking = keys['q'] || keys['Q'] || keys['/']

    //facing dirictions
    if (keys['ArrowRight'] || keys['d'] || keys['D']) facing = 'left';     
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) facing = 'right';
    
    //if not crouched, and move keys are pressed, move.
    if (!crouched && !blocking) {
            //right
            if (keys['ArrowRight'] || keys['d'] || keys['D']) {
               x += speed;
              isMoving = true;
             }//left
             if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
                 x -= speed;
                 isMoving = true;
            }
    }

    //revert to this state if nothing
    let newState = 'idle';
//if not isGrounded, and velocity is less than what is needed to be going upwards, st state to fall
if (!isGrounded) {
    newState = velocityY < 0 ? 'jump' : 'fall';
} else if (crouched){       //if crouched, set etate to crouch
    newState = 'crouch';
}else if (blocking){        //if blocking, set the state to blocking
    newState = 'block';
}else if (isMoving) {       // if moving, set state to walk 
    newState = 'walk';
}
//okay so i think this is like, let the state be idle, but if ur not grounded, the animation is jump. if its not that, then it goes to if ur moving. if you are, then you are doing the move animation, if not revert to idle




    if (newState !== currentState) {
        currentState = newState;
        currentFrameIndex = 0;
        frameCounter = 0;
    }

    // C. DRAW CHARACTER AT NEW POSITION
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    

const currentAnimation = animations[currentState];
const frame = currentAnimation[currentFrameIndex];

ctx.save(); // 1. Freeze current canvas settings

if (facing === 'left') {
    ctx.translate(x + 128, y); // 2. Shift pivot point to Bagman's right edge
    ctx.scale(-1, 1);          // 3. Mirror the canvas horizontally
    ctx.drawImage(frame, 0, 0, 128, 128); // 4. Draw at local origin (0, 0)
} else {
    ctx.drawImage(frame, x, y, 128, 128); // Draw normally
}

ctx.restore(); // 5. Unfreeze canvas back to normal settings
    



    
    // D. FRAME TICKER
    frameCounter++;
    if (frameCounter >= frameDelay) {
        frameCounter = 0;
        currentFrameIndex = (currentFrameIndex + 1) % currentAnimation.length;
    }   

    //htibox stuff
    const playerHitbox = {
        x: x+32,
        y: crouched ? y +64 : y +16,
        width: 64,
        height: crouched ? 64 :112
    };
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeRect(playerHitbox.x, playerHitbox.y, playerHitbox.width, playerHitbox.height);


    requestAnimationFrame(gameLoop);
}