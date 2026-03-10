# BabyRecorder

BabyRecorder is a small Vite + TypeScript app for recording a Babylon.js scene to video with MediaBunny.

## Stack

- Vite
- TypeScript
- Babylon.js `8.54.1`
- MediaBunny `1.23.0`

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Features

- Records Babylon canvas output to `MP4`, `WebM`, `MKV`, or `MOV`
- Supports three capture modes:
  - `Realtime Capture`
  - `Fast Export`
  - `Fixed Delta`
- Realtime mode supports:
  - pause and resume
  - Babylon scene audio
  - optional microphone recording
  - adjustable microphone level
- Includes in-app preview and explicit download
- Shows diagnostics for codec, frames, duration, and file size

## Audio

- Babylon scene audio is available in `Realtime Capture`
- `Use microphone audio` adds microphone input to the recorded file
- `Mic level` controls recorded microphone gain
- `Play Sample Sound` is a quick check that scene audio capture is working
- Offline export modes currently do not record audio

## Notes

- Browser codec support varies by browser and OS
- Final output is held in browser memory before download
- Microphone access requires browser permission
