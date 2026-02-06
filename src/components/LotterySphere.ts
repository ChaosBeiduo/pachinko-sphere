import * as THREE from 'three';

export class LotterySphere {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private group: THREE.Group;
  private animationId: number | null = null;
  private cleanupResize: () => void;

  constructor(
    private canvas: HTMLCanvasElement, 
    private names: string[],
    private radius: number = 500
  ) {
    this.scene = new THREE.Scene();
    this.group = new THREE.Group();
    this.scene.add(this.group);

    const { width, height } = canvas.parentElement?.getBoundingClientRect() || { width: window.innerWidth, height: window.innerHeight };

    this.camera = new THREE.PerspectiveCamera(75, width / height, 1, 2000);
    this.camera.position.z = 1000;

    this.renderer = new THREE.WebGLRenderer({ 
      canvas, 
      alpha: true, 
      antialias: true 
    });
    
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.cleanupResize = () => window.removeEventListener('resize', this.handleResize);

    this.init();
    this.handleResize(); // Initial sizing
    this.animate();
  }

  private init() {
    // Generate sprites on Fibonacci sphere
    const count = this.names.length;
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    
    for (let i = 0; i < count; i++) {
      const theta = 2 * Math.PI * i / goldenRatio;
      const phi = Math.acos(1 - 2 * (i + 0.5) / count);

      const x = Math.cos(theta) * Math.sin(phi);
      const y = Math.sin(theta) * Math.sin(phi);
      const z = Math.cos(phi);

      const sprite = this.createSprite(this.names[i]);
      sprite.position.set(x * this.radius, y * this.radius, z * this.radius);
      this.group.add(sprite);
    }
  }

  private createSprite(name: string): THREE.Sprite {
    const fontSize = 48;
    const fontFace = 'Arial, sans-serif';
    const padding = 10;
    
    // Estimate text width
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) throw new Error('Cannot get 2d context');
    tempCtx.font = `bold ${fontSize}px ${fontFace}`;
    const textMetrics = tempCtx.measureText(name);
    const textWidth = textMetrics.width;
    
    // Create canvas for texture
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2d context');
    
    canvas.width = textWidth + padding * 2;
    canvas.height = fontSize + padding * 2;
    
    // Draw text
    ctx.font = `bold ${fontSize}px ${fontFace}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText(name, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    // texture.minFilter = THREE.LinearFilter;
    
    const material = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true,
    });
    
    const sprite = new THREE.Sprite(material);
    // Scale sprite to match aspect ratio of text
    const scale = 0.5; // global scale factor
    sprite.scale.set(canvas.width * scale, canvas.height * scale, 1);
    
    return sprite;
  }

  private handleResize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const width = parent.clientWidth;
    const height = parent.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    // Limit DPR to max 2
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);
  }

  private animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    
    // Rotate the group
    this.group.rotation.y += 0.002;
    this.group.rotation.x += 0.001;
    
    // Make sprites look at camera? 
    // Sprites automatically look at camera in Three.js, so no need to manually update them.
    
    this.renderer.render(this.scene, this.camera);
  }

  public destroy() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    this.cleanupResize();
    this.renderer.dispose();
    
    // Dispose textures and materials
    this.group.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Sprite) {
        object.material.map?.dispose();
        object.material.dispose();
      }
    });
  }
}
