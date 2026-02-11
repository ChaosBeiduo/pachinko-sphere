import * as THREE from 'three';
import { type SpinPlan } from '../lib/spinMath';

/**
 * Manages the rotation state to ensure continuity in angle and velocity.
 */
class RotationController {
  public theta = { x: 0, y: 0 };
  public omega = { x: 0, y: 0 };
  private targetOmega = { x: 0, y: 0 };
  private blendStartTime = 0;
  private blendDuration = 0;
  private startOmega = { x: 0, y: 0 };
  private mode: 'idle' | 'spinning' | 'extra' = 'idle';

  update(dt: number) {
    const now = performance.now();
    const elapsed = now - this.blendStartTime;
    const t = this.blendDuration > 0 ? Math.min(elapsed / this.blendDuration, 1) : 1;
    
    // Ease out cubic for omega blending
    const easedT = 1 - Math.pow(1 - t, 3);

    this.omega.x = this.startOmega.x + (this.targetOmega.x - this.startOmega.x) * easedT;
    this.omega.y = this.startOmega.y + (this.targetOmega.y - this.startOmega.y) * easedT;

    this.theta.x += this.omega.x * dt;
    this.theta.y += this.omega.y * dt;
  }

  getMode() {
    return this.mode;
  }

  setTargetOmega(newTarget: { x: number, y: number }, duration: number) {
    this.startOmega = { ...this.omega };
    this.targetOmega = { ...newTarget };
    this.blendDuration = duration;
    this.blendStartTime = performance.now();
  }

  setMode(mode: 'idle' | 'spinning' | 'extra', targetOmega: { x: number, y: number }, duration: number) {
    this.mode = mode;
    this.setTargetOmega(targetOmega, duration);
  }

  forceOmega(omega: { x: number, y: number }) {
    this.omega = { ...omega };
    this.startOmega = { ...omega };
    this.targetOmega = { ...omega };
    this.blendDuration = 0;
  }
}

type AnimationState = 'idle' | 'accelerating' | 'constant' | 'decelerating' | 'highlighting';

type StopConfig = {
  // 第一个中奖者“停下时”的额外圈数（平行旋转圈数）
  extraRevs?: number;
  // 停下对齐耗时
  durationMs?: number;
  // 切到下一个中奖者时的额外圈数/耗时（通常更小）
  nextExtraRevs?: number;
  nextDurationMs?: number;
  finalPauseMs?: number;
};


export class LotterySphere {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private group: THREE.Group;
  private animationId: number | null = null;
  private lastFrameTime: number = performance.now();
  private rotationController = new RotationController();
  private cleanupResize: () => void;
  
  // Lottery State
  private state: AnimationState = 'idle';
  private stateStartTime: number = 0;
  
  // Multi-winner handling
  private winnersQueue: string[] = [];
  private currentWinnerIndex: number = 0;
  private onWinnerHighlight: ((name: string) => void) | null = null;
  private onAllFinished: (() => void) | null = null;
  private holdAtWinner: boolean = false;

  private stopConfig: StopConfig = {};
  
  // Animation Parameters
  private baseSpeed = { x: 0.001, y: 0.002 };
  private currentSpeed = { x: 0.001, y: 0.002 };
  
  // Dynamic Animation Config
  private spinPlan: SpinPlan | null = null;
  private maxSpeedY: number = 0.1;

  // Deceleration & Alignment control
  private startQuaternion = new THREE.Quaternion();
  private endQuaternion = new THREE.Quaternion();
  private extraRotationAxis = new THREE.Vector3(0, 1, 0);
  private extraSpinTotal = 0;
  private decelerationDuration = 10000;

  // Texture Cache
  private textureCache: Map<string, THREE.Texture> = new Map();

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
    if (this.names.length === 0) {
      console.warn('LotterySphere: No names provided.');
      // Optional: Add a placeholder sprite saying "No Data"
      const sprite = this.createSprite('No Data');
      this.group.add(sprite);
      return;
    }

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
      // Store original index for easy lookup if needed, though we rely on names array index match
      sprite.userData = { index: i, name: this.names[i] };
      this.group.add(sprite);
    }
  }

  private createSprite(name: string): THREE.Sprite {
    let texture = this.textureCache.get(name);

    if (!texture) {
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
        
        texture = new THREE.CanvasTexture(canvas);
        // Cache the texture
        this.textureCache.set(name, texture);
    }
    
    const material = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true,
    });
    
    const sprite = new THREE.Sprite(material);
    // Scale sprite to match aspect ratio of text
    // We need to access image dimensions from texture
    const image = texture.image as HTMLCanvasElement;
    const scale = 0.5; // global scale factor
    sprite.scale.set(image.width * scale, image.height * scale, 1);
    
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

  public setBaseSpeed(speedRadS: number) {
    // Convert rad/s to rad/ms for RotationController
    const perMs = speedRadS / 1000;
    const targetOmega = { x: perMs * 0.5, y: perMs };
    
    if (this.state === 'idle') {
      this.rotationController.setMode('idle', targetOmega, 500);
    }
  }

  // New API: Start spinning
  public spin(plan?: SpinPlan) {
    if (this.names.length === 0) return;
    this.holdAtWinner = false;
    this.spinPlan = plan || null;
    this.state = 'accelerating';
    this.stateStartTime = performance.now();
    const currentEuler = new THREE.Euler().setFromQuaternion(this.group.quaternion, 'XYZ');
    this.rotationController.theta.x = currentEuler.x;
    this.rotationController.theta.y = currentEuler.y;
    this.rotationController.forceOmega({ x: 0, y: 0 });

    if (this.spinPlan) {
      const maxSpeedY = this.spinPlan.maxAngularVelocity; // rad/ms
      const maxSpeedX = maxSpeedY * 0.5;
      this.rotationController.setMode('spinning', { x: maxSpeedX, y: maxSpeedY }, this.spinPlan.accelerationDuration);
    }
  }

  // New API: Stop and highlight list of winners
  public stopAndHighlightWinners(
    winners: string[],
    onWinnerHighlight: (name: string) => void,
    onAllFinished: () => void,
    config: StopConfig = {}
  ) {
    if (this.names.length === 0) {
        onAllFinished();
        return;
    }

    this.winnersQueue = winners;
    this.currentWinnerIndex = 0;
    this.onWinnerHighlight = onWinnerHighlight;
    this.onAllFinished = onAllFinished;
    this.stopConfig = config;

    // Start deceleration process towards the first winner
    if (this.winnersQueue.length > 0) {
        this.prepareDeceleration(this.winnersQueue[0], this.stopConfig);
        this.state = 'decelerating';
        this.stateStartTime = performance.now();
    } else {
        this.state = 'idle';
        onAllFinished();
    }
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    
    const now = performance.now();
    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // 1. Update rotation state via controller
    this.rotationController.update(dt);

    // 2. Apply rotation to group
    if (this.state === 'accelerating' || this.state === 'constant' || (this.state === 'idle' && !this.holdAtWinner)) {
      this.group.rotation.set(this.rotationController.theta.x, this.rotationController.theta.y, 0);
    } else if (this.state === 'decelerating' || this.state === 'highlighting') {
      const duration = this.decelerationDuration;
      const progress = this.state === 'decelerating' 
        ? Math.min((now - this.stateStartTime) / duration, 1)
        : 1;
      
      // Use cubic ease out for smooth landing
      const t = this.easeOutCubic(progress);
      const currentBaseQuat = this.startQuaternion.clone().slerp(this.endQuaternion, t);

      const extraAngle = this.extraSpinTotal * t;
      const extraQuat = new THREE.Quaternion().setFromAxisAngle(this.extraRotationAxis, extraAngle);
      this.group.quaternion.copy(currentBaseQuat);
      this.group.quaternion.premultiply(extraQuat);
      
      if (this.state === 'decelerating' && progress >= 1) {
        // Notify UI about current winner
        const currentWinnerName = this.winnersQueue[this.currentWinnerIndex];
        if (this.onWinnerHighlight) {
            this.onWinnerHighlight(currentWinnerName);
        }

        // Move to next state: highlighting/pause
        this.state = 'highlighting';
        this.stateStartTime = now;
      }
    }

    if (this.state === 'highlighting') {
        const pauseDuration = this.stopConfig.finalPauseMs ?? 1000;
        if (now - this.stateStartTime > pauseDuration) {
            // Move to next winner or finish
            this.currentWinnerIndex++;
            if (this.currentWinnerIndex < this.winnersQueue.length) {
                // Transition to next winner
                // We don't need full spin, just move to next
                // But to make it look nice, maybe a quick slerp?
                // Let's reuse 'decelerating' but with shorter duration and no extra spin?
                // Or simply:
                this.prepareTransitionToNext(this.winnersQueue[this.currentWinnerIndex]);
            } else {
                // All done
                this.holdAtWinner = true;
                const finalEuler = new THREE.Euler().setFromQuaternion(this.group.quaternion, 'XYZ');
                this.rotationController.theta.x = finalEuler.x;
                this.rotationController.theta.y = finalEuler.y;
                this.rotationController.forceOmega({ x: 0, y: 0 });
                this.state = 'idle';
                if (this.onAllFinished) this.onAllFinished();
            }
        }
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  private prepareDeceleration(targetName: string, config: StopConfig = {}) {
    // Similar to previous prepareDeceleration, but targeting a specific name
    const winnerSprite = this.group.children.find(
      child => child.userData.name === targetName
    ) as THREE.Sprite;
    
    if (!winnerSprite) {
      console.warn('Target sprite not found:', targetName);
      // Keep current rotation as target to avoid jump
      this.startQuaternion.copy(this.group.quaternion);
      this.endQuaternion.copy(this.group.quaternion);
      this.extraSpinTotal = 0;
      return;
    }

    const localDir = winnerSprite.position.clone().normalize();
    const targetDir = new THREE.Vector3(0, 0, 1);
    
    this.endQuaternion.setFromUnitVectors(localDir, targetDir);
    this.startQuaternion.copy(this.group.quaternion);
    this.extraSpinTotal = Math.PI * 2 * Math.max(0, config.extraRevs ?? 6);
    this.decelerationDuration = config.durationMs ?? Math.max(1800, this.spinPlan?.decelerationDuration ?? 2000);
  }

  private prepareTransitionToNext(targetName: string) {
      // Shorter transition to next winner
      const winnerSprite = this.group.children.find(
        child => child.userData.name === targetName
      ) as THREE.Sprite;

      if (!winnerSprite) {
          // Skip if not found
          this.state = 'highlighting'; // skip wait
          this.stateStartTime = 0; // force next immediately
          return;
      }

      const localDir = winnerSprite.position.clone().normalize();
      const targetDir = new THREE.Vector3(0, 0, 1);
      
      this.endQuaternion.setFromUnitVectors(localDir, targetDir);
      this.startQuaternion.copy(this.group.quaternion);

      this.extraSpinTotal = Math.PI * 2 * Math.max(0, this.stopConfig.nextExtraRevs ?? 1);
      this.decelerationDuration = this.stopConfig.nextDurationMs ?? 1300;
      
      this.state = 'decelerating';
      this.stateStartTime = performance.now();
  }

  public removeWinner(name: string) {
    const spriteIndex = this.group.children.findIndex(
      child => child.userData.name === name
    );

    if (spriteIndex !== -1) {
      const sprite = this.group.children[spriteIndex] as THREE.Sprite;
      sprite.material.dispose();
      this.group.remove(sprite);
      this.names = this.names.filter(n => n !== name);
    }
  }

  public setNames(names: string[]) {
    // Clear existing sprites
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      if (child instanceof THREE.Sprite) {
        child.material.dispose();
      }
      this.group.remove(child);
    }
    
    // Update names list
    this.names = names;
    
    // Re-initialize sphere with new names
    this.init();
  }

  public destroy() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    this.cleanupResize();
    this.renderer.dispose();
    
    // Dispose materials
    this.group.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Sprite) {
        object.material.dispose();
      }
    });

    // Dispose all cached textures
    this.textureCache.forEach(texture => {
        texture.dispose();
    });
    this.textureCache.clear();
  }
}
