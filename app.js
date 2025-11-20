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
let latencyPollTimer;

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

function readFormValues() {
  const data = new FormData(ui.form);
  return {
    minRate: Number(data.get('minRate')),
    maxPower: Number(data.get('maxPower')),
    maxBandwidth: Number(data.get('maxBandwidth')),
    coeffA: Number(data.get('coeffA')),
    coeffB: Number(data.get('coeffB')),
    coeffC: Number(data.get('coeffC')),
  };
}

async function fetchLatency() {
  try {
    const response = await fetch('/api/latency');
    if (!response.ok) throw new Error('Latency API failed');
    const payload = await response.json();
    latencyMs = payload.latency;
    ui.latencyValue.textContent = `${latencyMs}`;
    ui.latencyStatus.textContent =
      payload.status === 'optimal'
        ? 'Optimal'
        : payload.status === 'moderate'
        ? 'Moderate'
        : 'High latency';
    ui.latencyWarning.hidden = payload.status !== 'high';
  } catch (error) {
    ui.latencyStatus.textContent = 'Latency API unavailable';
    ui.latencyWarning.hidden = false;
    ui.latencyWarning.textContent = 'Latency monitor offline';
  }
}

function startLatencyPolling() {
  if (latencyPollTimer) clearInterval(latencyPollTimer);
  fetchLatency();
  latencyPollTimer = setInterval(fetchLatency, 5000);
}

ui.runOptimizer.addEventListener('click', async () => {
  const values = readFormValues();
  ui.solverStatus.textContent = 'Running solver…';
  ui.runOptimizer.disabled = true;

  try {
    const response = await fetch('/api/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload.error || 'Optimization failed');
    }
    const payload = await response.json();
    ui.optRate.textContent = payload.result.rate;
    ui.optPower.textContent = payload.result.power;
    ui.optBandwidth.textContent = payload.result.bandwidth;
    ui.optLatency.textContent = payload.result.latency;
    ui.solverStatus.textContent = payload.message || 'Optimization complete';
  } catch (error) {
    ui.solverStatus.textContent = error.message;
  } finally {
    ui.runOptimizer.disabled = false;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    window.speechSynthesis.cancel();
  }
});

startLatencyPolling();

