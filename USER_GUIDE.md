# BabyRecorder User Guide

BabyRecorder records Babylon.js scenes to video with MediaBunny. The app supports live recording and two offline export modes, with MP4 as the default output.

## Quick Start

1. Open the app.
2. Choose a mode.
3. Adjust the capture settings.
4. Press `Record`.
5. Press `Stop` when finished, or wait for an offline export to complete.
6. Use `Preview` to watch the result.
7. Use `Download` to save the video file.

## Modes

### Realtime Capture

This mode records the live Babylon canvas exactly as it is being rendered in the browser.

- Uses live scene timing.
- Supports scene audio in the recorded MP4.
- Lets you `Pause`, `Resume`, and `Stop` manually.
- Best when you want to capture interaction or the live viewport as-is.

### Fast Export

This is an offline mode. It renders frames as fast as possible instead of waiting for live browser timing.

- Uses the selected FPS and duration.
- Produces a fixed-length video export.
- Finishes automatically.
- Does not currently include audio.
- Best when you want a fast offline render with exact frame timestamps.

### Fixed Delta

This is also an offline mode, but it advances the scene using a fixed simulation step on every frame.

- Uses `Fixed Delta Ms` as the scene step.
- Shows the related FPS derived from that delta.
- Uses the selected duration.
- Finishes automatically.
- Does not currently include audio.
- Best when your animation logic should advance with a specific constant step.

## Controls

### Mode

Chooses how the video is generated.

- `Realtime Capture`: live recording
- `Fast Export`: offline export with chosen FPS
- `Fixed Delta`: offline export with chosen simulation step

### FPS

FPS means `frames per second`.

- Higher FPS creates smoother motion.
- Lower FPS creates less smooth motion but can reduce encoding load and file size.

Examples:

- `24 FPS`: more cinematic motion
- `30 FPS`: common general-purpose video
- `60 FPS`: smoother motion, good for live capture

Important:

- If a video looks choppy, FPS may be too low.
- FPS affects motion smoothness, not image sharpness.

### Fixed Delta Ms

Only used in `Fixed Delta` mode.

This is the fixed time step used to advance the scene on every exported frame.

Examples:

- `16.67 ms` is about `60 FPS`
- `33.33 ms` is about `30 FPS`

If you increase the delta:

- the related FPS becomes lower
- the scene advances in larger time steps

If you decrease the delta:

- the related FPS becomes higher
- the scene advances in smaller time steps

### Duration Seconds

Only used in offline modes.

This is the final video length.

- `5` means a 5-second exported clip
- offline export stops automatically at that duration

### Bitrate Mbps

Bitrate controls how much video data is used per second.

- Higher bitrate: larger file, better visual quality
- Lower bitrate: smaller file, more compression artifacts

Examples:

- `4 Mbps`: smaller file, lower quality
- `8 Mbps`: solid default
- `12-16 Mbps`: cleaner image, larger file

Important:

- If a video looks blurry or blocky, bitrate may be too low.
- Bitrate affects image quality, not motion smoothness.

## Buttons

### Record

Starts recording or export using the current settings.

### Pause / Resume

Only meaningful in `Realtime Capture`.

- `Pause` temporarily stops capture
- `Resume` continues capture into the same recording

Offline modes do not use pause/resume.

### Stop

Stops the current recording and finalizes the video.

- In `Realtime Capture`, you stop manually.
- In offline modes, export usually finishes on its own when duration is reached.

### Preview

Opens the last recorded video in the built-in preview dialog.

### Download

Saves the last recorded video file to disk.

## Scene Audio

The app includes a sample Babylon scene sound to verify that audio is working.

- `Play Sample Sound` only appears in `Realtime Capture`.
- Realtime MP4 recording can include Babylon scene audio.
- Offline modes currently export video without audio.

If you do not hear sound:

- click `Play Sample Sound`
- make sure the browser has not blocked audio until user interaction

## Diagnostics

The diagnostics panel shows:

- `Codec`: active video codec
- `Frames`: captured or exported frame count
- `Recorded`: current output duration
- `File Size`: final file size when available

## Choosing Good Settings

Recommended starting points:

- Realtime Capture: `60 FPS`, `8 Mbps`
- Fast Export: `30 FPS`, `8 Mbps`, `5s`
- Fixed Delta: `16.67 ms`, `8 Mbps`, `5s`

If the file is too large:

- reduce bitrate first
- reduce FPS only if you can accept less smooth motion

If the image quality is poor:

- increase bitrate

If motion feels too jerky:

- increase FPS

## Current Limitations

- Offline modes do not record audio yet.
- Long recordings still depend on browser memory because the final video is held before download.
- Browser codec support varies by system and browser.

## Summary

Use `Realtime Capture` for live recording with audio.
Use `Fast Export` for quick offline rendering.
Use `Fixed Delta` when you need a fixed simulation step.
Use `FPS` to control smoothness and `bitrate` to control image quality.
