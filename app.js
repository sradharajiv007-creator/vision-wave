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
  solverIterations: document.getElementById('solverIterations'),
  improvementSection: document.getElementById('improvementSection'),
  improvementPercent: document.getElementById('improvementPercent'),
  baselineLatency: document.getElementById('baselineLatency'),
  finalLatency: document.getElementById('finalLatency'),
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

/**
 * Client-side Lagrange Multiplier Solver (Fallback when API unavailable)
 * Same implementation as server-side for consistency
 */
function runClientSolver({ minRate, maxPower, maxBandwidth, coeffA, coeffB, coeffC }) {
  const MAX_ITERATIONS = 1000;
  const CONVERGENCE_THRESHOLD = 0.001;
  const STEP_SIZE = 0.01;
  
  // Validate inputs
  if (minRate <= 0 || maxPower <= 0 || maxBandwidth <= 0) {
    throw new Error('All constraint values must be positive');
  }
  if (coeffA <= 0 || coeffB <= 0 || coeffC <= 0) {
    throw new Error('All coefficients must be positive');
  }
  if (minRate >= maxBandwidth * 10) {
    throw new Error('Unrealistic constraint: minRate too high for bandwidth ceiling');
  }
  
  // Objective function
  const objective = (x1, x2, x3) => coeffA / x1 + coeffB / x2 + coeffC / x3;
  
  // Constraint functions
  const g1 = (x1) => x1 - minRate;  // x1 >= R_min
  const g2 = (x2) => maxPower - x2;  // x2 <= P_max
  const g3 = (x3) => maxBandwidth - x3;  // x3 <= B_max
  
  // Initialize variables (feasible starting point)
  let x1 = minRate + 1.0;
  let x2 = maxPower * 0.8;
  let x3 = maxBandwidth * 0.8;
  
  // Initialize Lagrange multipliers
  let lambda1 = 0.0;
  let lambda2 = 0.0;
  let lambda3 = 0.0;
  
  let prevLatency = Infinity;
  let iterations = 0;
  
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    iterations = iter + 1;
    
    // Compute gradients
    const gradX1 = -coeffA / (x1 * x1);
    const gradX2 = -coeffB / (x2 * x2);
    const gradX3 = -coeffC / (x3 * x3);
    
    // Compute constraint values
    const g1Val = g1(x1);
    const g2Val = g2(x2);
    const g3Val = g3(x3);
    
    // Update Lagrange multipliers
    if (g1Val < 0) {
      lambda1 = Math.max(0, lambda1 - STEP_SIZE * g1Val);
    } else {
      lambda1 = 0;
    }
    
    if (g2Val < 0) {
      lambda2 = Math.max(0, lambda2 - STEP_SIZE * g2Val);
    } else {
      lambda2 = 0;
    }
    
    if (g3Val < 0) {
      lambda3 = Math.max(0, lambda3 - STEP_SIZE * g3Val);
    } else {
      lambda3 = 0;
    }
    
    // Update variables
    let newX1 = x1 - STEP_SIZE * (gradX1 + lambda1);
    let newX2 = x2 - STEP_SIZE * (gradX2 - lambda2);
    let newX3 = x3 - STEP_SIZE * (gradX3 - lambda3);
    
    // Project onto feasible region
    newX1 = Math.max(newX1, minRate);
    newX2 = Math.min(newX2, maxPower);
    newX3 = Math.min(newX3, maxBandwidth);
    
    // Check convergence
    const currentLatency = objective(newX1, newX2, newX3);
    if (Math.abs(prevLatency - currentLatency) < CONVERGENCE_THRESHOLD) {
      x1 = newX1;
      x2 = newX2;
      x3 = newX3;
      break;
    }
    
    x1 = newX1;
    x2 = newX2;
    x3 = newX3;
    prevLatency = currentLatency;
  }
  
  const finalLatency = objective(x1, x2, x3);
  
  // Calculate baseline for comparison
  const baselineLatency = objective(minRate, maxPower * 0.5, maxBandwidth * 0.5);
  const improvement = ((baselineLatency - finalLatency) / baselineLatency) * 100;
  
  return {
    rate: Number(x1.toFixed(4)),
    power: Number(x2.toFixed(4)),
    bandwidth: Number(x3.toFixed(4)),
    latency: Number(finalLatency.toFixed(6)),
    iterations,
    baselineLatency: Number(baselineLatency.toFixed(6)),
    improvementPercent: Number(improvement.toFixed(2)),
  };
}

function displayOptimizationResult(result, message, method = 'Lagrange Multiplier') {
  // Display optimized values
  ui.optRate.textContent = result.rate;
  ui.optPower.textContent = result.power;
  ui.optBandwidth.textContent = result.bandwidth;
  ui.optLatency.textContent = `${result.latency.toFixed(4)}`;
  
  // Display improvement metrics if available
  if (result.improvementPercent !== undefined) {
    ui.improvementPercent.textContent = `${result.improvementPercent > 0 ? '+' : ''}${result.improvementPercent}%`;
    ui.baselineLatency.textContent = result.baselineLatency.toFixed(4);
    ui.finalLatency.textContent = result.latency.toFixed(4);
    ui.improvementSection.style.display = 'block';
  } else {
    ui.improvementSection.style.display = 'none';
  }
  
  // Display solver status and iterations
  ui.solverStatus.textContent = message || 'Optimization complete';
  if (result.iterations) {
    ui.solverIterations.textContent = `Converged in ${result.iterations} iterations using ${method} method`;
  } else {
    ui.solverIterations.textContent = '';
  }
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
    // Try API first (for Vercel deployment)
    let result, message, method;
    
    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      
      if (response.ok) {
        const payload = await response.json();
        result = payload.result;
        message = payload.message || 'Optimization complete';
        method = payload.method || 'Lagrange Multiplier';
      } else {
        // API returned error, fall back to client-side solver
        throw new Error('API unavailable');
      }
    } catch (apiError) {
      // API call failed (network error, 404, etc.) - use client-side solver
      console.log('API unavailable, using client-side solver:', apiError.message);
      result = runClientSolver(values);
      message = `Optimization complete (client-side solver)`;
      method = 'Lagrange Multiplier (Client-side)';
    }
    
    displayOptimizationResult(result, message, method);
    
  } catch (error) {
    ui.solverStatus.textContent = `Error: ${error.message}`;
    ui.solverIterations.textContent = '';
    ui.improvementSection.style.display = 'none';
    console.error('Optimization error:', error);
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

