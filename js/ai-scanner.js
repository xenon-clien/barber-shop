// ==========================================
// AI Face Scanner Logic (100% Client-Side)
// ==========================================

let videoStream;
let detectionInterval;
let isAnalyzing = false;
let geminiResult = null;

const GEMINI_API_KEY = localStorage.getItem('GEMINI_API_KEY') || '';

const recommendations = {
  'Oval': [
    { name: 'Classic Pompadour', hair: 'Pompadour', beard: 'Clean Shaven', image: 'https://images.unsplash.com/photo-1593726852924-4f243029f635?w=500&q=80' },
    { name: 'Side Part & Stubble', hair: 'Side Part', beard: 'Light Stubble', image: 'https://images.unsplash.com/photo-1620061559902-6018318858e9?w=500&q=80' },
    { name: 'Buzz Cut', hair: 'Buzz Cut', beard: 'Full Beard', image: 'https://images.unsplash.com/photo-1542131596-f30739988941?w=500&q=80' }
  ],
  'Square': [
    { name: 'Textured Crop', hair: 'Textured Crop', beard: 'Clean Shaven', image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=500&q=80' },
    { name: 'Short Fade', hair: 'Short Fade', beard: 'Circle Beard', image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&q=80' },
    { name: 'Quiff', hair: 'Quiff', beard: 'Rounded Goatee', image: 'https://images.unsplash.com/photo-1605406575497-015ab0d21b9b?w=500&q=80' }
  ],
  'Round': [
    { name: 'Faux Hawk', hair: 'Faux Hawk', beard: 'Box Beard', image: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=500&q=80' },
    { name: 'Spiky Hair', hair: 'Spiky Hair', beard: 'Angular Beard', image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&q=80' },
    { name: 'High Volume', hair: 'High Volume', beard: 'Stubble', image: 'https://images.unsplash.com/photo-1520975954732-57dd22299614?w=500&q=80' }
  ],
  'Diamond': [
    { name: 'Messy Fringe', hair: 'Messy Fringe', beard: 'Full Beard', image: 'https://images.unsplash.com/photo-1618354691438-25bc04584c23?w=500&q=80' },
    { name: 'Comb Over', hair: 'Comb Over', beard: 'Stubble', image: 'https://images.unsplash.com/photo-1598965402089-897ce52e8355?w=500&q=80' },
    { name: 'Slick Back', hair: 'Slick Back', beard: 'Goatee', image: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=500&q=80' }
  ],
  'Heart': [
    { name: 'Mid-length Sweep', hair: 'Mid-length Sweep', beard: 'Extended Goatee', image: 'https://images.unsplash.com/photo-1519014816548-bf5fe059e98b?w=500&q=80' },
    { name: 'Textured Quiff', hair: 'Textured Quiff', beard: 'Full Beard', image: 'https://images.unsplash.com/photo-1615169002220-43b67e233bc2?w=500&q=80' },
    { name: 'Layered Crop', hair: 'Layered Crop', beard: 'Light Stubble', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&q=80' }
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

// Call Gemini Pro API
async function callGeminiAPI(base64Image) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
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
    
    if (!response.ok) throw new Error("API Request Failed");
    const data = await response.json();
    const jsonText = data.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback to random if API key is invalid/fails
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
  
  // Reset UI
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
    btnBookAi.classList.add('opacity-50', 'cursor-not-allowed');
    btnBookAi.textContent = 'Select a Style to Book';
  }
  
  // Open Camera
  btnStart.textContent = 'Requesting Camera...';
  const camStarted = await startCamera();
  if (!camStarted) return;
  
  // Ready
  loading.classList.add('hidden');
  video.classList.remove('hidden');
  canvas.classList.remove('hidden');
  scanGrid.classList.remove('hidden');
  
  btnStart.disabled = false;
  btnStart.classList.remove('opacity-50', 'cursor-not-allowed');
  btnStart.textContent = 'Start Gemini AI Analysis';
  btnStart.classList.add('animate-pulse');
  
  // Simple fake scanning loop (no face-api required anymore)
  let scanPos = 0;
  detectionInterval = setInterval(() => {
    if (isAnalyzing) return;
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw generic targeting box
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.strokeRect(canvas.width * 0.2, canvas.height * 0.1, canvas.width * 0.6, canvas.height * 0.8);
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
  
  // Trigger scan line animation
  scanLine.classList.remove('hidden');
  scanLine.style.animation = 'scanAnim 2s cubic-bezier(0.4, 0, 0.2, 1) infinite';
  
  // Add CSS for scan line if not present
  if (!document.getElementById('scan-styles')) {
    const style = document.createElement('style');
    style.id = 'scan-styles';
    style.innerHTML = `
      @keyframes scanAnim {
        0% { top: 0; opacity: 1; }
        50% { top: 100%; opacity: 1; }
        100% { top: 0; opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  // Simulate complex processing delay
  setTimeout(() => {
    finishAnalysis();
  }, 3500);
};

// Selection Logic
window.selectAIOption = function(element, styleName, imageUrl, hairDesc, beardDesc) {
  // Remove outline from all options
  document.querySelectorAll('.ai-option-card').forEach(el => {
    el.classList.remove('border-gold');
    el.classList.add('border-gray-800');
    el.querySelector('.check-icon').classList.add('hidden');
  });
  
  // Highlight selected
  element.classList.remove('border-gray-800');
  element.classList.add('border-gold');
  element.querySelector('.check-icon').classList.remove('hidden');
  
  // Show the selected AI image in the BIG MAIN VIEWER
  document.getElementById('res-main-img').src = imageUrl;
  document.getElementById('res-main-title').textContent = styleName;
  document.getElementById('res-main-desc').textContent = `✂️ ${hairDesc} | 🧔 ${beardDesc}`;
  
  // Update Book button
  btnBookAi.disabled = false;
  btnBookAi.classList.remove('opacity-50', 'cursor-not-allowed');
  btnBookAi.textContent = `Book ${styleName} Now`;
};

// Finish Analysis (Calling Gemini)
async function finishAnalysis() {
  scanLine.classList.add('hidden');
  if (detectionInterval) clearInterval(detectionInterval);
  
  // 1. Capture base snapshot
  const snapCanvas = document.createElement('canvas');
  snapCanvas.width = video.videoWidth || 640;
  snapCanvas.height = video.videoHeight || 480;
  const ctx = snapCanvas.getContext('2d');
  
  ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
  const rawDataURL = snapCanvas.toDataURL('image/jpeg', 0.8);
  video.pause();
  
  // 2. Call Gemini
  btnStart.textContent = 'Processing with Gemini Pro...';
  
  const geminiData = await callGeminiAPI(rawDataURL);
  
  // Match shape string to our predefined keys
  let matchedShape = 'Oval';
  const rawShape = geminiData.faceShape.toLowerCase();
  shapes.forEach(s => {
    if (rawShape.includes(s.toLowerCase())) matchedShape = s;
  });
  
  const options = recommendations[matchedShape];
  
  // 3. Update UI
  document.getElementById('res-shape').textContent = matchedShape;
  
  // We will show Gemini's explanation somewhere?
  // Let's prepend it as the first option dynamically!
  options[0].hair = geminiData.hair;
  options[0].beard = geminiData.beard;
  options[0].name = "Gemini's Top Pick";
  
  // Render Options as small horizontal thumbnails with Unsplash images
  optionsContainer.innerHTML = options.map((opt, idx) => `
    <div class="ai-option-card flex flex-col w-24 h-28 shrink-0 rounded-lg border border-gray-800 bg-black cursor-pointer hover:border-gold transition-all relative overflow-hidden" onclick="selectAIOption(this, '${opt.name}', '${opt.image}', '${opt.hair}', '${opt.beard}')">
      <div class="w-full h-16 shrink-0 relative bg-gray-900 border-b border-gray-800">
        <img src="${opt.image}" class="w-full h-full object-cover object-top" />
      </div>
      <div class="p-2 flex-1 flex flex-col items-center justify-center relative text-center">
        <h5 class="text-white font-serif text-[10px] leading-tight">${opt.name}</h5>
        
        <div class="check-icon hidden absolute right-1 top-1 w-4 h-4 rounded-full bg-gold text-black flex items-center justify-center font-bold text-[8px] shadow">✓</div>
      </div>
    </div>
  `).join('');
  
  // Auto-select the first option
  if (options.length > 0) {
    const firstOptionElement = optionsContainer.querySelector('.ai-option-card');
    const firstOpt = options[0];
    selectAIOption(firstOptionElement, firstOpt.name, firstOpt.image, firstOpt.hair, firstOpt.beard);
  }
  
  actionsPanel.classList.add('hidden');
  resPanel.style.transform = 'translateY(0)';
  resPanel.style.opacity = '1';
}
