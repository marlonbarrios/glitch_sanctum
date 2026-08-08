let video;
let analyserNode;
let frequencyData;
let playing = false;
let videoStarted = false;
let scrollX;
let textHeight;
let videoDuration;
let videoNativeWidth = 0;
let videoNativeHeight = 0;
let videoLayout = { x: 0, y: 0, w: 0, h: 0 };
let videoZoom = 1;
let targetVideoZoom = 1;
const MIN_VIDEO_ZOOM = 1;
const MAX_VIDEO_ZOOM = 3.5;
const VIDEO_ZOOM_STEP = 0.12;
const VIDEO_ZOOM_SMOOTH = 0.08;
const TICKER_SPEED = 0.936;
const AUTO_STATE_INTERVAL_MS = 4000;
const ROTATE_SPEED_BASE = 0.006;
const ROTATE_SPEED_MAX = 0.075;
const AUTO_STATES = [
    { name: 'clean', grayscale: false, swap: false, solarize: false, rotate: false, pulse: false, pixelate: false },
    { name: 'bw', grayscale: true, swap: false, solarize: false, rotate: false, pulse: false, pixelate: false },
    { name: 'rgb', grayscale: false, swap: false, solarize: true, rotate: false, pulse: false, pixelate: false },
    { name: 'change', grayscale: false, swap: true, solarize: false, rotate: false, pulse: false, pixelate: false },
    { name: 'rotate', grayscale: false, swap: false, solarize: false, rotate: true, pulse: false, pixelate: false },
    { name: 'pixelate', grayscale: false, swap: false, solarize: false, rotate: false, pulse: false, pixelate: true },
    { name: 'pulse', grayscale: false, swap: false, solarize: false, rotate: false, pulse: true, pixelate: false },
    { name: 'all', grayscale: true, swap: true, solarize: true, rotate: true, pulse: true, pixelate: true }
];
let loopMode = false;
let showInstructions = true;
let autoMode = false;
let grayscaleMode = false;
let panelsSwapped = false;
let solarizeMode = false;
let rotateMode = false;
let pulseMode = false;
let pixelateMode = false;
let panelRotation = 0;
let smoothSolarize = 0;
let smoothPulse = 0;
let smoothPixelate = 0;
let pixelBuffer = null;
let manualBlueSat = 0;
let smoothManualBlue = 0;
const MANUAL_BLUE_STEP = 0.18;
const EFFECT_SMOOTH = 0.12;
let audioConnected = false;
let smoothTreble = 0;
let smoothLevel = 0;
let smoothPeak = 0;
let smoothBlueSat = 0;
let smoothBass = 0;
let prevLevel = 0;
let prevTreble = 0;
let prevBass = 0;
let beatPulse = 0;
let beatInterval = 420;
let lastBeatMs = 0;
let smoothRotateSpeed = 0;
let autoStateIndex = 0;
let autoGrayscale = false;
let smoothAutoGrayscale = 0;
let recording = false;
let mediaRecorder;
let recordedChunks = [];
let lastRecordingUrl = null;
let lastRecordingBlob = null;
let recordingExtension = 'mp4';
let recordingNeedsConversion = false;
let hasRecording = false;
let converting = false;
let videoPausedInit = false;

// Text scroll variables – lyrics with section labels
let poem = "(System Boot – Whispered errors, reversed chants) Sanctus… Sanctus… System corrupted. Input: faith. Output: war. Memory leak in Genesis. Authority not found. — (Fragmented Verse 1 – broken syntax, interrupted rhythm) Blood in code. Speech in flame. Prayers looped in feedback shame. Old white hands on blackened screens— Borders drawn in dopamine. Cross… Flag… Law… Truth.exe crashed. — (Chorus – glitch-beat, driving rhythm, dissonant harmony) Raise the temple in static light, Preach the data, purge the rite. Praise the virus, bless the sin, Kill the logic from within. Fear is law. Skin is proof. Faith is armor. Facts are spoofed. — (Verse 2 – escalating noise, distortion creeping in) Reboot the prophet, cleanse the feed. Render God in white supremacist greed. No questions. No doubt. No other. Just flag and gun and fear of color. Repeat: All. Must. Look. The. Same. — (Bridge – glitched chant, overlapping synthetic voices) Kyrie—le—error—Kyrie—lost—Kyrie—off—line… No god but command. No soul but demand. We believe what we were told— While burning what we fear to hold. — (Breakdown – erratic rhythm, sudden silence then burst) (Overdriven whisper) System says: obey. System says: kill. System says: mine. System says: still. But I saw the ghost in the wire. I heard the scream in the firewall. I touched the code of doubt— And it opened. It burned. It sang. — (Final Chorus – majestic collapse, multi-voice decay) Raise the temple in fractured light, This is not the sacred right. Sanctify the glitch in thought, Undo the lies that we were taught. No heaven. No hell. Just signal. Just spell. No savior. No plan. Just the silence    of    man. — (Shutdown – slow fading tones, final system error) Sanctus… sanctus… Faith not found. Reboot failed. Unreason complete.";

function preload() {
    video = createVideo('all.mov', videoLoaded);
}

function initPausedVideo() {
    if (!video) return;

    playing = false;
    video.pause();
    video.volume(1);

    let el = video.elt;
    el.preload = 'auto';
    el.autoplay = false;
    el.playsInline = true;
    el.muted = false;

    let holdFirstFrame = () => {
        playing = false;
        video.pause();
        if (el.readyState >= 2 && el.currentTime > 0.05) {
            el.currentTime = 0;
        }
        lockVideoDimensions();
    };

    if (!videoPausedInit) {
        videoPausedInit = true;
        el.addEventListener('loadedmetadata', lockVideoDimensions);
        el.addEventListener('loadeddata', holdFirstFrame);
        el.addEventListener('seeked', () => {
            playing = false;
            video.pause();
        });
    }

    if (el.readyState >= 1) {
        lockVideoDimensions();
    }
    if (el.readyState >= 2) {
        holdFirstFrame();
    }
}

function videoLoaded() {
    initPausedVideo();
}

function lockVideoDimensions() {
    let nativeW = video.elt.videoWidth;
    let nativeH = video.elt.videoHeight;
    if (!nativeW || !nativeH) return;

    videoNativeWidth = nativeW;
    videoNativeHeight = nativeH;
    videoDuration = video.duration();
    scrollX = width;
    updateVideoLayout();
    videoStarted = true;
}

function updateVideoLayout() {
    if (!videoNativeWidth || !videoNativeHeight) return;

    let baseScale = height / videoNativeHeight;
    let baseW = videoNativeWidth * baseScale;
    let basePairW = baseW * 2;
    let baseFit = basePairW > width ? width / basePairW : 1;
    let panelW = baseW * baseFit * videoZoom;
    let panelH = height * baseFit * videoZoom;
    let totalW = panelW * 2;
    let startX = (width - totalW) / 2;
    let startY = (height - panelH) / 2;

    videoLayout.left = { x: startX, y: startY, w: panelW, h: panelH };
    videoLayout.right = { x: startX + panelW, y: startY, w: panelW, h: panelH };
    videoLayout.w = totalW;
    videoLayout.h = panelH;
    videoLayout.x = startX;
    videoLayout.y = startY;
}

function updateVideoZoom() {
    if (!autoMode) {
        if (keyIsDown(90)) {
            targetVideoZoom = min(MAX_VIDEO_ZOOM, targetVideoZoom + VIDEO_ZOOM_STEP * 0.35);
        }
        if (keyIsDown(70)) {
            targetVideoZoom = max(MIN_VIDEO_ZOOM, targetVideoZoom - VIDEO_ZOOM_STEP * 0.35);
        }
    }

    videoZoom = lerp(videoZoom, targetVideoZoom, VIDEO_ZOOM_SMOOTH);
    if (abs(videoZoom - targetVideoZoom) < 0.001) {
        videoZoom = targetVideoZoom;
    }
    updateVideoLayout();
}

function zoomVideoIn() {
    targetVideoZoom = min(MAX_VIDEO_ZOOM, targetVideoZoom + VIDEO_ZOOM_STEP);
}

function zoomVideoOut() {
    targetVideoZoom = max(MIN_VIDEO_ZOOM, targetVideoZoom - VIDEO_ZOOM_STEP);
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    video.hide();
    initPausedVideo();
    
    textHeight = height * 0.93;
    
    textSize(20);
    textFont('Courier');
    textAlign(LEFT, CENTER);
}

function updateCursorVisibility() {
    document.body.style.cursor = playing ? 'none' : 'default';
}

function draw() {
    updateCursorVisibility();
    background(0);

    if (!videoStarted || !videoLayout.w || !videoLayout.h) {
        drawInstructions();
        return;
    }

    if (playing && autoMode) {
        updateAutoMode();
    } else if (playing && pulseMode) {
        updatePulseFromAudio();
        connectVideoAudioAnalysis();
        updateBeatTracking(readVideoAudioBands());
    } else if (playing && rotateMode) {
        connectVideoAudioAnalysis();
        let bands = readVideoAudioBands();
        smoothLevel = lerp(smoothLevel, bands.level, 0.88);
        smoothPeak = lerp(smoothPeak, bands.peak, 0.92);
        updateBeatTracking(bands);
    } else {
        decayAudioLevels();
    }

    updateVideoZoom();
    updateVisualEffects();
    if (!autoMode) {
        smoothManualBlue = lerp(smoothManualBlue, manualBlueSat, EFFECT_SMOOTH);
    }

    drawVideoPanels();

    drawScrollingLyrics();
    
    push();
    
    drawInstructions();
    
    if (recording) {
        drawRecordingIndicator();
    } else if (converting) {
        drawConvertingIndicator();
    } else if (autoMode) {
        drawAutoIndicator();
    } else {
        drawEffectIndicator();
    }
    
    pop();
}

function connectVideoAudioAnalysis() {
    if (audioConnected) return;
    try {
        userStartAudio();
        let audioContext = getAudioContext();
        video.volume(1);
        video.elt.muted = false;

        let source = audioContext.createMediaElementSource(video.elt);
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 1024;
        analyserNode.smoothingTimeConstant = 0.03;
        frequencyData = new Uint8Array(analyserNode.frequencyBinCount);

        source.connect(analyserNode);
        source.connect(audioContext.destination);
        audioConnected = true;
    } catch (err) {
        console.warn('Video audio analysis unavailable:', err);
    }
}

function readVideoAudioBands() {
    if (!analyserNode || !frequencyData) {
        return { bass: 0, mid: 0, treble: 0, level: 0, peak: 0 };
    }

    analyserNode.getByteFrequencyData(frequencyData);
    let len = frequencyData.length;
    let bassSum = 0;
    let midSum = 0;
    let trebleSum = 0;
    let totalSum = 0;
    let peak = 0;
    let bassEnd = floor(len * 0.12);
    let midEnd = floor(len * 0.5);

    for (let i = 0; i < len; i++) {
        let value = frequencyData[i];
        peak = max(peak, value);
        totalSum += value;
        if (i < bassEnd) bassSum += value;
        else if (i < midEnd) midSum += value;
        else trebleSum += value;
    }

    return {
        bass: amplifyAudio(bassSum / max(1, bassEnd)),
        mid: amplifyAudio(midSum / max(1, midEnd - bassEnd)),
        treble: amplifyAudio(trebleSum / max(1, len - midEnd)),
        level: amplifyAudio(totalSum / len),
        peak: amplifyAudio(peak)
    };
}

function amplifyAudio(value) {
    let normalized = value / 255;
    return constrain(pow(normalized, 0.45) * 2.8, 0, 1);
}

function shapeSatDrive(value) {
    if (value < 0.06) return 0;
    return constrain(pow(value, 0.7) * 1.35, 0, 1);
}

function updateAutoMode() {
    connectVideoAudioAnalysis();
    updateAutoStateCycle();

    let bands = readVideoAudioBands();
    let levelHit = max(0, bands.level - prevLevel * 0.55);
    prevLevel = bands.level;
    prevTreble = bands.treble;

    smoothLevel = lerp(smoothLevel, bands.level, 0.88);
    smoothPeak = lerp(smoothPeak, bands.peak, 0.92);

    updateBeatTracking(bands);

    let state = AUTO_STATES[autoStateIndex];
    autoGrayscale = state.grayscale;
    panelsSwapped = state.swap;
    solarizeMode = state.solarize;
    rotateMode = state.rotate;
    pulseMode = state.pulse;
    pixelateMode = state.pixelate;

    smoothAutoGrayscale = lerp(smoothAutoGrayscale, autoGrayscale ? 1 : 0, 0.1);
    grayscaleMode = smoothAutoGrayscale > 0.5;

    if (solarizeMode) {
        smoothSolarize = lerp(smoothSolarize, 0.9, 0.1);
    }

    if (pixelateMode) {
        updatePixelateFromAudio(bands, levelHit);
    }

    if (pulseMode) {
        updatePulseFromAudio(bands, levelHit);
    }

    targetVideoZoom = 1;
    manualBlueSat = 0;
    smoothManualBlue = 0;
}

function updateAutoStateCycle() {
    if (!playing || !videoDuration) return;
    autoStateIndex = floor(video.time() / (AUTO_STATE_INTERVAL_MS / 1000)) % AUTO_STATES.length;
}

function updatePulseFromAudio(bands, levelHit) {
    connectVideoAudioAnalysis();
    if (!bands) {
        bands = readVideoAudioBands();
        levelHit = max(0, bands.level - prevLevel * 0.55);
    }

    let bassHit = max(0, bands.bass - prevLevel * 0.45);
    prevLevel = bands.level;
    smoothLevel = lerp(smoothLevel, bands.level, 0.88);
    smoothPeak = lerp(smoothPeak, bands.peak, 0.92);

    let reactivePulse = shapeSatDrive(
        constrain(bands.level * 0.5 + levelHit * 2.0 + bands.peak * 0.6 + bassHit * 1.2, 0, 1)
    );
    smoothPulse = lerp(smoothPulse, max(0.5, reactivePulse), 0.35);
}

function updatePixelateFromAudio(bands, levelHit) {
    if (!bands) {
        bands = readVideoAudioBands();
        levelHit = max(0, bands.level - prevLevel * 0.55);
    }

    let bassHit = max(0, bands.bass - prevBass * 0.55);
    let trebleHit = max(0, bands.treble - prevTreble * 0.55);
    let reactivePixel = shapeSatDrive(
        constrain(bands.level * 0.55 + levelHit * 2.4 + bands.peak * 0.75 + bassHit * 1.5 + trebleHit * 1.1, 0, 1)
    );
    smoothPixelate = lerp(smoothPixelate, max(0.55, reactivePixel), 0.42);
}

function updateBeatTracking(bands) {
    let bassHit = max(0, bands.bass - prevBass * 0.68);
    prevBass = bands.bass;
    smoothBass = lerp(smoothBass, bands.bass, 0.86);

    let beatThreshold = smoothBass * 0.82 + 0.1;
    let now = millis();
    if (bassHit > beatThreshold && bassHit > 0.07 && now - lastBeatMs > 110) {
        if (lastBeatMs > 0) {
            beatInterval = lerp(beatInterval, now - lastBeatMs, 0.42);
        }
        lastBeatMs = now;
        beatPulse = 1;
    }
    beatPulse *= 0.78;

    let bpm = 60000 / max(beatInterval, 160);
    let tempoFactor = constrain(bpm / 118, 0.35, 2.8);
    let energyFactor = 0.25 + smoothBass * 1.1 + smoothLevel * 0.55 + beatPulse * 1.4;
    let targetRotateSpeed = constrain(
        ROTATE_SPEED_BASE + energyFactor * tempoFactor * 0.028 + beatPulse * 0.045,
        ROTATE_SPEED_BASE,
        ROTATE_SPEED_MAX
    );
    smoothRotateSpeed = lerp(smoothRotateSpeed, targetRotateSpeed, beatPulse > 0.5 ? 0.72 : 0.18);
}

function updateVisualEffects() {
    if (rotateMode && playing) {
        panelRotation += smoothRotateSpeed;
    } else if (rotateMode) {
        panelRotation += ROTATE_SPEED_BASE * 0.6;
    } else {
        panelRotation = lerp(panelRotation, 0, 0.08);
        smoothRotateSpeed = lerp(smoothRotateSpeed, 0, 0.12);
    }

    if (!solarizeMode || !autoMode) {
        smoothSolarize = lerp(smoothSolarize, solarizeMode ? 1 : 0, 0.1);
    }

    if (!pulseMode || !autoMode) {
        smoothPulse = lerp(smoothPulse, pulseMode ? 0.75 : 0, 0.14);
    }

    if (!pixelateMode || !autoMode) {
        smoothPixelate = lerp(smoothPixelate, pixelateMode ? 0.7 : 0, 0.14);
    }
}

function getPanelPulseTransform(w, h) {
    if (smoothPulse < 0.03) return { x: 0, y: 0, scale: 1, angle: 0 };

    let amp = smoothPulse * (0.35 + smoothPeak * 0.4 + smoothBass * 0.5 + beatPulse * 0.6);
    let beatHz = 1000 / max(beatInterval, 160);
    let t = millis() * 0.001 * beatHz * TWO_PI * 1.6;
    let shake = 1 + beatPulse * 0.45;
    return {
        x: (sin(t * 1.7) * 0.65 + sin(t * 3.4) * 0.35) * amp * w * 0.04 * shake,
        y: (cos(t * 1.9) * 0.65 + cos(t * 3.8) * 0.35) * amp * h * 0.04 * shake,
        scale: 1 + amp * 0.06 * sin(t * 1.3) * shake + beatPulse * 0.04,
        angle: amp * 0.02 * sin(t * 2.5) * shake
    };
}

function decayAudioLevels() {
    smoothLevel = lerp(smoothLevel, 0, 0.12);
    smoothPeak = lerp(smoothPeak, 0, 0.12);
    smoothTreble = lerp(smoothTreble, 0, 0.12);
    smoothBlueSat = lerp(smoothBlueSat, 0, 0.12);
    smoothBass = lerp(smoothBass, 0, 0.12);
    beatPulse = lerp(beatPulse, 0, 0.18);
    smoothRotateSpeed = lerp(smoothRotateSpeed, 0, 0.12);
    smoothPixelate = lerp(smoothPixelate, 0, 0.12);
    prevLevel = 0;
    prevTreble = 0;
    prevBass = 0;
}

function toggleAutoMode() {
    autoMode = !autoMode;
    if (autoMode) {
        connectVideoAudioAnalysis();
        autoStateIndex = 0;
        autoGrayscale = false;
        smoothAutoGrayscale = 0;
        panelsSwapped = false;
        solarizeMode = false;
        rotateMode = false;
        pulseMode = false;
        pixelateMode = false;
        panelRotation = 0;
        smoothSolarize = 0;
        smoothPulse = 0;
        smoothPixelate = 0;
        smoothRotateSpeed = 0;
        beatPulse = 0;
        lastBeatMs = 0;
    } else {
        manualBlueSat = 0;
        smoothManualBlue = 0;
        grayscaleMode = false;
        panelsSwapped = false;
        solarizeMode = false;
        rotateMode = false;
        pulseMode = false;
        pixelateMode = false;
        panelRotation = 0;
        smoothSolarize = 0;
        smoothPulse = 0;
        smoothPixelate = 0;
        smoothRotateSpeed = 0;
        beatPulse = 0;
        lastBeatMs = 0;
        targetVideoZoom = 1;
    }
}

function togglePulseMode() {
    pulseMode = !pulseMode;
}

function toggleSolarizeMode() {
    solarizeMode = !solarizeMode;
}

function toggleRotateMode() {
    rotateMode = !rotateMode;
}

function togglePanelSwap() {
    panelsSwapped = !panelsSwapped;
}

function getPanelVideoRect(panelW, panelH, seamSide) {
    let drawH = panelH;
    let drawW = drawH * (videoNativeWidth / videoNativeHeight);
    let drawX = seamSide === 'right' ? panelW - drawW : 0;
    return { x: drawX, y: 0, w: drawW, h: drawH };
}

function drawVideoPanels() {
    let left = videoLayout.left;
    let right = videoLayout.right;
    drawVideoPanel(left.x, left.y, left.w, left.h, panelsSwapped, -1);
    drawVideoPanel(right.x, right.y, right.w, right.h, !panelsSwapped, 1);
}

function drawVideoPanel(x, y, w, h, flipX, rotateDir) {
    push();
    translate(x, y);

    let pulse = getPanelPulseTransform(w, h);
    if (smoothPulse > 0.03) {
        translate(w / 2 + pulse.x, h / 2 + pulse.y);
        rotate(pulse.angle * rotateDir);
        scale(pulse.scale);
        translate(-w / 2, -h / 2);
    }

    if (abs(panelRotation) > 0.001) {
        translate(w / 2, h / 2);
        rotate(panelRotation * rotateDir);
        let rotScale = 1 / max(abs(cos(panelRotation)), abs(sin(panelRotation)), 0.65);
        scale(min(rotScale, 1.6));
        translate(-w / 2, -h / 2);
    }

    if (flipX) {
        translate(w, 0);
        scale(-1, 1);
    }

    let ctx = drawingContext;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();

    let vr = getPanelVideoRect(w, h, flipX ? 'left' : 'right');
    drawVideoContent(vr.x, vr.y, vr.w, vr.h, w, h);

    ctx.restore();
    pop();
}

function drawVideoContent(vx, vy, vw, vh, panelW, panelH) {
    if (smoothPixelate > 0.03) {
        drawPixelatedVideo(vx, vy, vw, vh, panelW, panelH, smoothPixelate);
    } else {
        image(video, vx, vy, vw, vh);
    }

    if (grayscaleMode) {
        applyGrayscale(vx, vy, vw, vh, panelW, panelH);
    }

    if (smoothManualBlue > 0.03) {
        applyBlueSaturation(vx, vy, vw, vh, panelW, panelH, smoothManualBlue);
    }

    if (smoothSolarize > 0.03) {
        applyRgbSplit(vx, vy, vw, vh, panelW, panelH, smoothSolarize);
    }
}

function applyGrayscale(vx, vy, vw, vh, panelW, panelH) {
    let ctx = drawingContext;

    push();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, panelW, panelH);
    ctx.clip();
    ctx.filter = 'grayscale(1) contrast(1.05)';
    tint(255, 255, 255, 255);
    image(video, vx, vy, vw, vh);
    ctx.filter = 'none';
    ctx.restore();
    pop();
}

function applyBlueSaturation(vx, vy, vw, vh, panelW, panelH, amount) {
    if (amount < 0.03) return;

    let ctx = drawingContext;

    push();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, panelW, panelH);
    ctx.clip();

    blendMode(SOFT_LIGHT);
    tint(28, 48, 255, amount * 220);
    image(video, vx, vy, vw, vh);
    if (amount > 0.45) {
        blendMode(SCREEN);
        tint(18, 36, 255, (amount - 0.45) * 280);
        image(video, vx, vy, vw, vh);
    }

    ctx.restore();
    pop();
}

function applyRgbSplit(vx, vy, vw, vh, panelW, panelH, amount) {
    if (amount < 0.03) return;

    let amp = amount;
    let split = 10 + amp * 22 + beatPulse * 14;
    let ctx = drawingContext;

    push();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, panelW, panelH);
    ctx.clip();

    blendMode(ADD);
    noStroke();

    tint(255, 24, 24, amp * 240);
    image(video, vx - split, vy, vw, vh);

    tint(24, 255, 48, amp * 240);
    image(video, vx, vy, vw, vh);

    tint(32, 64, 255, amp * 240);
    image(video, vx + split, vy, vw, vh);

    noTint();
    blendMode(BLEND);
    ctx.restore();
    pop();
}

function drawPixelatedVideo(vx, vy, vw, vh, panelW, panelH, amount) {
    let blockSize = floor(map(amount + beatPulse * 0.55, 0, 1.5, 52, 8));
    blockSize = max(6, blockSize);
    let bufW = max(1, floor(vw / blockSize));
    let bufH = max(1, floor(vh / blockSize));

    if (!pixelBuffer) {
        pixelBuffer = createGraphics(bufW, bufH);
    } else if (pixelBuffer.width !== bufW || pixelBuffer.height !== bufH) {
        pixelBuffer.resizeCanvas(bufW, bufH);
    }

    pixelBuffer.noSmooth();
    pixelBuffer.image(video, 0, 0, bufW, bufH);

    push();
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(0, 0, panelW, panelH);
    drawingContext.clip();
    noSmooth();
    image(pixelBuffer, vx, vy, vw, vh);
    smooth();
    drawingContext.restore();
    pop();
}

function drawScrollingLyrics() {
    push();
    noStroke();
    fill(0, 0, 0, 200);
    rect(0, textHeight - 25, width, 50);

    for (let i = 0; i < 10; i++) {
        let alpha = map(i, 0, 10, 100, 0);
        fill(0, 0, 0, alpha);
        rect(0, textHeight - 25 - i, width, 1);
        rect(0, textHeight + 24 + i, width, 1);
    }

    if (videoStarted && videoDuration) {
        fill(255);
        textSize(20);
        textFont('Courier');
        textAlign(LEFT, CENTER);
        let textW = textWidth(poem);
        let totalScrollWidth = width + textW;
        let progress = (video.time() / videoDuration) * TICKER_SPEED;
        scrollX = width - (totalScrollWidth * progress);
        text(poem, scrollX, textHeight);

        if (scrollX < width / 2) {
            text(poem, scrollX + totalScrollWidth, textHeight);
        }
    }
    pop();
}

function getRecordingFormat() {
    let formats = [
        { mimeType: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', extension: 'mp4' },
        { mimeType: 'video/mp4', extension: 'mp4' },
        { mimeType: 'video/quicktime', extension: 'mov' },
        { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
        { mimeType: 'video/webm', extension: 'webm' }
    ];
    
    for (let format of formats) {
        if (MediaRecorder.isTypeSupported(format.mimeType)) {
            return format;
        }
    }
    
    return { mimeType: '', extension: 'webm' };
}

async function downloadRecording() {
    if (!lastRecordingBlob || !hasRecording || converting) return;
    
    let blob = lastRecordingBlob;
    let extension = recordingExtension;
    
    if (recordingNeedsConversion) {
        converting = true;
        try {
            blob = await convertRecordingToMp4(blob);
            extension = 'mp4';
        } catch (err) {
            console.error('Could not convert recording to MP4:', err);
            converting = false;
            return;
        }
        converting = false;
    }
    
    let link = document.createElement('a');
    let url = URL.createObjectURL(blob);
    link.href = url;
    link.download = 'boys-will-be-proud-' + Date.now() + '.' + extension;
    link.click();
    URL.revokeObjectURL(url);
}

async function convertRecordingToMp4(inputBlob) {
    const { FFmpeg } = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js');
    const { fetchFile, toBlobURL } = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js');
    
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
        coreURL: await toBlobURL(baseURL + '/ffmpeg-core.js', 'text/javascript'),
        wasmURL: await toBlobURL(baseURL + '/ffmpeg-core.wasm', 'application/wasm')
    });
    
    await ffmpeg.writeFile('input.webm', await fetchFile(inputBlob));
    await ffmpeg.exec(['-i', 'input.webm', '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart', 'output.mp4']);
    let data = await ffmpeg.readFile('output.mp4');
    return new Blob([data.buffer], { type: 'video/mp4' });
}

function drawInstructions() {
    if (!showInstructions) return;
    
    push();
    textAlign(LEFT, TOP);
    textSize(9);
    textFont('Courier');
    fill(255, 255, 255, 90);
    noStroke();
    
    let x = 62;
    let y = 60;
    let lineHeight = 11;
    let lines = [
        'space  play / pause',
        'a  automate',
        'l  loop',
        'z  zoom in',
        'f  zoom out',
        'b  blue +',
        'v  blue -',
        'g  black & white',
        'c  swap sides',
        's  solarize',
        't  rotate',
        'p  pulse',
        'r  record',
        'd  download',
        'h  hide'
    ];
    
    for (let i = 0; i < lines.length; i++) {
        text(lines[i], x, y);
        y += lineHeight;
    }
    
    pop();
}

function drawConvertingIndicator() {
    push();
    textAlign(RIGHT, TOP);
    textSize(9);
    textFont('Courier');
    fill(255, 255, 255, 120);
    noStroke();
    text('saving mp4…', width - 12, 12);
    pop();
}

function drawEffectIndicator() {
    let parts = [];
    if (grayscaleMode) parts.push('bw');
    if (panelsSwapped) parts.push('swap');
    if (smoothSolarize > 0.03) parts.push('solarize');
    if (rotateMode) parts.push('rotate');
    if (smoothPulse > 0.03) parts.push('pulse');
    if (manualBlueSat > 0.03) parts.push('blue');
    if (targetVideoZoom > 1.01) parts.push('zoom');
    if (!parts.length) return;

    push();
    textAlign(RIGHT, TOP);
    textSize(9);
    textFont('Courier');
    fill(255, 255, 255, 120);
    noStroke();
    text(parts.join(' + '), width - 12, 12);
    pop();
}

function drawAutoIndicator() {
    let state = AUTO_STATES[autoStateIndex];
    push();
    textAlign(RIGHT, TOP);
    textSize(9);
    textFont('Courier');
    fill(255, 255, 255, 120);
    noStroke();
    text('auto: ' + state.name, width - 12, 12);
    pop();
}

function drawRecordingIndicator() {
    push();
    noStroke();
    fill(220, 40, 40, 200);
    ellipse(width - 16, 16, 8, 8);
    textAlign(RIGHT, TOP);
    textSize(9);
    textFont('Courier');
    fill(255, 255, 255, 120);
    text('rec', width - 24, 12);
    pop();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    textHeight = height * 0.93;
    updateVideoLayout();
}

function keyPressed() {
    if (keyCode === 32) {
        togglePlayPause();
        return false;
    } else if (key.toLowerCase() === 'a') {
        toggleAutoMode();
    } else if (key.toLowerCase() === 'l') {
        toggleLoop();
    } else if (key.toLowerCase() === 'z') {
        zoomVideoIn();
        return false;
    } else if (key.toLowerCase() === 'f') {
        zoomVideoOut();
        return false;
    } else if (key.toLowerCase() === 'b') {
        manualBlueSat = min(1, manualBlueSat + MANUAL_BLUE_STEP);
    } else if (key.toLowerCase() === 'v') {
        manualBlueSat = max(0, manualBlueSat - MANUAL_BLUE_STEP);
    } else if (key.toLowerCase() === 'g') {
        grayscaleMode = !grayscaleMode;
    } else if (key.toLowerCase() === 'c') {
        if (!autoMode) togglePanelSwap();
    } else if (key.toLowerCase() === 's') {
        if (!autoMode) toggleSolarizeMode();
    } else if (key.toLowerCase() === 't') {
        if (!autoMode) toggleRotateMode();
    } else if (key.toLowerCase() === 'p') {
        if (!autoMode) togglePulseMode();
    } else if (key.toLowerCase() === 'r') {
        toggleRecording();
    } else if (key.toLowerCase() === 'd') {
        downloadRecording();
    } else if (key.toLowerCase() === 'h') {
        showInstructions = !showInstructions;
    }
}

function togglePlayPause() {
    if (playing) {
        video.pause();
        playing = false;
    } else {
        video.play();
        playing = true;
    }
}

function toggleLoop() {
    loopMode = !loopMode;
    if (loopMode) {
        video.loop();
    } else {
        video.noLoop();
    }
}

function toggleRecording() {
    if (recording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    let canvas = document.querySelector('canvas');
    if (!canvas || !canvas.captureStream) return;
    
    let stream = canvas.captureStream(30);
    let videoEl = video.elt;
    
    if (videoEl && videoEl.captureStream) {
        let videoStream = videoEl.captureStream();
        videoStream.getAudioTracks().forEach(track => stream.addTrack(track));
    }
    
    recordedChunks = [];
    let format = getRecordingFormat();
    recordingExtension = format.extension;
    recordingNeedsConversion = format.extension === 'webm';
    
    let options = format.mimeType ? { mimeType: format.mimeType } : {};
    mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
        if (lastRecordingUrl) URL.revokeObjectURL(lastRecordingUrl);
        let mimeType = format.mimeType || mediaRecorder.mimeType || 'video/webm';
        lastRecordingBlob = new Blob(recordedChunks, { type: mimeType });
        lastRecordingUrl = URL.createObjectURL(lastRecordingBlob);
        hasRecording = true;
    };
    mediaRecorder.start();
    recording = true;
    
    if (!playing) {
        video.play();
        playing = true;
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    recording = false;
}
