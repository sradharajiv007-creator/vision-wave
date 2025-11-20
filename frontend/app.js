const ui = {
  assistiveSection: document.getElementById('assistiveSection'),
  optimizerSection: document.getElementById('optimizerSection'),
  assistiveBtn: document.getElementById('assistiveModeBtn'),
  optimizerBtn: document.getElementById('optimizerModeBtn'),
  startAssistive: document.getElementById('startAssistive'),
  video: document.getElementById('cameraFeed'),
  canvas: document.getElementById('cameraOverlay'),
  cameraStatus: document.getElementById('cameraStatus'),
  objectList: document.getElementById('objectList'),
  speakButton: document.getElementById('speakButton'),
  autoSpeechToggle: document.getElementById('autoSpeechToggle'),
  latencyValue: document.getElementById('latencyValue'),
  latencyStatus: document.getElementById('latencyStatus'),
  latencyWarning: document.getElementById('latencyWarning'),
  form: document.getElementById('optimizerForm'),
  runOptimizer: document.getElementById('runOptimizer'),
  optRate: document.getElementById('optRate'),
  optPower: document.getElementById('optPower'),
  optBandwidth: document.getElementById('optBandwidth'),
  optLatency: document.getElementById('optLatency'),
  solverStatus: document.getElementById('solverStatus'),
};

let cocoModel;
let detectionInterval;
let speechQueue = [];
let latencyMs = 0;

function switchPanel(panel) {
  const showAssistive = panel === 'assistive';
  ui.assistiveSection.classList.toggle('active', showAssistive);
  ui.optimizerSection.classList.toggle('active', !showAssistive);
  ui.assistiveBtn.classList.toggle('primary', showAssistive);
  ui.assistiveBtn.classList.toggle('ghost', !showAssistive);
  ui.optimizerBtn.classList.toggle('primary', !showAssistive);
  ui.optimizerBtn.classList.toggle('ghost', showAssistive);
}

ui.assistiveBtn.addEventListener('click', () => switchPanel('assistive'));
ui.optimizerBtn.addEventListener('click', () => switchPanel('optimizer'));

async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    ui.video.srcObject = stream;
    ui.cameraStatus.textContent = 'Camera live';
    if (!cocoModel) {
      ui.cameraStatus.textContent = 'Loading detection model…';
      cocoModel = await cocoSsd.load();
      ui.cameraStatus.textContent = 'Model ready';
    }
    startDetectionLoop();
  } catch (error) {
    ui.cameraStatus.textContent = 'Camera access denied';
    console.error('Camera error', error);
  }
}

function startDetectionLoop() {
  const ctx = ui.canvas.getContext('2d');
  ui.canvas.width = ui.video.videoWidth;
  ui.canvas.height = ui.video.videoHeight;

  if (detectionInterval) clearInterval(detectionInterval);
  detectionInterval = setInterval(async () => {
    if (!cocoModel || ui.video.readyState < 2) return;
    const predictions = await cocoModel.detect(ui.video);
    renderPredictions(ctx, predictions);
    updateObjects(predictions);
    simulateLatency();
  }, 800);
}

function renderPredictions(ctx, predictions) {
  ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.font = '16px Inter';
  ctx.fillStyle = '#3b82f6';

  predictions.slice(0, 4).forEach((pred) => {
    const [x, y, width, height] = pred.bbox;
    ctx.strokeRect(x, y, width, height);
    ctx.fillText(`${pred.class} ${(pred.score * 100).toFixed(0)}%`, x + 4, y + 18);
  });
}

function updateObjects(predictions) {
  ui.objectList.innerHTML = '';
  if (!predictions.length) {
    ui.objectList.innerHTML = '<li>No objects in frame</li>';
    speechQueue = [];
    ui.speakButton.disabled = true;
    return;
  }

  speechQueue = predictions.slice(0, 3).map((pred) => ({
    label: pred.class,
    confidence: pred.score,
  }));
  ui.speakButton.disabled = false;

  speechQueue.forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${item.label}</span>
      <span class="confidence">${(item.confidence * 100).toFixed(0)}%</span>
    `;
    ui.objectList.appendChild(li);
  });

  if (ui.autoSpeechToggle.checked) {
    speakDetectedObjects();
  }
}

function speakDetectedObjects() {
  if (!speechQueue.length) return;
  const text = speechQueue.map((item) => item.label).join(', ');
  const utterance = new SpeechSynthesisUtterance(`Detected ${text}`);
  utterance.rate = latencyMs > 400 ? 1.1 : 1;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

ui.speakButton.addEventListener('click', speakDetectedObjects);
ui.startAssistive.addEventListener('click', initCamera);

function simulateLatency() {
  // Mock latency values to drive UI before backend integration
  latencyMs = Math.round(150 + Math.random() * 250);
  ui.latencyValue.textContent = `${latencyMs}`;
  const status =
    latencyMs < 220 ? 'Optimal' : latencyMs < 320 ? 'Moderate' : 'High latency';
  ui.latencyStatus.textContent = status;
  const warning = latencyMs > 320;
  ui.latencyWarning.hidden = !warning;
}

function readFormValues() {
  const data = new FormData(ui.form);
  const parsed = {
    minRate: Number(data.get('minRate')) || Number(document.getElementById('minRate').value),
    maxPower: Number(document.getElementById('maxPower').value),
    maxBandwidth: Number(document.getElementById('maxBandwidth').value),
    coeffA: Number(document.getElementById('coeffA').value),
    coeffB: Number(document.getElementById('coeffB').value),
    coeffC: Number(document.getElementById('coeffC').value),
  };
  return parsed;
}

function runMockLagrangeSolver(values) {
  const { minRate, maxPower, maxBandwidth, coeffA, coeffB, coeffC } = values;
  let x1 = minRate + 1;
  let x2 = Math.max(maxPower - 0.5, 0.1);
  let x3 = Math.max(maxBandwidth - 2, 0.5);
  const lr = 0.05;

  const target = (a, b, c, r1, r2, r3) => a / r1 + b / r2 + c / r3;
  let prevLatency = Infinity;

  for (let i = 0; i < 500; i++) {
    const latency = target(coeffA, coeffB, coeffC, x1, x2, x3);
    if (Math.abs(prevLatency - latency) < 0.001) break;
    prevLatency = latency;

    const grad1 = -coeffA / (x1 * x1);
    const grad2 = -coeffB / (x2 * x2);
    const grad3 = -coeffC / (x3 * x3);

    x1 = Math.max(minRate, x1 - lr * grad1);
    x2 = Math.min(maxPower, x2 - lr * grad2);
    x3 = Math.min(maxBandwidth, x3 - lr * grad3);
  }

  return {
    rate: Number(x1.toFixed(2)),
    power: Number(x2.toFixed(2)),
    bandwidth: Number(x3.toFixed(2)),
    latency: Number((coeffA / x1 + coeffB / x2 + coeffC / x3).toFixed(3)),
  };
}

ui.runOptimizer.addEventListener('click', () => {
  const values = readFormValues();
  ui.solverStatus.textContent = 'Running solver…';
  ui.runOptimizer.disabled = true;

  setTimeout(() => {
    const result = runMockLagrangeSolver(values);
    ui.optRate.textContent = result.rate;
    ui.optPower.textContent = result.power;
    ui.optBandwidth.textContent = result.bandwidth;
    ui.optLatency.textContent = result.latency;
    ui.solverStatus.textContent = 'Optimization complete (JS prototype)';
    ui.runOptimizer.disabled = false;
  }, 400);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    window.speechSynthesis.cancel();
  }
});

