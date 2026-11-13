# Cadence

A clean, offline workout timer that runs in the browser and installs to your phone's home screen.

**Timer types**
- **Intervals:** work intervals get a rest added after each one automatically. Rest after the last interval, warm-up, cool-down, sets and rest between sets are all optional.
- **Countdown** and **Count up**: repeat a set number of times or forever.

**During a workout**
- Large digits fill most of the screen; in the last minute only the seconds show, at double size.
- Tap anywhere to pause or resume. Hold ✕ to end, so a stray tap can't stop the workout.
- Voice guidance ("Begin. Burpees", "Relax for 20 seconds", "Rest in three… two… one"), with a choice of voice, pace and tone.
- Chimes, vibration and keep-screen-on. Sounds play over your own music.
- **+15 s** button during a timed rest, for when you're not ready yet.
- Optional **halfway chime** (Settings) on intervals of a minute or more.
- If the phone closes the app mid-workout, reopening it offers to **resume** at the same spot, paused (within 3 hours).
- **History** (clock icon): every finished workout, plus any stopped after a minute, with a 7-day total. Included in Export.

**Managing timers**
- Name each interval, or leave it blank for automatic numbering.
- Duplicate an interval or the whole list.
- Swipe a timer left to delete it or right to duplicate it.
- Hold a timer for a moment, then drag to reorder the list.
- Turn voice guidance off for a single timer in its editor (chimes and pips still play), or tap the speaker button during a workout to mute or unmute it for that run.
- Export or import timers to back them up or share them.

## Install on Android
1. Turn on GitHub Pages for this repo (Settings → Pages → deploy from `main`, root folder).
2. Open the Pages URL in Chrome, then choose **⋮ → Add to Home screen**.

The app lives in `index.html`; there's no build step. Timers are saved on the device. `sw.js` keeps a copy of the app so it opens with no signal.

## Natural voice
Settings → Voice quality → **Natural** swaps the phone's built-in voice for a neural one that runs on the device ([Piper](https://github.com/rhasspy/piper), via WebAssembly in `piper-worker.js`).

- Voices: American (female, male), British (female, male), Northern English (male), Scottish (female). That is what Piper offers for English accents; it has no Irish, Welsh or Australian voice.
- A voice is downloaded once (about 90 MB for the first, 63 MB for each extra one), stored on the device, and then works offline.
- Every line a timer will say is synthesized ahead of time and saved, so cues land on the beat. Saved timers are prepared in the background; a timer that isn't ready yet shows "Preparing voice" for a few seconds before it starts.
- If a line isn't ready in time, or the voice can't run on the device, the phone's voice says it instead.

Downloaded on demand, not included in this repo:
- Voice models from [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices). Each has its own licence (see its `MODEL_CARD`); the two American voices are CC BY-NC-SA, so non-commercial use only.
- [onnxruntime-web](https://www.npmjs.com/package/onnxruntime-web) (MIT) and [piper-wasm](https://www.npmjs.com/package/@diffusionstudio/piper-wasm), which contains espeak-ng (GPL-3.0), from jsDelivr.
