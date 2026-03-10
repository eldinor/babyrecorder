# TODO

- Add a resolution selector for export, separate from canvas display size.
- Add a simple scene preset switcher so users can test recording with different motion and lighting quickly.
- Add an audio meter for scene and mic input, so mic level is not guesswork.
- Allow separate toggles for `Scene audio` and `Microphone audio` instead of assuming scene audio is always on.
- Save UI settings in `localStorage` so format, mode, bitrate, and mic level persist.
- Show estimated file size before recording, based on bitrate and duration.
- Add a `Reset to defaults` button.
- Improve offline export UX with progress percentage and remaining-frame count.
- Add keyboard shortcuts for `Record`, `Pause`, `Stop`, and `Preview`.
- Add optional filename input instead of always generating timestamp-only names.
- Add clipping protection or a limiter on the mic mix, since boosted mic levels can distort.
- Split the large bundle with dynamic imports, especially around recording/export code.
