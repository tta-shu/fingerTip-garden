// --- 1. FAST AUDIO ENGINE (LIGHTWEIGHT HARP SYNTH) ---
let audioStarted = false;

// Lightweight stereo delay/echo instead of heavy convolution reverb (much faster on CPU)
const echo = new Tone.FeedbackDelay('8n', 0.25).toDestination();
echo.wet.value = 0.2;

const harpSynth = new Tone.PolySynth(Tone.Synth, {
  maxPolyphony: 8, // Caps simultaneous voices so audio never stutters
  oscillator: { type: 'triangle' },
  envelope: {
    attack: 0.008,
    decay: 0.5,
    sustain: 0.05,
    release: 1.4
  }
}).connect(echo);

harpSynth.volume.value = -5;

const HARP_NOTES = [
  'C4', 'D4', 'E4', 'G4', 'A4',
  'C5', 'D5', 'E5', 'G5', 'A5',
  'C6', 'D6', 'E6'
];

const startBtn = document.getElementById('start-btn');
const clearBtn = document.getElementById('clear-btn');
const quoteEl = document.getElementById('quote');

startBtn.addEventListener('click', async () => {
  await Tone.start();
  audioStarted = true;
  startBtn.textContent = 'Garden Active ♪';
  startBtn.style.backgroundColor = '#a6e3a1';

  const now = Tone.now();
  ['C5', 'E5', 'G5', 'B5'].forEach((note, idx) => {
    harpSynth.triggerAttackRelease(note, '4n', now + idx * 0.07);
  });
});

clearBtn.addEventListener('click', () => {
  plantedFlowers = [];
  butterflies = [];
});

// --- 2. PRE-RENDER EMOJI SPRITES (50X FASTER THAN fillText) ---
const GARDEN_ICONS = ['🍄', '🌷', '🍀', '🌻', '🌹', '🌸', '🌼', '🪻', '🌺'];
const iconSprites = {};

function createEmojiSprite(emoji, size = 36) {
  const offCanvas = document.createElement('canvas');
  offCanvas.width = size;
  offCanvas.height = size;
  const ctx = offCanvas.getContext('2d');
  ctx.font = `${Math.floor(size * 0.72)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2);
  return offCanvas;
}

// Pre-render all garden icons and the butterfly once on page load
GARDEN_ICONS.forEach((icon) => {
  iconSprites[icon] = createEmojiSprite(icon, 36);
});
const butterflySprite = createEmojiSprite('🦋', 34);

// --- 3. GARDEN STATE & SMOOTHING ---
const FINGERTIP_INDICES = [4, 8, 12, 16, 20];
const STEM_COLORS = [
  '#f9e2af', '#f38ba8', '#89dceb',
  '#cba6f7', '#a6e3a1', '#fab387'
];

const MAX_FLOWERS = 90; // Automatically trims oldest flowers if garden gets huge
let plantedFlowers = [];
let butterflies = [];
const fingerState = {};

function triggerGardenBloom(x, y, stemColor) {
  if (audioStarted) {
    const normalizedX = Math.min(Math.max(x / canvasElement.width, 0), 0.99);
    const noteIndex = Math.floor(normalizedX * HARP_NOTES.length);
    harpSynth.triggerAttackRelease(HARP_NOTES[noteIndex], '4n');
  }

  const randomIcon = GARDEN_ICONS[Math.floor(Math.random() * GARDEN_ICONS.length)];
  plantedFlowers.push({
    x: x,
    targetY: y,
    currentY: canvasElement.height,
    color: stemColor,
    sprite: iconSprites[randomIcon],
    settled: false
  });

  if (plantedFlowers.length > MAX_FLOWERS) {
    plantedFlowers.shift();
  }

  if (plantedFlowers.length >= 4 && !quoteEl.classList.contains('visible')) {
    quoteEl.classList.add('visible');
  }

  if (Math.random() < 0.3 && butterflies.length < 12) {
    butterflies.push({
      x: x + (Math.random() - 0.5) * 40,
      y: y - 15,
      vx: (Math.random() - 0.5) * 1.4,
      vy: -0.8 - Math.random() * 0.7,
      wingPhase: Math.random() * Math.PI * 2,
      life: 1.0
    });
  }
}

// --- 4. GPU-ACCELERATED DRAWING FUNCTIONS ---
function drawPlantedGarden() {
  for (let i = 0; i < plantedFlowers.length; i++) {
    const flower = plantedFlowers[i];

    // Stop animating math once stem reaches its target height
    if (!flower.settled) {
      flower.currentY += (flower.targetY - flower.currentY) * 0.25;
      if (Math.abs(flower.targetY - flower.currentY) < 0.5) {
        flower.currentY = flower.targetY;
        flower.settled = true;
      }
    }

    // 1. Vertical stem
    canvasCtx.beginPath();
    canvasCtx.moveTo(flower.x, canvasElement.height);
    canvasCtx.lineTo(flower.x, flower.currentY);
    canvasCtx.strokeStyle = flower.color;
    canvasCtx.lineWidth = 2;
    canvasCtx.stroke();

    // 2. White ring node
    canvasCtx.beginPath();
    canvasCtx.arc(flower.x, flower.currentY, 4.5, 0, Math.PI * 2);
    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    canvasCtx.fill();
    canvasCtx.lineWidth = 1.5;
    canvasCtx.strokeStyle = '#ffffff';
    canvasCtx.stroke();

    // 3. Fast GPU image stamp instead of slow text rendering
    canvasCtx.drawImage(flower.sprite, flower.x - 18, flower.currentY - 34);
  }
}

function updateAndDrawButterflies() {
  for (let i = butterflies.length - 1; i >= 0; i--) {
    const b = butterflies[i];

    b.wingPhase += 0.25;
    b.x += b.vx + Math.sin(b.wingPhase * 0.5) * 0.8;
    b.y += b.vy;
    b.life -= 0.005;

    if (b.y < -30 || b.life <= 0) {
      butterflies.splice(i, 1);
      continue;
    }

    const flapWidth = 34 * (0.65 + Math.abs(Math.sin(b.wingPhase)) * 0.45);
    canvasCtx.globalAlpha = Math.min(b.life, 0.95);
    canvasCtx.drawImage(butterflySprite, b.x - flapWidth / 2, b.y - 17, flapWidth, 34);
  }
  canvasCtx.globalAlpha = 1.0;
}

// --- 5. FAST MEDIAPIPE HANDS LOOP ---
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

let isProcessing = false; // Prevents frame pile-up lag!

function onResults(results) {
  isProcessing = false;
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  drawPlantedGarden();
  updateAndDrawButterflies();

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const now = Date.now();

    results.multiHandLandmarks.forEach((landmarks, handIndex) => {
      FINGERTIP_INDICES.forEach((tipIndex, i) => {
        const point = landmarks[tipIndex];
        const fingerId = `h${handIndex}-f${tipIndex}`;

        const rawX = (1 - point.x) * canvasElement.width;
        const rawY = point.y * canvasElement.height;
        const color = STEM_COLORS[(handIndex * 5 + i) % STEM_COLORS.length];

        if (!fingerState[fingerId]) {
          fingerState[fingerId] = {
            smoothX: rawX,
            smoothY: rawY,
            prevY: rawY,
            lastTrigger: 0
          };
        }

        const state = fingerState[fingerId];

        // Smooth fingertip halo coordinates so dots glide cleanly
        state.smoothX += (rawX - state.smoothX) * 0.45;
        state.smoothY += (rawY - state.smoothY) * 0.45;

        // Draw smooth fingertip halo
        canvasCtx.beginPath();
        canvasCtx.arc(state.smoothX, state.smoothY, 7, 0, Math.PI * 2);
        canvasCtx.fillStyle = color + '66';
        canvasCtx.fill();

        // Detect downward finger curl/tap
        const downwardSpeed = rawY - state.prevY;
        if (downwardSpeed > 8 && now - state.lastTrigger > 240) {
          triggerGardenBloom(state.smoothX, state.smoothY, color);
          state.lastTrigger = now;
        }

        state.prevY = rawY;
      });
    });
  }
}

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 0, // Lite model: 2x faster with smooth 60fps tracking
  minDetectionConfidence: 0.55,
  minTrackingConfidence: 0.55
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    // Skip sending a new frame if the previous frame is still finishing (eliminates input lag!)
    if (isProcessing) return;
    isProcessing = true;
    await hands.send({ image: videoElement });
  },
  width: 640, // Faster frame capture, CSS still scales it cleanly to 800x540
  height: 480
});

camera.start();