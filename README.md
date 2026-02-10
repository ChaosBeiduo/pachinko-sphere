# Pachinko Sphere

[Preview](https://pachinko-sphere.vercel.app/)

A 3D lottery drawing application built with Astro and Three.js. Features a beautiful "sphere of names" that spins and selects winners with smooth animations.

## Features

- **3D Visualization**: Names are distributed on a sphere using the Fibonacci Sphere algorithm.
- **Performance Optimized**: Uses CanvasTexture and Sprites instead of heavy 3D text geometry.
- **Fair Selection**: Uses `crypto.getRandomValues` for cryptographically strong random selection.
- **Responsive**: Adapts to window resizing and handles high DPR screens (max 2x).
- **Interactive UI**: 
  - **New**: Settings panel to import/edit names at runtime.
  - Smooth animation states (Accelerate -> Constant -> Decelerate).
  - "Winner" alignment to camera.
  - Modal announcement with visual effects.
  - Sidebar history of winners.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or pnpm

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
# or
pnpm install
```

3. Start the development server:

```bash
npm run dev
```

Visit `http://localhost:4321` in your browser.

## Customization

### Modifying the Name List

You can modify the list in two ways:

1. **Runtime**: Click the "⚙️ 设置名单" button in the top-left corner to paste or type a new list of names. The app automatically handles duplicates and cleaning.
2. **Code**: Edit `src/data/name.ts` to update the default list of participants. The file should export an array of strings:

```typescript
// src/data/name.ts
export default [
  "Alice",
  "Bob",
  "Charlie",
  // Add more names here...
];
```

### Changing Award Text

To change the text shown in the winner modal (e.g., "Congratulations"), edit `src/pages/index.astro`. Look for the `#result-modal` section:

```html
<div id="result-modal">
    <div class="winner-title">🎉 恭喜 🎉</div> <!-- Change this text -->
    <h2 class="winner-name" id="winner-name">---</h2>
    <button class="next-btn" id="next-btn">下一位</button>
</div>
```

### Adjusting Animation Speed

You can tweak the animation speeds in `src/components/LotterySphere.ts`:

```typescript
// src/components/LotterySphere.ts
private baseSpeed = { x: 0.001, y: 0.002 }; // Idle rotation speed
private maxSpeed = { x: 0.05, y: 0.1 };     // Spinning speed
```

## Performance Notes

- **Texture Caching**: The application automatically caches generated textures for identical names to save memory.
- **Resource Cleanup**: All Three.js resources (geometries, materials, textures) are properly disposed of when the component is destroyed.
- **Sprite Limit**: For optimal performance on average devices, it is recommended to keep the list under 2000 names.

## License

MIT
