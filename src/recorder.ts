import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  canEncodeVideo,
  getFirstEncodableVideoCodec
} from "mediabunny";

type RecorderEvents = {
  onStatus: (message: string) => void;
  onRecordingChange: (isRecording: boolean) => void;
  onPauseChange: (isPaused: boolean) => void;
  onPreviewReady: (previewUrl: string | null) => void;
  onDownloadReady: (downloadReady: boolean) => void;
  onDiagnosticsChange: (diagnostics: RecorderDiagnostics) => void;
};

export type RecorderDiagnostics = {
  codec: string | null;
  framesCaptured: number;
  recordedSeconds: number;
  fileSizeBytes: number | null;
};

type StartRecordingOptions = {
  mode: "realtime";
  frameRate: number;
  bitrate: number;
};

type ActiveRecording = {
  output: Output<Mp4OutputFormat, BufferTarget>;
  source: CanvasSource;
  loopPromise: Promise<void> | null;
  startedAt: number;
  frameDuration: number;
  frameIndex: number;
  paused: boolean;
  finalizePromise: Promise<void> | null;
  codec: string;
  sleepResolver: (() => void) | null;
};

export class BabylonSceneRecorder {
  private readonly canvas: HTMLCanvasElement;
  private readonly events: RecorderEvents;
  private activeRecording: ActiveRecording | null = null;
  private previewUrl: string | null = null;
  private downloadBlob: Blob | null = null;

  constructor(canvas: HTMLCanvasElement, events: RecorderEvents) {
    this.canvas = canvas;
    this.events = events;
  }

  async start(options: StartRecordingOptions): Promise<void> {
    if (this.activeRecording) {
      throw new Error("Recording is already active.");
    }

    const codec = await this.getPreferredCodec(options);
    const target = new BufferTarget();
    const output = new Output({
      format: new Mp4OutputFormat(),
      target
    });

    const source = new CanvasSource(this.canvas, {
      codec,
      bitrate: options.bitrate
    });

    output.addVideoTrack(source, {
      frameRate: options.frameRate
    });

    await output.start();

    this.clearPreview();
    this.clearDownload();

    const frameDuration = 1 / options.frameRate;

    this.activeRecording = {
      output,
      source,
      loopPromise: null,
      startedAt: performance.now(),
      frameDuration,
      frameIndex: 0,
      paused: false,
      finalizePromise: null,
      codec,
      sleepResolver: null
    };

    this.emitDiagnostics({
      codec,
      framesCaptured: 0,
      recordedSeconds: 0,
      fileSizeBytes: null
    });
    this.startLoop();

    this.events.onRecordingChange(true);
    this.events.onPauseChange(false);
    this.events.onStatus(
      `Recording ${options.mode} MP4 with ${codec.toUpperCase()} at ${options.frameRate} FPS.`
    );
  }

  pause(): void {
    const active = this.activeRecording;
    if (!active) {
      throw new Error("No recording is active.");
    }

    if (active.paused) {
      return;
    }

    this.stopLoop(active);
    active.paused = true;
    this.events.onPauseChange(true);
    this.events.onStatus("Recording paused.");
  }

  resume(): void {
    const active = this.activeRecording;
    if (!active) {
      throw new Error("No recording is active.");
    }

    if (!active.paused) {
      return;
    }

    active.paused = false;
    this.startLoop();
    this.events.onPauseChange(false);
    this.events.onStatus("Recording resumed.");
  }

  async stop(): Promise<void> {
    const active = this.activeRecording;
    if (!active) {
      throw new Error("No recording is active.");
    }

    await this.finalize(active);
  }

  getPreviewUrl(): string | null {
    return this.previewUrl;
  }

  downloadLastVideo(): void {
    if (!this.downloadBlob) {
      throw new Error("No finalized video is available to download.");
    }

    const url = URL.createObjectURL(this.downloadBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = this.getFileName();
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private startLoop(): void {
    const active = this.activeRecording;
    if (!active) {
      return;
    }

    if (active.loopPromise) {
      return;
    }

    const targetIntervalMs = Math.max(1, Math.round(active.frameDuration * 1000));

    active.loopPromise = (async () => {
      while (this.activeRecording === active && !active.paused && !active.finalizePromise) {
        const startedAt = performance.now();
        await this.captureTick();

        if (this.activeRecording !== active || active.paused || active.finalizePromise) {
          break;
        }

        const remainingMs = Math.max(0, targetIntervalMs - (performance.now() - startedAt));
        await this.sleep(active, remainingMs);
      }
    })();

    active.loopPromise.finally(() => {
      if (this.activeRecording === active) {
        active.loopPromise = null;
      }
    });
  }

  private stopLoop(active: ActiveRecording): void {
    if (active.sleepResolver) {
      const resolve = active.sleepResolver;
      active.sleepResolver = null;
      resolve();
    }
  }

  private async captureTick(): Promise<void> {
    const active = this.activeRecording;
    if (!active || active.paused || active.finalizePromise) {
      return;
    }

    const timestamp = active.frameIndex * active.frameDuration;
    await active.source.add(timestamp, active.frameDuration);
    active.frameIndex += 1;

    this.events.onStatus(`Recording... ${active.frameIndex} frames captured.`);
    this.emitDiagnostics({
      codec: active.codec,
      framesCaptured: active.frameIndex,
      recordedSeconds: active.frameIndex * active.frameDuration,
      fileSizeBytes: null
    });
  }

  private async finalize(active: ActiveRecording): Promise<void> {
    if (active.finalizePromise) {
      await active.finalizePromise;
      return;
    }

    active.finalizePromise = (async () => {
      this.stopLoop(active);
      active.source.close();
      await active.output.finalize();

      const buffer = active.output.target.buffer;
      if (!buffer) {
        throw new Error("Recording finished without output data.");
      }

      const elapsedSeconds = ((performance.now() - active.startedAt) / 1000).toFixed(1);
      const blob = new Blob([buffer], { type: active.output.format.mimeType });
      const url = URL.createObjectURL(blob);
      this.setPreviewUrl(url);
      this.setDownloadBlob(blob);
      this.emitDiagnostics({
        codec: active.codec,
        framesCaptured: active.frameIndex,
        recordedSeconds: active.frameIndex * active.frameDuration,
        fileSizeBytes: blob.size
      });

      this.activeRecording = null;
      this.events.onRecordingChange(false);
      this.events.onPauseChange(false);
      this.events.onStatus(`Saved MP4 after ${elapsedSeconds}s.`);
    })();

    await active.finalizePromise;
  }

  private setPreviewUrl(url: string): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }

    this.previewUrl = url;
    this.events.onPreviewReady(url);
  }

  private clearPreview(): void {
    if (!this.previewUrl) {
      this.events.onPreviewReady(null);
      return;
    }

    URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = null;
    this.events.onPreviewReady(null);
  }

  private setDownloadBlob(blob: Blob): void {
    this.downloadBlob = blob;
    this.events.onDownloadReady(true);
  }

  private clearDownload(): void {
    this.downloadBlob = null;
    this.events.onDownloadReady(false);
  }

  private emitDiagnostics(diagnostics: RecorderDiagnostics): void {
    this.events.onDiagnosticsChange(diagnostics);
  }

  private sleep(active: ActiveRecording, ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timeoutId = window.setTimeout(() => {
        active.sleepResolver = null;
        resolve();
      }, ms);

      active.sleepResolver = () => {
        window.clearTimeout(timeoutId);
        resolve();
      };
    });
  }

  private async getPreferredCodec(
    options: StartRecordingOptions
  ): Promise<"avc" | "vp9" | "av1" | "hevc" | "vp8"> {
    const width = this.canvas.width || this.canvas.clientWidth;
    const height = this.canvas.height || this.canvas.clientHeight;

    if (await canEncodeVideo("avc", { width, height, bitrate: options.bitrate })) {
      return "avc";
    }

    const codec = await getFirstEncodableVideoCodec(
      new Mp4OutputFormat().getSupportedVideoCodecs(),
      { width, height, bitrate: options.bitrate }
    );

    if (!codec) {
      throw new Error("No MP4-compatible video encoder is available in this browser.");
    }

    return codec;
  }

  private getFileName(): string {
    const now = new Date();
    const parts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0")
    ];

    return `babylon-scene-${parts.join("-")}.mp4`;
  }
}
