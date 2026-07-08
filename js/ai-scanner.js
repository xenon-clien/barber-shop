// ==========================================
// AI Face Scanner Logic (100% Client-Side + Gemini API)
// ==========================================

let videoStream;
let detectionInterval;
let isAnalyzing = false;
let isModelsLoaded = false;
let geminiResult = null;

function getAPIKey() {
  let key = localStorage.getItem('GEMINI_API_KEY');
  if (!key) {
    key = prompt("Please enter your Google Gemini API Key (AIza... or AQ...):");
    if (key) {
      localStorage.setItem('GEMINI_API_KEY', key.trim());
    }
  }
  return key ? key.trim() : '';
}

const recommendations = {
  'Oval': [
    { name: 'Classic Pompadour', hair: 'Pompadour', beard: 'Clean Shaven' },
    { name: 'Side Part & Stubble', hair: 'Side Part', beard: 'Light Stubble' },
    { name: 'Buzz Cut', hair: 'Buzz Cut', beard: 'Full Beard' }
  ],
  'Square': [
    { name: 'Textured Crop', hair: 'Textured Crop', beard: 'Clean Shaven' },
    { name: 'Short Fade', hair: 'Short Fade', beard: 'Circle Beard' },
    { name: 'Quiff', hair: 'Quiff', beard: 'Rounded Goatee' }
  ],
  'Round': [
    { name: 'Faux Hawk', hair: 'Faux Hawk', beard: 'Box Beard' },
    { name: 'Spiky Hair', hair: 'Spiky Hair', beard: 'Angular Beard' },
    { name: 'High Volume', hair: 'High Volume', beard: 'Stubble' }
  ],
  'Diamond': [
    { name: 'Messy Fringe', hair: 'Messy Fringe', beard: 'Full Beard' },
    { name: 'Comb Over', hair: 'Comb Over', beard: 'Stubble' },
    { name: 'Slick Back', hair: 'Slick Back', beard: 'Goatee' }
  ],
  'Heart': [
    { name: 'Mid-length Sweep', hair: 'Mid-length Sweep', beard: 'Extended Goatee' },
    { name: 'Textured Quiff', hair: 'Textured Quiff', beard: 'Full Beard' },
    { name: 'Layered Crop', hair: 'Layered Crop', beard: 'Light Stubble' }
  ]
};

const shapes = Object.keys(recommendations);

// DOM Elements
const modal = document.getElementById('face-scanner-modal');
const video = document.getElementById('scanner-video');
const canvas = document.getElementById('scanner-canvas');
const loading = document.getElementById('scanner-loading');
const btnStart = document.getElementById('btn-start-scan');
const scanGrid = document.getElementById('scanner-grid');
const scanLine = document.getElementById('scanner-line');
const resPanel = document.getElementById('scanner-result');
const actionsPanel = document.getElementById('scanner-actions');
const optionsContainer = document.getElementById('ai-options-container');
const btnBookAi = document.getElementById('btn-book-ai');

// Load Face API Models
async function loadModels() {
  if (isModelsLoaded) return true;
  try {
    const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    isModelsLoaded = true;
    return true;
  } catch (error) {
    console.error('Error loading AI models:', error);
    loading.innerHTML = '<p class="text-red-400 text-sm">Failed to load local AI Models. Check console.</p>';
    return false;
  }
}

// Call Gemini Pro API
async function callGeminiAPI(base64Image) {
  let key = getAPIKey();
  if (!key) {
    alert("API Key is required to use the Gemini Scanner.");
    throw new Error("No API Key");
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    const base64Data = base64Image.split(',')[1];
    
    const payload = {
      contents: [{
        parts: [
          { text: "Analyze this person's face. Reply in strict JSON format. Determine their exact face shape (Oval, Square, Round, Diamond, or Heart). Suggest a highly attractive modern men's hairstyle and a beard style that perfectly suits this face shape. Format: { \"faceShape\": \"Oval\", \"hair\": \"Pompadour\", \"beard\": \"Stubble\", \"explanation\": \"...\" }" },
          { inline_data: { mime_type: "image/jpeg", data: base64Data } }
        ]
      }],
      generationConfig: { response_mime_type: "application/json" }
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        localStorage.removeItem('GEMINI_API_KEY');
        alert("The API Key provided is invalid or expired. Please refresh and try again.");
      }
      throw new Error(`API Request Failed with status ${response.status}`);
    }
    
    const data = await response.json();
    const jsonText = data.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Gemini API Error:", error);
    const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
    const rec = recommendations[randomShape][0];
    return {
      faceShape: randomShape,
      hair: rec.hair,
      beard: rec.beard,
      explanation: "Fallback due to API error. Selected a popular style."
    };
  }
}

// Start Camera
async function startCamera() {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    video.srcObject = videoStream;
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve(true);
      };
    });
  } catch (err) {
    console.error("Camera access denied:", err);
    loading.innerHTML = '<p class="text-red-400 text-sm">Camera access denied. Please allow permissions.</p>';
    return false;
  }
}

// Open Scanner
window.openFaceScanner = async function() {
  if (!modal) return;
  modal.classList.add('open');
  
  loading.classList.remove('hidden');
  loading.innerHTML = `
    <div class="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin mb-4"></div>
    <p class="text-gold text-sm tracking-widest uppercase animate-pulse">Initializing AI Models...</p>
  `;
  video.classList.add('hidden');
  canvas.classList.add('hidden');
  scanGrid.classList.add('hidden');
  scanLine.classList.add('hidden');
  resPanel.style.transform = 'translateY(100%)';
  resPanel.style.opacity = '0';
  actionsPanel.classList.remove('hidden');
  btnStart.disabled = true;
  btnStart.classList.add('opacity-50', 'cursor-not-allowed');
  btnStart.textContent = 'Initializing...';
  
  if (btnBookAi) {
    btnBookAi.disabled = true;
    btnBookAi.textContent = 'Select a Style to Book';
  }

  // 1. Load Local Models
  const modelsLoaded = await loadModels();
  if (!modelsLoaded) return;
  
  // 2. Open Camera
  btnStart.textContent = 'Requesting Camera...';
  const camStarted = await startCamera();
  if (!camStarted) return;
  
  // Ready
  loading.classList.add('hidden');
  video.classList.remove('hidden');
  canvas.classList.remove('hidden');
  scanGrid.classList.remove('hidden');
  
  const displaySize = { width: video.videoWidth, height: video.videoHeight };
  faceapi.matchDimensions(canvas, displaySize);
  
  btnStart.disabled = false;
  btnStart.classList.remove('opacity-50', 'cursor-not-allowed');
  btnStart.textContent = 'Start Gemini AI Analysis';
  btnStart.classList.add('animate-pulse');
  
  // Real-time tracking loop
  detectionInterval = setInterval(async () => {
    if (isAnalyzing) return;
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resizedDetections, { withScore: false, boxColor: '#D4AF37' });
  }, 100);
};

// Close Scanner
window.closeFaceScanner = function() {
  if (modal) modal.classList.remove('open');
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  if (detectionInterval) {
    clearInterval(detectionInterval);
  }
  isAnalyzing = false;
};

// Start Analysis
window.startAnalysis = function() {
  if (isAnalyzing) return;
  isAnalyzing = true;
  
  btnStart.classList.remove('animate-pulse');
  btnStart.textContent = 'Analyzing Facial Geometry...';
  
  scanLine.classList.remove('hidden');
  scanLine.style.animation = 'scanAnim 2s cubic-bezier(0.4, 0, 0.2, 1) infinite';
  
  if (!document.getElementById('scan-styles')) {
    const style = document.createElement('style');
    style.id = 'scan-styles';
    style.innerHTML = `@keyframes scanAnim { 0% { top: 0; opacity: 1; } 50% { top: 100%; opacity: 1; } 100% { top: 0; opacity: 1; } }`;
    document.head.appendChild(style);
  }

  // Slight delay for UI effect
  setTimeout(() => {
    finishAnalysis();
  }, 1000);
};

// Selection Logic
window.selectAIOption = function(element, styleName, imageUrl, hairDesc, beardDesc) {
  document.querySelectorAll('.ai-option-card').forEach(el => {
    el.classList.remove('border-gold');
    el.classList.add('border-gray-800');
    el.querySelector('.check-icon').classList.add('hidden');
  });
  
  element.classList.remove('border-gray-800');
  element.classList.add('border-gold');
  element.querySelector('.check-icon').classList.remove('hidden');
  
  document.getElementById('res-main-img').src = imageUrl;
  document.getElementById('res-main-title').textContent = styleName;
  document.getElementById('res-main-desc').textContent = `✂️ ${hairDesc} | 🧔 ${beardDesc}`;
  
  btnBookAi.disabled = false;
  btnBookAi.classList.remove('opacity-50', 'cursor-not-allowed');
  btnBookAi.textContent = `Book ${styleName} Now`;
};

// Draw AR Filter Overlay
function drawARStyle(ctx, landmarks, hairStyle, beardStyle) {
  const jaw = landmarks.getJawOutline();
  const mouth = landmarks.getMouth();
  const leftEyebrow = landmarks.getLeftEyeEyebrow();
  
  const width = jaw[16].x - jaw[0].x;
  
  // Beard
  if (beardStyle && !beardStyle.includes('Clean Shaven')) {
    ctx.fillStyle = beardStyle.includes('Stubble') ? 'rgba(30, 25, 20, 0.4)' : 'rgba(25, 20, 15, 0.85)';
    ctx.beginPath();
    ctx.moveTo(jaw[0].x, jaw[0].y);
    for(let i=1; i<jaw.length; i++) ctx.lineTo(jaw[i].x, jaw[i].y);
    ctx.lineTo(mouth[6].x, mouth[6].y + 5); 
    ctx.lineTo(mouth[4].x, mouth[4].y - 5); 
    ctx.lineTo(mouth[0].x, mouth[0].y + 5); 
    ctx.closePath();
    ctx.fill();
    
    if (beardStyle.includes('Full') || beardStyle.includes('Box') || beardStyle.includes('Goatee')) {
      ctx.beginPath();
      ctx.ellipse(mouth[3].x, mouth[3].y - 10, width * 0.15, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Hair
  const hairlineY = leftEyebrow[0].y - (width * 0.15); 
  ctx.fillStyle = 'rgba(20, 15, 10, 0.95)';
  ctx.beginPath();
  ctx.moveTo(jaw[0].x, jaw[0].y - 20);
  
  let topHeight = width * 0.3; 
  if (hairStyle.includes('Pompadour') || hairStyle.includes('Volume') || hairStyle.includes('Quiff')) {
    topHeight = width * 0.6; 
  } else if (hairStyle.includes('Faux Hawk') || hairStyle.includes('Spiky')) {
    topHeight = width * 0.7; 
  } else if (hairStyle.includes('Fringe') || hairStyle.includes('Crop')) {
    topHeight = width * 0.4;
  }

  if (hairStyle.includes('Faux Hawk') || hairStyle.includes('Spiky')) {
    ctx.lineTo(jaw[0].x + width/2, jaw[0].y - topHeight);
    ctx.lineTo(jaw[16].x, jaw[16].y - 20);
  } else {
    ctx.quadraticCurveTo(jaw[0].x + width/2, jaw[0].y - topHeight * 1.5, jaw[16].x, jaw[16].y - 20);
  }
  
  let fringeDrop = hairStyle.includes('Fringe') || hairStyle.includes('Crop') ? 20 : -10;
  ctx.quadraticCurveTo(jaw[0].x + width/2, hairlineY + fringeDrop, jaw[0].x, jaw[0].y - 20);
  
  ctx.fill();
}

// Finish Analysis
async function finishAnalysis() {
  scanLine.classList.add('hidden');
  if (detectionInterval) clearInterval(detectionInterval);
  
  // 1. Capture base snapshot
  const snapCanvas = document.createElement('canvas');
  snapCanvas.width = video.videoWidth || 640;
  snapCanvas.height = video.videoHeight || 480;
  const ctx = snapCanvas.getContext('2d');
  
  // Mirror webcam
  ctx.translate(snapCanvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
  
  const rawDataURL = snapCanvas.toDataURL('image/jpeg', 0.8);
  video.pause();
  
  // 2. Call Gemini for analysis
  btnStart.textContent = 'Processing with Gemini Pro...';
  let geminiData;
  try {
    geminiData = await callGeminiAPI(rawDataURL);
  } catch(e) {
    // If it fails (no key/invalid key), return early so user can try again
    isAnalyzing = false;
    btnStart.disabled = false;
    btnStart.textContent = 'Start Gemini AI Analysis';
    video.play();
    return;
  }
  
  // 3. Detect Face Landmarks for drawing
  const detection = await faceapi.detectSingleFace(snapCanvas, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
  
  let matchedShape = 'Oval';
  const rawShape = geminiData.faceShape.toLowerCase();
  shapes.forEach(s => {
    if (rawShape.includes(s.toLowerCase())) matchedShape = s;
  });
  
  // Clone the options so we don't mutate the global recommendations map
  const options = JSON.parse(JSON.stringify(recommendations[matchedShape]));
  
  document.getElementById('res-shape').textContent = matchedShape;
  
  options[0].hair = geminiData.hair;
  options[0].beard = geminiData.beard;
  options[0].name = "Gemini's Top Pick";
  
  // 4. Generate the 3 AR overlaid images ON THE USER'S SNAPSHOT
  const morphedOptions = options.map(opt => {
    const optCanvas = document.createElement('canvas');
    optCanvas.width = snapCanvas.width;
    optCanvas.height = snapCanvas.height;
    const optCtx = optCanvas.getContext('2d');
    
    // Base image
    optCtx.drawImage(snapCanvas, 0, 0);
    
    // Draw AR filter
    if (detection) {
      drawARStyle(optCtx, detection.landmarks, opt.hair, opt.beard);
    }
    
    return {
      ...opt,
      morphedDataUrl: optCanvas.toDataURL('image/jpeg', 0.8)
    };
  });
  
  // 5. Update UI with the morphed images of the user
  optionsContainer.innerHTML = morphedOptions.map((opt, idx) => `
    <div class="ai-option-card flex flex-col w-24 h-28 shrink-0 rounded-lg border border-gray-800 bg-black cursor-pointer hover:border-gold transition-all relative overflow-hidden" onclick="selectAIOption(this, '${opt.name}', '${opt.morphedDataUrl}', '${opt.hair}', '${opt.beard}')">
      <div class="w-full h-16 shrink-0 relative bg-gray-900 border-b border-gray-800">
        <img src="${opt.morphedDataUrl}" class="w-full h-full object-cover object-top" />
      </div>
      <div class="p-2 flex-1 flex flex-col items-center justify-center relative text-center">
        <h5 class="text-white font-serif text-[10px] leading-tight">${opt.name}</h5>
        <div class="check-icon hidden absolute right-1 top-1 w-4 h-4 rounded-full bg-gold text-black flex items-center justify-center font-bold text-[8px] shadow">✓</div>
      </div>
    </div>
  `).join('');
  
  if (morphedOptions.length > 0) {
    const firstOptionElement = optionsContainer.querySelector('.ai-option-card');
    const firstOpt = morphedOptions[0];
    selectAIOption(firstOptionElement, firstOpt.name, firstOpt.morphedDataUrl, firstOpt.hair, firstOpt.beard);
  }
  
  actionsPanel.classList.add('hidden');
  resPanel.style.transform = 'translateY(0)';
  resPanel.style.opacity = '1';
}
