# BabyRecorder User Guide

BabyRecorder records Babylon.js scenes to video with MediaBunny.

## Quick Start

1. Choose an output `Format`.
2. Choose a `Mode`.
3. Adjust FPS, bitrate, and duration if needed.
4. In `Realtime Capture`, optionally enable `Use microphone audio`.
5. Press `Record`.
6. Press `Stop` when finished, or let offline export finish automatically.
7. Use `Preview` to check the result.
8. Use `Download` to save the video file.

## Modes

### Realtime Capture

Records the Babylon canvas live as it is rendered in the browser.

- Supports Babylon scene audio
- Supports optional microphone audio
- Supports `Pause`, `Resume`, and `Stop`
- Best for interactive or live viewport capture

### Fast Export

Offline export that renders frames as fast as possible.

- Uses the selected FPS and duration
- Finishes automatically
- Does not currently include audio
- Best for fast fixed-length export

### Fixed Delta

Offline export that advances the scene by a constant simulation step.

- Uses `Fixed Delta Ms` plus duration
- Finishes automatically
- Does not currently include audio
- Best when animation timing should advance with a strict step

## Controls

### Format

Output container for the exported file.

- `MP4 (.mp4)`
- `WebM (.webm)`
- `MKV (.mkv)`
- `MOV (.mov)`

### Bitrate Mbps

Controls video quality and file size.

- Lower bitrate: smaller files, more compression
- Higher bitrate: larger files, cleaner image

Recommended starting point: `8 Mbps`

### FPS

Controls motion smoothness.

- `24 FPS`: cinematic
- `30 FPS`: common general-purpose output
- `60 FPS`: smoother motion

### Duration Seconds

Used in offline modes.

- Defines final output length
- Export stops automatically at that duration

### Fixed Delta Ms

Used only in `Fixed Delta`.

- `16.67 ms` is about `60 FPS`
- `33.33 ms` is about `30 FPS`

## Audio Controls

Audio controls are shown only in `Realtime Capture`.

### Use Microphone Audio

Adds microphone input to the recorded file.

- Browser permission is required
- Microphone is mixed together with Babylon scene audio

### Mic Level

Controls microphone gain in the recorded mix.

- `100%` is neutral level
- Higher values boost the mic louder
- Default is `180%`

### Play Sample Sound

Plays a short built-in Babylon scene sound.

- Use it to confirm that Babylon scene audio is active in the browser
- Use it to check that realtime recording is able to capture scene audio
- It does not test microphone input
- If you do not hear anything at first, click it after interacting with the page because browsers often keep audio locked until user input

## Buttons

### Record

Starts recording or export using the current settings.

### Pause / Resume

Available in `Realtime Capture`.

### Stop

Stops recording and finalizes the file.

### Preview

Opens the last result in the built-in preview dialog.

### Download

Saves the last result to disk.

## Diagnostics

The diagnostics panel shows:

- `Codec`
- `Frames`
- `Recorded`
- `File Size`

## Current Limitations

- Offline modes do not include audio
- Final output is buffered in browser memory before download
- Available codecs depend on browser and system support

## Recommended Defaults

- Realtime Capture: `60 FPS`, `8 Mbps`
- Fast Export: `60 FPS`, `8 Mbps`, `5s`
- Fixed Delta: `16.67 ms`, `8 Mbps`, `5s`
