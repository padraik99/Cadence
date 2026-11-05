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

**Managing timers**
- Name each interval, or leave it blank for automatic numbering.
- Duplicate an interval or the whole list.
- Swipe a timer left to delete it or right to duplicate it.
- Export or import timers to back them up or share them.

## Install on Android
1. Turn on GitHub Pages for this repo (Settings → Pages → deploy from `main`, root folder).
2. Open the Pages URL in Chrome, then choose **⋮ → Add to Home screen**.

Everything lives in `index.html`; there's no build step and no dependencies. Timers are saved on the device.
