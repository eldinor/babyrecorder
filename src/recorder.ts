import {
  BufferTarget,
  CanvasSource,
  MediaStreamAudioTrackSource,
  MkvOutputFormat,
  MovOutputFormat,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec
} from "mediabunny";

const AUDIO_BITRATE = 192_000;

type RecorderEvents = {
  onStatus: (message: string) => void;
  onRecordingChange: (isRecording: boolean) => void;
  onPauseChange: (isPaused: boolean) => void;
  onPreviewReady: (previewUrl: string | null) => void;
  onDownloadReady: (downloadReady: boolean) => void;
  onDiagnosticsChange: (diagnostics: RecorderDiagnostics) => void;
  renderFrame: (frame: RenderFrameRequest) => void;
  setPreviewPlaybackEnabled: (enabled: boolean) => void;
};

export type RenderFrameRequest = {
  mode: "deterministic" | "fixed-delta";
  timestampSeconds: number;
  deltaSeconds: number;
  frameIndex: number;
};

export type RecorderDiagnostics = {
  codec: string | null;
  framesCaptured: number;
  recordedSeconds: number;
  fileSizeBytes: number | null;
};

type StartRecordingOptions = {
  mode: "realtime" | "deterministic" | "fixed-delta";
  outputFormat: OutputFormatOption;
  frameRate: number;
  bitrate: number;
  durationSeconds?: number;
  fixedDeltaMs?: number;
  audioTrack?: MediaStreamTrack | null;
};

export type OutputFormatOption = "mp4" | "webm" | "mkv" | "mov";

type SupportedOutputFormat = Mp4OutputFormat | WebMOutputFormat | MkvOutputFormat | MovOutputFormat;

type ActiveRecording = {
  mode: "realtime" | "deterministic" | "fixed-delta";
  output: Output<SupportedOutputFormat, BufferTarget>;
  source: CanvasSource;
  audioSource: MediaStreamAudioTrackSource | null;
  loopPromise: Promise<void> | null;
  startedAt: number;
  frameDuration: number;
  frameIndex: number;
  paused: boolean;
  finalizePromise: Promise<void> | null;
  codec: string;
  format: OutputFormatOption;
  sleepResolver: (() => void) | null;
  durationSeconds: number | null;
};

export class BabylonSceneRecorder {
  private readonly canvas: HTMLCanvasElement;
  private readonly events: RecorderEvents;
  private activeRecording: ActiveRecording | null = null;
  private previewUrl: string | null = null;
  private downloadBlob: Blob | null = null;
  private lastFileExtension = ".mp4";

  constructor(canvas: HTMLCanvasElement, events: RecorderEvents) {
    this.canvas = canvas;
    this.events = events;
  }

  async start(options: StartRecordingOptions): Promise<void> {
    if (this.activeRecording) {
      throw new Error("Recording is already active.");
    }

    if (options.mode === "deterministic") {
      if (!Number.isFinite(options.durationSeconds) || (options.durationSeconds ?? 0) <= 0) {
        throw new Error("Deterministic export requires a duration greater than 0 seconds.");
      }
    }

    if (options.mode === "fixed-delta") {
      if (!Number.isFinite(options.durationSeconds) || (options.durationSeconds ?? 0) <= 0) {
        throw new Error("Fixed Delta export requires a duration greater than 0 seconds.");
      }

      if (!Number.isFinite(options.fixedDeltaMs) || (options.fixedDeltaMs ?? 0) <= 0) {
        throw new Error("Fixed Delta export requires a fixed delta greater than 0 ms.");
      }
    }

    const format = this.createOutputFormat(options.outputFormat);
    const codec = await this.getPreferredCodec(format, options);
    const target = new BufferTarget();
    const output = new Output({
      format,
      target
    });

    const source = new CanvasSource(this.canvas, {
      codec,
      bitrate: options.bitrate
    });
    let audioSource: MediaStreamAudioTrackSource | null = null;

    const outputFrameRate =
      options.mode === "fixed-delta"
        ? 1000 / (options.fixedDeltaMs ?? 16.6667)
        : options.frameRate;

    output.addVideoTrack(source, {
      frameRate: outputFrameRate
    });

    if (options.mode === "realtime" && options.audioTrack) {
      const audioCodec = await this.getPreferredAudioCodec(options.audioTrack, format);
      audioSource = new MediaStreamAudioTrackSource(options.audioTrack as MediaStreamAudioTrack, {
        codec: audioCodec,
        bitrate: AUDIO_BITRATE
      });
      output.addAudioTrack(audioSource);
    }

    await output.start();

    this.clearPreview();
    this.clearDownload();

    const frameDuration =
      options.mode === "fixed-delta"
        ? (options.fixedDeltaMs ?? 16.6667) / 1000
        : 1 / options.frameRate;

    this.activeRecording = {
      mode: options.mode,
      output,
      source,
      audioSource,
      loopPromise: null,
      startedAt: performance.now(),
      frameDuration,
      frameIndex: 0,
      paused: false,
      finalizePromise: null,
      codec,
      format: options.outputFormat,
      sleepResolver: null,
      durationSeconds: options.mode === "realtime" ? null : options.durationSeconds ?? null
    };

    this.emitDiagnostics({
      codec,
      framesCaptured: 0,
      recordedSeconds: 0,
      fileSizeBytes: null
    });

    this.events.onRecordingChange(true);
    this.events.onPauseChange(false);

    if (options.mode === "deterministic" || options.mode === "fixed-delta") {
      this.events.setPreviewPlaybackEnabled(false);
      this.events.onPauseChange(true);
      this.events.onStatus(
        options.mode === "deterministic"
          ? `Exporting deterministic ${format.fileExtension.slice(1).toUpperCase()} with ${codec.toUpperCase()} at ${options.frameRate} FPS for ${options.durationSeconds}s.`
          : `Exporting fixed-delta ${format.fileExtension.slice(1).toUpperCase()} with ${codec.toUpperCase()} at ${options.fixedDeltaMs} ms step (${outputFrameRate.toFixed(2)} FPS) for ${options.durationSeconds}s.`
      );
      this.startOfflineLoop();
      return;
    }

    this.startLoop();
    this.events.onStatus(
      `Recording ${options.mode} ${format.fileExtension.slice(1).toUpperCase()} with ${codec.toUpperCase()} at ${options.frameRate} FPS.`
    );
  }

  pause(): void {
    const active = this.activeRecording;
    if (!active) {
      throw new Error("No recording is active.");
    }

    if (active.mode === "deterministic") {
      return;
    }

    if (active.paused) {
      return;
    }

    this.stopLoop(active);
    active.paused = true;
    active.audioSource?.pause();
    this.events.onPauseChange(true);
    this.events.onStatus("Recording paused.");
  }

  resume(): void {
    const active = this.activeRecording;
    if (!active) {
      throw new Error("No recording is active.");
    }

    if (active.mode === "deterministic") {
      return;
    }

    if (!active.paused) {
      return;
    }

    active.paused = false;
    active.audioSource?.resume();
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

  private startOfflineLoop(): void {
    const active = this.activeRecording;
    if (!active || (active.mode !== "deterministic" && active.mode !== "fixed-delta") || active.loopPromise) {
      return;
    }

    const durationSeconds = active.durationSeconds ?? 0;
    const totalFrames = Math.max(1, Math.ceil(durationSeconds / active.frameDuration));

    active.loopPromise = (async () => {
      for (let frame = 0; frame < totalFrames; frame += 1) {
        if (this.activeRecording !== active || active.finalizePromise) {
          break;
        }

        const exportMode = active.mode === "fixed-delta" ? "fixed-delta" : "deterministic";

        const timestamp = frame * active.frameDuration;
        this.events.renderFrame({
          mode: exportMode,
          timestampSeconds: timestamp,
          deltaSeconds: active.frameDuration,
          frameIndex: frame
        });
        await active.source.add(timestamp, active.frameDuration);
        active.frameIndex = frame + 1;

        this.events.onStatus(
          `${
            active.mode === "deterministic" ? "Exporting deterministic" : "Exporting fixed delta"
          }... ${Math.min(durationSeconds, active.frameIndex * active.frameDuration).toFixed(1)} / ${durationSeconds.toFixed(1)}s`
        );
        this.emitDiagnostics({
          codec: active.codec,
          framesCaptured: active.frameIndex,
          recordedSeconds: active.frameIndex * active.frameDuration,
          fileSizeBytes: null
        });

        if (frame % 10 === 0) {
          await Promise.resolve();
        }
      }

      await this.finalize(active);
    })();

    active.loopPromise.finally(() => {
      if (this.activeRecording === active) {
        active.loopPromise = null;
      }
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
      active.audioSource?.close();
      await active.output.finalize();

      const buffer = active.output.target.buffer;
      if (!buffer) {
        throw new Error("Recording finished without output data.");
      }

      const elapsedSeconds = ((performance.now() - active.startedAt) / 1000).toFixed(1);
      const blob = new Blob([buffer], { type: active.output.format.mimeType });
      const url = URL.createObjectURL(blob);
      this.setPreviewUrl(url);
      this.lastFileExtension = active.output.format.fileExtension;
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
      this.events.setPreviewPlaybackEnabled(true);
      this.events.onStatus(`Saved ${active.output.format.fileExtension.slice(1).toUpperCase()} after ${elapsedSeconds}s.`);
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

  private createOutputFormat(format: OutputFormatOption): SupportedOutputFormat {
    switch (format) {
      case "webm":
        return new WebMOutputFormat();
      case "mkv":
        return new MkvOutputFormat();
      case "mov":
        return new MovOutputFormat();
      case "mp4":
      default:
        return new Mp4OutputFormat();
    }
  }

  private async getPreferredCodec(
    format: SupportedOutputFormat,
    options: StartRecordingOptions
  ): Promise<"avc" | "vp9" | "av1" | "hevc" | "vp8"> {
    const width = this.canvas.width || this.canvas.clientWidth;
    const height = this.canvas.height || this.canvas.clientHeight;

    if (
      format instanceof Mp4OutputFormat &&
      await canEncodeVideo("avc", { width, height, bitrate: options.bitrate })
    ) {
      return "avc";
    }

    const codec = await getFirstEncodableVideoCodec(
      format.getSupportedVideoCodecs(),
      { width, height, bitrate: options.bitrate }
    );

    if (!codec) {
      throw new Error(`No ${format.fileExtension.slice(1).toUpperCase()}-compatible video encoder is available in this browser.`);
    }

    return codec;
  }

  private async getPreferredAudioCodec(
    track: MediaStreamTrack,
    format: SupportedOutputFormat
  ): Promise<"aac" | "opus" | "mp3" | "vorbis" | "flac" | "ac3" | "eac3"> {
    const settings = track.getSettings();
    const sampleRate = settings.sampleRate ?? 48_000;
    const numberOfChannels = settings.channelCount ?? 2;

    if (
      format instanceof Mp4OutputFormat &&
      await canEncodeAudio("aac", { sampleRate, numberOfChannels, bitrate: AUDIO_BITRATE })
    ) {
      return "aac";
    }

    const codec = await getFirstEncodableAudioCodec(
      format.getSupportedAudioCodecs(),
      { sampleRate, numberOfChannels, bitrate: AUDIO_BITRATE }
    );

    if (!codec || (codec !== "aac" && codec !== "opus" && codec !== "mp3" && codec !== "vorbis" && codec !== "flac" && codec !== "ac3" && codec !== "eac3")) {
      throw new Error(`No ${format.fileExtension.slice(1).toUpperCase()}-compatible audio encoder is available in this browser.`);
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

    return `babylon-scene-${parts.join("-")}${this.lastFileExtension}`;
  }
}
