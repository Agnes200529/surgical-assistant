const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const statusDiv = document.getElementById("status");
const ctx = canvas.getContext("2d");

let lastFrame = null;
let motionHistory = [];
let lastAnnounced = "";

// Access phone camera
navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
  .then(stream => {
    video.srcObject = stream;
    statusDiv.innerText = "Monitoring... Patient stable";
    statusDiv.style.background = "green";
  });

function speakOnce(text) {
  if (text !== lastAnnounced) {
    speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(msg);
    lastAnnounced = text;
  }
}

function analyze() {
  if (video.videoWidth === 0) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.drawImage(video, 0, 0);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = frame.data;

  let motion = 0;
  let redCount = 0;

  if (lastFrame) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Motion detection
      motion += Math.abs(r - lastFrame.data[i]);

      // Blood (red) detection
      if (r > 150 && g < 100 && b < 100) {
        redCount++;
      }
    }
  }

  lastFrame = frame;

  // Store motion history (for breathing / instability detection)
  motionHistory.push(motion);
  if (motionHistory.length > 12) motionHistory.shift(); // ~6 seconds history

  const avgMotion = motionHistory.reduce((a, b) => a + b, 0) / motionHistory.length;

  let riskText = "";

  // ---- THRESHOLDS (You can tune these) ----
  const BLEEDING_THRESHOLD = 30;
  const SUDDEN_MOVE_THRESHOLD = 7000000;
  const BREATHING_MOTION_THRESHOLD = 2500000;  // medium motion
  const BREATHING_PERSISTENCE_COUNT = 4;        // how many frames show it

  // Check how many recent frames show medium motion
  let breathingLikeCount = 0;
  for (let m of motionHistory) {
    if (m > BREATHING_MOTION_THRESHOLD && m < SUDDEN_MOVE_THRESHOLD) {
      breathingLikeCount++;
    }
  }

  // Priority: bleeding > sudden movement > abnormal breathing

  if (redCount > BLEEDING_THRESHOLD) {
    riskText = "High bleeding detected";
  }
  else if (motion > SUDDEN_MOVE_THRESHOLD) {
    riskText = "Sudden movement detected";
  }
  else if (breathingLikeCount >= BREATHING_PERSISTENCE_COUNT) {
    riskText = "Abnormal breathing or instability detected";
  }

  if (riskText !== "") {
    statusDiv.innerText = "⚠️ RISK DETECTED: " + riskText;
    statusDiv.style.background = "red";
    speakOnce(riskText);
  } else {
    statusDiv.innerText = "Monitoring... Patient stable";
    statusDiv.style.background = "green";
    speakOnce("Patient stable");
  }
}

setInterval(analyze, 500);