# Baby Recorder

Small Vite + TypeScript app for recording a live Babylon.js scene to MP4 with MediaBunny.

## Stack

- Vite
- TypeScript
- Babylon.js `8.54.1`
- MediaBunny

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Current Behavior

- Renders a Babylon scene in real time
- Records the live canvas into MP4
- Supports manual start, pause, resume, and stop
- Does not auto-download after stop
- Lets you preview the recorded video in a popover
- Lets you download the recorded video explicitly
- Shows basic diagnostics:
  - codec
  - captured frames
  - recorded duration
  - final file size

## Notes

- The current recorder mode is realtime capture only.
- Scene animation is driven by Babylon realtime delta time.
- Deterministic frame-by-frame export is not implemented in the current stable version.
