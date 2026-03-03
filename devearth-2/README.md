# 🌍 DevEarth

> Watch the world code in real time.

DevEarth is a live 3D globe that visualizes GitHub commits happening across the planet as they occur. Every push event lights up the developer's location with a glowing pulse — you can literally watch humanity build the internet.

## Features

- **Photorealistic Earth** — NASA textures, atmosphere glow, specular ocean shine, procedural cloud layer
- **Live Commit Pulses** — Real GitHub push events mapped to locations with impact animations
- **Language Colors** — Every language has a unique color; JavaScript is yellow, Python blue, Rust red...
- **Ripple Effects** — Each commit creates expanding shockwave rings on the globe surface
- **Particle Bursts** — Impact particles scatter on every push event
- **Commit Sound** — Each language plays a unique musical tone (click to enable audio)
- **Live Feed** — Real-time sidebar showing who pushed where
- **Stats Panel** — Commits/min, total today, countries active, developers seen
- **Cinematic Mode** — Press `C` to hide all UI for a pure visual experience
- **5000+ Stars** — Animated starfield with color-accurate star types

## Controls

| Input | Action |
|---|---|
| Drag | Rotate globe |
| Scroll | Zoom in/out |
| `C` key | Toggle cinematic mode |
| Click | Enable audio |

## Deploy

```bash
git clone https://github.com/RaihanLab/DevEarth.git
cd DevEarth
# Open index.html directly or serve locally:
npx serve .
```

Enable GitHub Pages in repo settings for a live URL.

## Tech Stack

- [Three.js r128](https://threejs.org) — 3D rendering + GLSL shaders
- [GitHub Events API](https://docs.github.com/en/rest/activity/events) — Live commit stream
- Web Audio API — Generative commit sounds
- Vanilla JS — Zero framework dependencies
- NASA Blue Marble textures via Three.js CDN

## License

MIT
