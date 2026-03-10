import "@babylonjs/core/Audio/audioSceneComponent";
import "@babylonjs/core/Audio/audioEngine";
import { Sound } from "@babylonjs/core/Audio/sound";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import "./style.css";
import {
  BabylonSceneRecorder,
  type OutputFormatOption,
  type RecorderDiagnostics,
  type RenderFrameRequest
} from "./recorder";
import { MkvOutputFormat, MovOutputFormat, Mp4OutputFormat, WebMOutputFormat } from "mediabunny";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

app.innerHTML = `
  <div class="shell">
    <section class="panel">
      <div class="panel-body">
        <div class="panel-head">
          <div class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" role="presentation">
              <path d="M14 12h36a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6Zm0 4a2 2 0 0 0-2 2v4h6v-6Zm10 0v6h16v-6Zm20 0v6h8v-4a2 2 0 0 0-2-2Zm8 10h-8v12h8Zm0 16h-8v6h6a2 2 0 0 0 2-2Zm-12 6v-26H24v26Zm-20 0v-6h-8v4a2 2 0 0 0 2 2Zm-8-10h8V26h-8Z" />
              <path d="M28 28h8a2 2 0 0 1 1.6 3.2l-4 5.33a2 2 0 0 1-3.2 0l-4-5.33A2 2 0 0 1 28 28Z" />
            </svg>
          </div>
          <div class="panel-head-copy">
            <p class="eyebrow">DEMO: Babylon Scene to Video</p>
            <h1>BabyRecorder</h1>
          </div>
        </div>
        <p id="lede" class="lede">
          Records the live Babylon canvas with MediaBunny and exports a video file.
        </p>
        <div class="section">
          <p class="section-title">Output</p>
          <div class="controls controls-output">
            <label class="field">
              <span>Format</span>
              <select id="output-format">
                <option value="mp4">MP4 (.mp4)</option>
                <option value="webm">WebM (.webm)</option>
                <option value="mkv">MKV (.mkv)</option>
                <option value="mov">MOV (.mov)</option>
              </select>
            </label>
            <label class="field">
              <span>Bitrate Mbps</span>
              <input id="bitrate" type="number" min="1" max="50" step="0.5" value="8" />
            </label>
          </div>
        </div>
        <div class="section">
          <p class="section-title">Capture</p>
          <div class="controls controls-mode">
            <label class="field field-wide">
              <span>Mode</span>
              <select id="mode" title="Realtime records the live Babylon canvas.">
                <option value="realtime">Realtime Capture</option>
                <option value="deterministic">Fast Export</option>
                <option value="fixed-delta">Fixed Delta</option>
              </select>
            </label>
          </div>
          <div id="realtime-controls" class="controls">
            <label class="field">
              <span>FPS</span>
              <input id="fps" type="number" min="1" max="60" value="60" />
            </label>
          </div>
          <div id="deterministic-controls" class="controls hidden">
            <label class="field">
              <span>FPS</span>
              <input id="fps-deterministic" type="number" min="1" max="60" value="30" />
            </label>
            <label id="duration-field" class="field">
              <span>Duration Seconds</span>
              <input id="duration" type="number" min="1" max="1200" step="1" value="5" />
            </label>
          </div>
          <div id="fixed-delta-controls" class="controls hidden">
            <label id="fixed-delta-field" class="field">
              <span>Fixed Delta Ms</span>
              <input id="fixed-delta" type="number" min="1" max="1000" step="0.01" value="16.67" />
              <small id="fixed-delta-fps" class="hint">Related FPS: 59.99</small>
            </label>
            <label class="field">
              <span>Duration Seconds</span>
              <input id="duration-fixed-delta" type="number" min="1" max="1200" step="1" value="5" />
            </label>
          </div>
        </div>
        <div class="section">
          <p class="section-title">Recording</p>
          <div class="actions actions-primary">
            <button id="start-recording" type="button">Record</button>
            <button id="pause-recording" type="button" disabled>Pause</button>
            <button id="stop-recording" type="button" disabled>Stop</button>
          </div>
        </div>
        <div class="section">
          <p class="section-title">Result</p>
          <div class="actions actions-secondary">
            <button id="show-preview" type="button" disabled>Preview</button>
            <button id="download-video" type="button" disabled>Download</button>
          </div>
        </div>
        <div class="meta">
          <p id="status" class="status">Idle</p>
          <div class="audio-tools">
            <div class="audio-meta">
              <p id="audio-status" class="audio-status">Scene audio: checking browser support.</p>
              <label class="audio-checkbox" for="use-microphone-audio">
                <input id="use-microphone-audio" type="checkbox" />
                <span>Use microphone audio</span>
              </label>
              <label class="audio-level" for="microphone-level">
                <span>Mic level</span>
                <input id="microphone-level" type="range" min="1" max="300" step="1" value="180" />
                <strong id="microphone-level-value">180%</strong>
              </label>
            </div>
            <button id="play-sample-sound" type="button">Play Sample Sound</button>
          </div>
          <div class="diagnostics">
            <p><span>Codec</span><strong id="diag-codec">-</strong></p>
            <p><span>Frames</span><strong id="diag-frames">0</strong></p>
            <p><span>Recorded</span><strong id="diag-duration">0.0s</strong></p>
            <p><span>File Size</span><strong id="diag-size">-</strong></p>
          </div>
        </div>
        <p id="mode-info" class="mode-info">
          <span class="lede-live-label">LIVE MODE:</span> records the live Babylon canvas.
        </p>
      </div>
      <footer class="panel-footer">
        <p class="panel-footer-copy">Created by <a href="https://babylonpress.org/" target="_blank" rel="noreferrer">BabylonPress</a></p>
        <a href="https://github.com/eldinor/babyrecorder" target="_blank" rel="noreferrer">Source</a>
      </footer>
    </section>
    <section class="viewport">
      <canvas id="render-canvas"></canvas>
    </section>
  </div>
  <dialog id="preview-dialog" class="preview-dialog">
    <div class="preview-card">
      <div class="preview-head">
        <h2>Recorded Video</h2>
        <div class="preview-actions">
          <button id="preview-download" type="button" title="Download video" aria-label="Download video">↓</button>
          <button id="close-preview" type="button" title="Close preview" aria-label="Close preview">×</button>
        </div>
      </div>
      <video id="preview-video" controls playsinline></video>
    </div>
  </dialog>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#render-canvas");
const status = document.querySelector<HTMLParagraphElement>("#status");
const lede = document.querySelector<HTMLParagraphElement>("#lede");
const outputFormatInput = document.querySelector<HTMLSelectElement>("#output-format");
const modeInput = document.querySelector<HTMLSelectElement>("#mode");
const modeInfo = document.querySelector<HTMLElement>("#mode-info");
const fpsInput = document.querySelector<HTMLInputElement>("#fps");
const deterministicFpsInput = document.querySelector<HTMLInputElement>("#fps-deterministic");
const realtimeControls = document.querySelector<HTMLElement>("#realtime-controls");
const deterministicControls = document.querySelector<HTMLElement>("#deterministic-controls");
const fixedDeltaControls = document.querySelector<HTMLElement>("#fixed-delta-controls");
const durationInput = document.querySelector<HTMLInputElement>("#duration");
const fixedDeltaDurationInput = document.querySelector<HTMLInputElement>("#duration-fixed-delta");
const fixedDeltaInput = document.querySelector<HTMLInputElement>("#fixed-delta");
const fixedDeltaFps = document.querySelector<HTMLElement>("#fixed-delta-fps");
const bitrateInput = document.querySelector<HTMLInputElement>("#bitrate");
const startButton = document.querySelector<HTMLButtonElement>("#start-recording");
const pauseButton = document.querySelector<HTMLButtonElement>("#pause-recording");
const stopButton = document.querySelector<HTMLButtonElement>("#stop-recording");
const showPreviewButton = document.querySelector<HTMLButtonElement>("#show-preview");
const downloadVideoButton = document.querySelector<HTMLButtonElement>("#download-video");
const audioTools = document.querySelector<HTMLElement>(".audio-tools");
const audioStatus = document.querySelector<HTMLParagraphElement>("#audio-status");
const useMicrophoneAudioInput = document.querySelector<HTMLInputElement>("#use-microphone-audio");
const microphoneLevelInput = document.querySelector<HTMLInputElement>("#microphone-level");
const microphoneLevelValue = document.querySelector<HTMLElement>("#microphone-level-value");
const playSampleSoundButton = document.querySelector<HTMLButtonElement>("#play-sample-sound");
const previewDialog = document.querySelector<HTMLDialogElement>("#preview-dialog");
const previewVideo = document.querySelector<HTMLVideoElement>("#preview-video");
const previewDownloadButton = document.querySelector<HTMLButtonElement>("#preview-download");
const closePreviewButton = document.querySelector<HTMLButtonElement>("#close-preview");
const diagCodec = document.querySelector<HTMLElement>("#diag-codec");
const diagFrames = document.querySelector<HTMLElement>("#diag-frames");
const diagDuration = document.querySelector<HTMLElement>("#diag-duration");
const diagSize = document.querySelector<HTMLElement>("#diag-size");

if (
  !canvas ||
  !status ||
  !lede ||
  !outputFormatInput ||
  !modeInput ||
  !modeInfo ||
  !fpsInput ||
  !deterministicFpsInput ||
  !realtimeControls ||
  !deterministicControls ||
  !fixedDeltaControls ||
  !durationInput ||
  !fixedDeltaDurationInput ||
  !fixedDeltaInput ||
  !fixedDeltaFps ||
  !bitrateInput ||
  !startButton ||
  !pauseButton ||
  !stopButton ||
  !showPreviewButton ||
  !downloadVideoButton ||
  !audioTools ||
  !audioStatus ||
  !useMicrophoneAudioInput ||
  !microphoneLevelInput ||
  !microphoneLevelValue ||
  !playSampleSoundButton ||
  !previewDialog ||
  !previewVideo ||
  !previewDownloadButton ||
  !closePreviewButton ||
  !diagCodec ||
  !diagFrames ||
  !diagDuration ||
  !diagSize
) {
  throw new Error("UI bootstrap failed.");
}

const renderDiagnostics = (diagnostics: RecorderDiagnostics) => {
  diagCodec.textContent = diagnostics.codec ? diagnostics.codec.toUpperCase() : "-";
  diagFrames.textContent = String(diagnostics.framesCaptured);
  diagDuration.textContent = `${diagnostics.recordedSeconds.toFixed(1)}s`;
  diagSize.textContent =
    diagnostics.fileSizeBytes === null ? "-" : `${(diagnostics.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`;
};

renderDiagnostics({
  codec: null,
  framesCaptured: 0,
  recordedSeconds: 0,
  fileSizeBytes: null,
});

const outputFormats = {
  mp4: new Mp4OutputFormat(),
  webm: new WebMOutputFormat(),
  mkv: new MkvOutputFormat(),
  mov: new MovOutputFormat(),
} satisfies Record<OutputFormatOption, Mp4OutputFormat | WebMOutputFormat | MkvOutputFormat | MovOutputFormat>;

for (const [key, format] of Object.entries(outputFormats)) {
  console.log(`BabyRecorder ${key.toUpperCase()} video codecs:`, format.getSupportedVideoCodecs());
  console.log(`BabyRecorder ${key.toUpperCase()} audio codecs:`, format.getSupportedAudioCodecs());
}

const engine = new Engine(canvas, true, {
  audioEngine: true,
  preserveDrawingBuffer: true,
  stencil: true,
});

const scene = new Scene(engine);
scene.clearColor.set(0.04, 0.06, 0.1, 1);

const camera = new ArcRotateCamera("camera", Math.PI / 2.2, Math.PI / 2.5, 10, Vector3.Zero(), scene);
scene.activeCamera = camera;
camera.attachControl(canvas, true);
camera.wheelDeltaPercentage = 0.01;

const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
light.intensity = 1.1;
light.groundColor = new Color3(0.05, 0.08, 0.12);

const ground = MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, scene);
const sphere = MeshBuilder.CreateSphere("sphere", { diameter: 1.4, segments: 32 }, scene);
const box = MeshBuilder.CreateBox("box", { size: 1.3 }, scene);
const torus = MeshBuilder.CreateTorus("torus", { thickness: 0.24, diameter: 2.2, tessellation: 48 }, scene);

sphere.position = new Vector3(0, 1.5, 0);
box.position = new Vector3(-2.1, 0.9, 1.2);
torus.position = new Vector3(2.1, 1.4, -1.1);
torus.rotation.x = Math.PI / 2;

const groundMaterial = new StandardMaterial("ground-material", scene);
groundMaterial.diffuseColor = new Color3(0.12, 0.16, 0.22);
groundMaterial.specularColor = new Color3(0.02, 0.02, 0.02);
ground.material = groundMaterial;

const sphereMaterial = new StandardMaterial("sphere-material", scene);
sphereMaterial.diffuseColor = new Color3(0.98, 0.43, 0.29);
sphereMaterial.emissiveColor = new Color3(0.16, 0.04, 0.03);
sphere.material = sphereMaterial;

const boxMaterial = new StandardMaterial("box-material", scene);
boxMaterial.diffuseColor = new Color3(0.28, 0.72, 0.91);
box.material = boxMaterial;

const torusMaterial = new StandardMaterial("torus-material", scene);
torusMaterial.diffuseColor = new Color3(0.95, 0.82, 0.32);
torus.material = torusMaterial;

const sampleMeshes = {
  ground,
  sphere,
  box,
  torus,
};

const resize = () => engine.resize();
window.addEventListener("resize", resize);

const createSampleToneBuffer = (audioContext: AudioContext): AudioBuffer => {
  const sampleRate = audioContext.sampleRate;
  const durationSeconds = 1.4;
  const frameCount = Math.floor(sampleRate * durationSeconds);
  const audioBuffer = audioContext.createBuffer(1, frameCount, sampleRate);
  const channel = audioBuffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    const time = index / sampleRate;
    const envelope = time < 0.04 ? time / 0.04 : Math.exp(-(time - 0.04) * 3.2);
    const carrier = Math.sin(2 * Math.PI * 440 * time);
    const harmony = Math.sin(2 * Math.PI * 659.25 * time) * 0.45;
    const shimmer = Math.sin(2 * Math.PI * 880 * time) * 0.2;
    channel[index] = (carrier + harmony + shimmer) * envelope * 0.35;
  }

  return audioBuffer;
};

const applySceneState = (timeSeconds: number) => {
  if (!sampleMeshes.sphere || sampleMeshes.sphere.isDisposed()) {
    return;
  }

  sampleMeshes.sphere.position.y = 1.4 + Math.sin(timeSeconds * 1.8) * 0.55;
  sampleMeshes.sphere.rotation.y = timeSeconds * 1.2;

  sampleMeshes.box.position.z = 1.2 + Math.sin(timeSeconds * 1.1) * 0.5;
  sampleMeshes.box.rotation.x = timeSeconds * 0.7;
  sampleMeshes.box.rotation.y = -timeSeconds * 1.1;

  sampleMeshes.torus.position.x = 2.1 + Math.cos(timeSeconds * 1.4) * 0.4;
  sampleMeshes.torus.rotation.z = timeSeconds * 1.5;
};

const renderSceneAt = (timeSeconds: number) => {
  applySceneState(timeSeconds);
  scene.render();
};

let previewPlaybackEnabled = true;
let fixedDeltaSceneTime = 0;
let activeMode: "realtime" | "deterministic" | "fixed-delta" | null = null;
let sampleSound: Sound | null = null;
let sceneAudioDestination: MediaStreamAudioDestinationNode | null = null;
let microphoneStream: MediaStream | null = null;
let mixedRecordingTrack: MediaStreamTrack | null = null;
let releaseRecordingAudio: (() => void) | null = null;
let activeMicGainNode: GainNode | null = null;
let isRecordingActive = false;

const getMicrophoneLevel = () => Number(microphoneLevelInput.value) / 100;

const updateMicrophoneLevelUi = () => {
  microphoneLevelValue.textContent = `${microphoneLevelInput.value}%`;
  if (activeMicGainNode) {
    activeMicGainNode.gain.value = getMicrophoneLevel();
  }
};

const updateAudioStatus = () => {
  const audioContext = Engine.audioEngine?.audioContext ?? null;
  const hasWebAudio = typeof window.AudioContext !== "undefined";

  if (!hasWebAudio) {
    audioStatus.textContent = "Scene audio: Web Audio is unavailable in this browser/runtime.";
    playSampleSoundButton.disabled = true;
    return;
  }

  if (!audioContext) {
    audioStatus.textContent = "Scene audio: Babylon audio engine is not initialized.";
    playSampleSoundButton.disabled = true;
    return;
  }

  const canCreateMediaStreamDestination = typeof audioContext.createMediaStreamDestination === "function";
  const unlocked = Engine.audioEngine?.unlocked ?? false;
  const lockState = unlocked ? "unlocked" : "locked until click";
  const captureState = canCreateMediaStreamDestination ? "capture-ready" : "playback-only";
  audioStatus.textContent = `Scene audio: ${captureState}, ${lockState}.`;
  playSampleSoundButton.disabled = false;
};

const ensureSampleSound = (): Sound => {
  if (sampleSound) {
    return sampleSound;
  }

  const audioContext = Engine.audioEngine?.audioContext ?? null;
  if (!audioContext) {
    throw new Error("Babylon audio context is not available.");
  }

  sampleSound = new Sound("sample-tone", createSampleToneBuffer(audioContext), scene, undefined, {
    loop: false,
    spatialSound: false,
    volume: 0.85,
    maxDistance: 18,
    refDistance: 2,
    rolloffFactor: 1.15,
  });
  return sampleSound;
};

const ensureSceneAudioTrack = (): MediaStreamTrack | null => {
  const audioEngine = Engine.audioEngine;
  const audioContext = audioEngine?.audioContext ?? null;
  if (!audioEngine || !audioContext) {
    return null;
  }

  if (!sceneAudioDestination) {
    sceneAudioDestination = audioContext.createMediaStreamDestination();
    audioEngine.masterGain.connect(sceneAudioDestination);
  }

  return sceneAudioDestination.stream.getAudioTracks()[0] ?? null;
};

const releaseRecordingAudioGraph = () => {
  releaseRecordingAudio?.();
  releaseRecordingAudio = null;
  activeMicGainNode = null;

  if (mixedRecordingTrack) {
    mixedRecordingTrack.stop();
    mixedRecordingTrack = null;
  }

  if (microphoneStream) {
    for (const track of microphoneStream.getTracks()) {
      track.stop();
    }

    microphoneStream = null;
  }
};

const ensureMicrophoneStream = async (): Promise<MediaStream> => {
  if (microphoneStream) {
    const activeTrack = microphoneStream.getAudioTracks()[0];
    if (activeTrack && activeTrack.readyState === "live") {
      return microphoneStream;
    }

    releaseRecordingAudioGraph();
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone capture is not supported in this browser.");
  }

  microphoneStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: { ideal: 2 },
      sampleRate: { ideal: 48_000 },
      sampleSize: { ideal: 24 },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    }
  });

  return microphoneStream;
};

const ensureRecordingAudioTrack = async (includeMicrophone: boolean): Promise<MediaStreamTrack | null> => {
  releaseRecordingAudioGraph();

  const sceneTrack = ensureSceneAudioTrack();
  if (!includeMicrophone) {
    return sceneTrack;
  }

  const micStream = await ensureMicrophoneStream();
  const micTrack = micStream.getAudioTracks()[0] ?? null;
  if (!sceneTrack) {
    return micTrack;
  }

  const audioContext = Engine.audioEngine?.audioContext ?? null;
  if (!audioContext) {
    return micTrack ?? sceneTrack;
  }

  const mixedDestination = audioContext.createMediaStreamDestination();
  const sceneSource = audioContext.createMediaStreamSource(new MediaStream([sceneTrack]));
  const sceneGain = audioContext.createGain();
  sceneGain.gain.value = 1;

  const micSource = audioContext.createMediaStreamSource(micStream);
  const micGain = audioContext.createGain();
  micGain.gain.value = getMicrophoneLevel();

  sceneSource.connect(sceneGain);
  sceneGain.connect(mixedDestination);
  micSource.connect(micGain);
  micGain.connect(mixedDestination);

  activeMicGainNode = micGain;
  mixedRecordingTrack = mixedDestination.stream.getAudioTracks()[0] ?? null;
  releaseRecordingAudio = () => {
    sceneSource.disconnect();
    sceneGain.disconnect();
    micSource.disconnect();
    micGain.disconnect();
  };

  return mixedRecordingTrack;
};

const recorder = new BabylonSceneRecorder(canvas, {
  onStatus: (message) => {
    status.textContent = message;
  },
  onRecordingChange: (isRecording) => {
    isRecordingActive = isRecording;
    outputFormatInput.disabled = isRecording;
    modeInput.disabled = isRecording;
    useMicrophoneAudioInput.disabled = isRecording;
    microphoneLevelInput.disabled = isRecording;
    fpsInput.disabled = isRecording && activeMode === "fixed-delta";
    durationInput.disabled = isRecording;
    fixedDeltaInput.disabled = isRecording;
    startButton.disabled = isRecording;
    stopButton.disabled = !isRecording;
    pauseButton.disabled = !isRecording || activeMode === "deterministic" || activeMode === "fixed-delta";
    if (!isRecording) {
      releaseRecordingAudioGraph();
      pauseButton.textContent = "Pause";
      activeMode = null;
      syncModeUi();
    }
  },
  onPauseChange: (isPaused) => {
    pauseButton.textContent = isPaused ? "Resume" : "Pause";
  },
  onPreviewReady: (previewUrl) => {
    showPreviewButton.disabled = !previewUrl;
    previewVideo.src = previewUrl ?? "";
  },
  onDownloadReady: (downloadReady) => {
    downloadVideoButton.disabled = !downloadReady;
  },
  onDiagnosticsChange: (diagnostics) => {
    renderDiagnostics(diagnostics);
  },
  renderFrame: (frame: RenderFrameRequest) => {
    if (frame.mode === "deterministic") {
      renderSceneAt(frame.timestampSeconds);
      return;
    }

    fixedDeltaSceneTime = frame.frameIndex === 0 ? 0 : fixedDeltaSceneTime + frame.deltaSeconds;
    renderSceneAt(fixedDeltaSceneTime);
  },
  setPreviewPlaybackEnabled: (enabled) => {
    previewPlaybackEnabled = enabled;
    if (enabled) {
      fixedDeltaSceneTime = 0;
    }
  },
});

let elapsedSeconds = 0;

engine.runRenderLoop(() => {
  if (!previewPlaybackEnabled) {
    return;
  }

  const deltaSeconds = engine.getDeltaTime() / 1000;
  elapsedSeconds += deltaSeconds;
  renderSceneAt(elapsedSeconds);
});

const updateFixedDeltaFps = () => {
  const deltaMs = Number(fixedDeltaInput.value);
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
    fixedDeltaFps.textContent = "Related FPS: -";
    return;
  }

  fixedDeltaFps.textContent = `Related FPS: ${(1000 / deltaMs).toFixed(2)}`;
};

const syncModeUi = () => {
  const mode = modeInput.value as "realtime" | "deterministic" | "fixed-delta";
  realtimeControls.classList.toggle("hidden", mode !== "realtime");
  deterministicControls.classList.toggle("hidden", mode !== "deterministic");
  fixedDeltaControls.classList.toggle("hidden", mode !== "fixed-delta");
  audioTools.classList.toggle("hidden", mode !== "realtime");
  fpsInput.disabled = mode !== "realtime" || startButton.disabled;
  deterministicFpsInput.disabled = mode !== "deterministic" || startButton.disabled;
  pauseButton.disabled = mode !== "realtime" || !isRecordingActive;

  if (mode === "realtime") {
    lede.classList.remove("lede-offline");
    lede.classList.add("lede-live");
    lede.innerHTML =
      '<span class="lede-live-label">LIVE MODE:</span> records the live Babylon canvas with MediaBunny and exports a video file.';
    modeInput.title = "Realtime records the live Babylon canvas.";
    modeInfo.className = "mode-info lede-live";
    modeInfo.innerHTML = '<span class="lede-live-label">LIVE MODE:</span> records the live Babylon canvas.';
    startButton.textContent = "Record";
    stopButton.textContent = "Stop";
    return;
  }

  if (mode === "deterministic") {
    lede.classList.remove("lede-live");
    lede.classList.add("lede-offline");
    lede.innerHTML =
      '<span class="lede-warning">OFFLINE MODE:</span> export runs off the live preview timeline, renders frames as fast as possible, and currently records no audio.';
    modeInput.title =
      "Fast export renders exact timestamps frame-by-frame, auto-finishes at the chosen duration, and suspends live preview playback.";
    modeInfo.className = "mode-info lede-offline";
    modeInfo.innerHTML =
      '<span class="lede-warning">OFFLINE MODE:</span> renders exact timestamps as fast as possible.';
    startButton.textContent = "Record";
    stopButton.textContent = "Stop";
    return;
  }

  lede.classList.remove("lede-live");
  lede.classList.add("lede-offline");
  lede.innerHTML =
    '<span class="lede-warning">OFFLINE MODE:</span> export uses a fixed simulation step, runs outside live playback timing, and currently records no audio.';
  modeInput.title =
    "Fixed Delta export advances the scene using a fixed simulation step each frame and auto-finishes at the chosen duration.";
  modeInfo.className = "mode-info lede-offline";
  modeInfo.innerHTML = '<span class="lede-warning">OFFLINE MODE:</span> uses a fixed simulation step for each frame.';
  startButton.textContent = "Record";
  stopButton.textContent = "Stop";
};

modeInput.addEventListener("change", syncModeUi);
fixedDeltaInput.addEventListener("input", updateFixedDeltaFps);
updateFixedDeltaFps();
syncModeUi();
updateAudioStatus();
updateMicrophoneLevelUi();
microphoneLevelInput.addEventListener("input", updateMicrophoneLevelUi);

startButton.addEventListener("click", async () => {
  const frameRate = Number(modeInput.value === "deterministic" ? deterministicFpsInput.value : fpsInput.value);
  const bitrateMbps = Number(bitrateInput.value);
  const durationSeconds = Number(
    modeInput.value === "fixed-delta" ? fixedDeltaDurationInput.value : durationInput.value,
  );
  const fixedDeltaMs = Number(fixedDeltaInput.value);

  if (!Number.isFinite(frameRate) || frameRate <= 0) {
    status.textContent = "FPS must be greater than 0.";
    return;
  }

  if (!Number.isFinite(bitrateMbps) || bitrateMbps <= 0) {
    status.textContent = "Bitrate must be greater than 0.";
    return;
  }

  if (modeInput.value === "deterministic" && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)) {
    status.textContent = "Duration must be greater than 0 for deterministic export.";
    return;
  }

  if (modeInput.value === "fixed-delta") {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      status.textContent = "Duration must be greater than 0 for Fixed Delta export.";
      return;
    }

    if (!Number.isFinite(fixedDeltaMs) || fixedDeltaMs <= 0) {
      status.textContent = "Fixed delta must be greater than 0 ms.";
      return;
    }
  }

  try {
    Engine.audioEngine?.unlock();
    const audioContext = Engine.audioEngine?.audioContext ?? null;
    if (audioContext?.state === "suspended") {
      await audioContext.resume();
    }

    activeMode = modeInput.value as "realtime" | "deterministic" | "fixed-delta";
    await recorder.start({
      mode: activeMode,
      outputFormat: outputFormatInput.value as OutputFormatOption,
      frameRate,
      bitrate: bitrateMbps * 1_000_000,
      durationSeconds: modeInput.value === "realtime" ? undefined : durationSeconds,
      fixedDeltaMs: modeInput.value === "fixed-delta" ? fixedDeltaMs : undefined,
      audioTrack:
        modeInput.value === "realtime"
          ? await ensureRecordingAudioTrack(useMicrophoneAudioInput.checked)
          : null,
    });
  } catch (error) {
    activeMode = null;
    syncModeUi();
    const message = error instanceof Error ? error.message : "Failed to start recording.";
    status.textContent = message;
  }
});

pauseButton.addEventListener("click", () => {
  try {
    if (pauseButton.disabled) {
      return;
    }

    if (modeInput.value === "deterministic" || modeInput.value === "fixed-delta") {
      return;
    }

    if (pauseButton.textContent === "Pause") {
      recorder.pause();
      return;
    }

    recorder.resume();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to toggle pause.";
    status.textContent = message;
  }
});

stopButton.addEventListener("click", async () => {
  try {
    if (stopButton.disabled) {
      return;
    }

    await recorder.stop();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to finalize recording.";
    status.textContent = message;
  }
});

showPreviewButton.addEventListener("click", () => {
  if (!recorder.getPreviewUrl()) {
    return;
  }

  previewDialog.showModal();
});

closePreviewButton.addEventListener("click", () => {
  previewDialog.close();
});

previewDownloadButton.addEventListener("click", () => {
  try {
    recorder.downloadLastVideo();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to download video.";
    status.textContent = message;
  }
});

previewDialog.addEventListener("click", (event) => {
  if (event.target === previewDialog) {
    previewDialog.close();
  }
});

downloadVideoButton.addEventListener("click", () => {
  try {
    recorder.downloadLastVideo();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to download video.";
    status.textContent = message;
  }
});

playSampleSoundButton.addEventListener("click", async () => {
  try {
    Engine.audioEngine?.unlock();
    const audioContext = Engine.audioEngine?.audioContext ?? null;
    if (audioContext?.state === "suspended") {
      await audioContext.resume();
    }

    const sound = ensureSampleSound();
    sound.stop();
    sound.play();
    updateAudioStatus();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to play sample sound.";
    audioStatus.textContent = `Scene audio: ${message}`;
  }
});
