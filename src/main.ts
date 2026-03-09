import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import "./style.css";
import { BabylonSceneRecorder, type RecorderDiagnostics } from "./recorder";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

app.innerHTML = `
  <div class="shell">
    <section class="panel">
      <p class="eyebrow">Babylon Scene to MP4</p>
      <h1>Baby Recorder</h1>
      <p class="lede">
        Records the live Babylon canvas with MediaBunny and exports a default MP4 file.
      </p>
      <div class="controls">
        <label class="field">
          <span>Mode</span>
          <select id="mode">
            <option value="realtime">Realtime Capture</option>
          </select>
          <small class="hint">Available now. Deterministic export will be added separately.</small>
        </label>
        <label class="field">
          <span>FPS</span>
          <input id="fps" type="number" min="1" max="60" value="30" />
        </label>
        <label class="field">
          <span>Bitrate Mbps</span>
          <input id="bitrate" type="number" min="1" max="50" step="0.5" value="8" />
        </label>
      </div>
      <div class="actions">
        <button id="start-recording" type="button">Start Recording</button>
        <button id="pause-recording" type="button" disabled>Pause</button>
        <button id="stop-recording" type="button" disabled>Stop Recording</button>
        <button id="show-preview" type="button" disabled>Show Video</button>
        <button id="download-video" type="button" disabled>Download Video</button>
      </div>
      <div class="meta">
        <p id="status" class="status">Idle</p>
        <div class="diagnostics">
          <p><span>Codec</span><strong id="diag-codec">-</strong></p>
          <p><span>Frames</span><strong id="diag-frames">0</strong></p>
          <p><span>Recorded</span><strong id="diag-duration">0.0s</strong></p>
          <p><span>File Size</span><strong id="diag-size">-</strong></p>
        </div>
      </div>
      <p class="modes">Mode: <strong>Realtime Capture</strong>.</p>
    </section>
    <section class="viewport">
      <canvas id="render-canvas"></canvas>
    </section>
  </div>
  <dialog id="preview-dialog" class="preview-dialog">
    <div class="preview-card">
      <div class="preview-head">
        <h2>Recorded Video</h2>
        <button id="close-preview" type="button">Close</button>
      </div>
      <video id="preview-video" controls playsinline></video>
    </div>
  </dialog>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#render-canvas");
const status = document.querySelector<HTMLParagraphElement>("#status");
const modeInput = document.querySelector<HTMLSelectElement>("#mode");
const fpsInput = document.querySelector<HTMLInputElement>("#fps");
const bitrateInput = document.querySelector<HTMLInputElement>("#bitrate");
const startButton = document.querySelector<HTMLButtonElement>("#start-recording");
const pauseButton = document.querySelector<HTMLButtonElement>("#pause-recording");
const stopButton = document.querySelector<HTMLButtonElement>("#stop-recording");
const showPreviewButton = document.querySelector<HTMLButtonElement>("#show-preview");
const downloadVideoButton = document.querySelector<HTMLButtonElement>("#download-video");
const previewDialog = document.querySelector<HTMLDialogElement>("#preview-dialog");
const previewVideo = document.querySelector<HTMLVideoElement>("#preview-video");
const closePreviewButton = document.querySelector<HTMLButtonElement>("#close-preview");
const diagCodec = document.querySelector<HTMLElement>("#diag-codec");
const diagFrames = document.querySelector<HTMLElement>("#diag-frames");
const diagDuration = document.querySelector<HTMLElement>("#diag-duration");
const diagSize = document.querySelector<HTMLElement>("#diag-size");

if (
  !canvas ||
  !status ||
  !modeInput ||
  !fpsInput ||
  !bitrateInput ||
  !startButton ||
  !pauseButton ||
  !stopButton ||
  !showPreviewButton ||
  !downloadVideoButton ||
  !previewDialog ||
  !previewVideo ||
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
    diagnostics.fileSizeBytes === null
      ? "-"
      : `${(diagnostics.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`;
};

renderDiagnostics({
  codec: null,
  framesCaptured: 0,
  recordedSeconds: 0,
  fileSizeBytes: null
});

const engine = new Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true
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

const resize = () => engine.resize();
window.addEventListener("resize", resize);

const recorder = new BabylonSceneRecorder(canvas, {
  onStatus: (message) => {
    status.textContent = message;
  },
  onRecordingChange: (isRecording) => {
    startButton.disabled = isRecording;
    stopButton.disabled = !isRecording;
    pauseButton.disabled = !isRecording;
    if (!isRecording) {
      pauseButton.textContent = "Pause";
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
  }
});

let elapsedSeconds = 0;

engine.runRenderLoop(() => {
  const deltaSeconds = engine.getDeltaTime() / 1000;
  elapsedSeconds += deltaSeconds;

  sphere.position.y = 1.4 + Math.sin(elapsedSeconds * 1.8) * 0.55;
  sphere.rotation.y += deltaSeconds * 1.2;

  box.rotation.x += deltaSeconds * 0.7;
  box.rotation.y -= deltaSeconds * 1.1;
  box.position.z = 1.2 + Math.sin(elapsedSeconds * 1.1) * 0.5;

  torus.rotation.z += deltaSeconds * 1.5;
  torus.position.x = 2.1 + Math.cos(elapsedSeconds * 1.4) * 0.4;

  scene.render();
});

startButton.addEventListener("click", async () => {
  const frameRate = Number(fpsInput.value);
  const bitrateMbps = Number(bitrateInput.value);

  if (!Number.isFinite(frameRate) || frameRate <= 0) {
    status.textContent = "FPS must be greater than 0.";
    return;
  }

  if (!Number.isFinite(bitrateMbps) || bitrateMbps <= 0) {
    status.textContent = "Bitrate must be greater than 0.";
    return;
  }

  try {
    await recorder.start({
      mode: modeInput.value as "realtime",
      frameRate,
      bitrate: bitrateMbps * 1_000_000,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start recording.";
    status.textContent = message;
  }
});

pauseButton.addEventListener("click", () => {
  try {
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
