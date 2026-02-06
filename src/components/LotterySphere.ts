import * as THREE from 'three';

type AnimationState = 'idle' | 'accelerating' | 'constant' | 'decelerating';

export class LotterySphere {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private group: THREE.Group;
  private animationId: number | null = null;
  private cleanupResize: () => void;
  
  // Lottery State
  private state: AnimationState = 'idle';
  private stateStartTime: number = 0;
  private onWinner: ((name: string) => void) | null = null;
  
  // Animation Parameters
  private baseSpeed = { x: 0.001, y: 0.002 };
  private maxSpeed = { x: 0.05, y: 0.1 };
  private currentSpeed = { x: 0.001, y: 0.002 };
  
  // Deceleration control
  private startQuaternion = new THREE.Quaternion();
  private endQuaternion = new THREE.Quaternion();
  private extraRotationAxis = new THREE.Vector3(0, 1, 0);
  private extraRotationRevs = 2; // Extra revolutions during deceleration

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

  public startLottery(onWinner: (name: string) => void) {
    if (this.state !== 'idle') return;
    if (this.names.length === 0) {
        console.warn("Cannot start lottery: No names left.");
        return;
    }
    
    this.onWinner = onWinner;
    this.state = 'accelerating';
    this.stateStartTime = performance.now();
  }

  private easeInQuad(t: number): number {
    return t * t;
  }

  private easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    
    const now = performance.now();
    // const dt = 16; // approximate delta time in ms for rotation integration
    
    if (this.state === 'idle') {
      this.group.rotation.y += this.baseSpeed.y;
      this.group.rotation.x += this.baseSpeed.x;
    } else if (this.state === 'accelerating') {
      const duration = 1000;
      const progress = Math.min((now - this.stateStartTime) / duration, 1);
      const eased = this.easeInQuad(progress);
      
      this.currentSpeed.x = this.baseSpeed.x + (this.maxSpeed.x - this.baseSpeed.x) * eased;
      this.currentSpeed.y = this.baseSpeed.y + (this.maxSpeed.y - this.baseSpeed.y) * eased;
      
      this.group.rotation.y += this.currentSpeed.y;
      this.group.rotation.x += this.currentSpeed.x;
      
      if (progress >= 1) {
        this.state = 'constant';
        this.stateStartTime = now;
      }
    } else if (this.state === 'constant') {
      const duration = 2000;
      const progress = Math.min((now - this.stateStartTime) / duration, 1);
      
      this.group.rotation.y += this.maxSpeed.y;
      this.group.rotation.x += this.maxSpeed.x;
      
      if (progress >= 1) {
        this.prepareDeceleration();
        this.state = 'decelerating';
        this.stateStartTime = now;
      }
    } else if (this.state === 'decelerating') {
      const duration = 1500;
      const progress = Math.min((now - this.stateStartTime) / duration, 1);
      
      // Use cubic ease out for smooth landing
      const t = this.easeOutCubic(progress);
      
      // 1. Slerp towards the target orientation
      // This handles the "align to camera" part
      const currentBaseQuat = this.startQuaternion.clone().slerp(this.endQuaternion, t);
      
      // 2. Add extra rotation that decays to zero
      // This handles the "continue spinning then stop" illusion
      // We want to spin around a consistent axis (e.g. Y)
      // Total extra rotation: K * 2PI.
      // We want the rotational velocity to match at t=0 and be 0 at t=1.
      // But simpler: just decay the rotation angle from Max to 0? 
      // No, we need total angle. Let's say we add `extraRotationRevs` full rotations.
      // Angle = TotalAngle * (1 - t)^3? No, that starts at max angle and goes to 0.
      // We want to ADD rotation. 
      // Let's model the extra rotation angle remaining: Theta(t) = Total * (1-t)^3
      // So Current Extra Rotation = Total - Theta(t) = Total * (1 - (1-t)^3)
      // Wait, simpler: We want to apply an additional rotation on top of the slerp.
      // At t=0, rotation is 0. At t=1, rotation is N * 360.
      // But if we just rotate N*360, the final state is Identity, so it doesn't affect alignment.
      // So we compute:
      const totalExtraAngle = this.extraRotationRevs * Math.PI * 2;
      // We want the speed to start high and end at 0.
      // EaseOutCubic function for angle: Angle(t) = Total * (1 - (1-t)^3)
      const currentExtraAngle = totalExtraAngle * (1 - Math.pow(1 - progress, 3));
      
      const extraQuat = new THREE.Quaternion().setFromAxisAngle(
        this.extraRotationAxis, 
        currentExtraAngle
      );
      
      // Combine: First apply base slerp, then apply extra rotation? 
      // Or Extra * Base?
      // Since we want the final state (t=1) to be exactly endQuaternion,
      // and at t=1 extraQuat is Identity (because angle is multiple of 2PI),
      // order matters for the path but not the destination.
      // Let's apply extra rotation in local space or world space?
      // Let's try multiplying in world space.
      this.group.quaternion.copy(extraQuat).multiply(currentBaseQuat);
      
      if (progress >= 1) {
        this.state = 'idle';
        // Ensure exact final position
        this.group.quaternion.copy(this.endQuaternion);
        
        // Find winner name
        // We know who it is from prepareDeceleration, but we should verify or just callback
        // The winner is stored in this.targetIndex or similar?
        // Let's callback
        if (this.onWinner) {
          // We need to pass the winner name. 
          // We selected it in prepareDeceleration.
          // Let's store it.
          this.onWinner(this.winnerName);
          this.onWinner = null;
        }
      }
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  private winnerName: string = '';

  private prepareDeceleration() {
    // 1. Pick a random winner
    const randomIndexArray = new Uint32Array(1);
    crypto.getRandomValues(randomIndexArray);
    const winnerIndex = randomIndexArray[0] % this.names.length;
    this.winnerName = this.names[winnerIndex];
    
    // 2. Find the sprite object
    // Since we added them in order, group.children[winnerIndex] should be it.
    // But let's verify with userData to be safe if we add other things later.
    const winnerSprite = this.group.children.find(
      child => child.userData.name === this.winnerName
    ) as THREE.Sprite;
    
    if (!winnerSprite) {
      console.error('Winner sprite not found');
      // Fallback to current rotation
      this.startQuaternion.copy(this.group.quaternion);
      this.endQuaternion.copy(this.group.quaternion);
      return;
    }

    // 3. Calculate Target Rotation
    // We want the sprite to be at (0, 0, R) in World Space.
    // Currently, Sprite is at P_local in Group Space.
    // We need Group Rotation Q_end such that:
    // Q_end * P_local = (0, 0, R)
    //
    // Let V_local = P_local.normalize()
    // Let V_target = (0, 0, 1)
    // We need rotation that takes V_local to V_target.
    const localDir = winnerSprite.position.clone().normalize();
    const targetDir = new THREE.Vector3(0, 0, 1);
    
    // This gives the rotation needed to turn localDir to targetDir
    this.endQuaternion.setFromUnitVectors(localDir, targetDir);
    
    // 4. Record Start Rotation
    this.startQuaternion.copy(this.group.quaternion);
    
    // 5. Determine Extra Rotation Axis
    // Ideally, we rotate around the axis that we were spinning around mostly?
    // Or just Y axis for simplicity.
    this.extraRotationAxis.set(0, 1, 0); 
    
    // Refine: To make it smoother, maybe use the axis of the Slerp?
    // No, Y axis is fine for a "spinning top" feel.
  }

  public removeWinner(name: string) {
    const spriteIndex = this.group.children.findIndex(
      child => child.userData.name === name
    );

    if (spriteIndex !== -1) {
      const sprite = this.group.children[spriteIndex] as THREE.Sprite;
      
      // Animate removal or just remove
      // For now, just remove immediately
      // Don't dispose texture here if we are caching it, 
      // UNLESS we are sure it won't be used again. 
      // Since this specific texture instance might be shared (if we had duplicate names), 
      // we should be careful. 
      // But in our current logic, we cache by name. 
      // If we remove the winner, that name is gone from the list.
      // So we can check if any other sprite uses this name? 
      // Assuming unique names for now or that we don't care about cleaning up the cache until destroy().
      
      // We only dispose the material here.
      sprite.material.dispose();
      this.group.remove(sprite);
      
      // Update names array so they can't be picked again
      this.names = this.names.filter(n => n !== name);
      
      // Re-layout sphere? 
      // If we remove one, a gap appears. 
      // Option A: Leave the gap (simpler, shows progress)
      // Option B: Re-distribute remaining (jumpy)
      // Let's stick with Option A for now as it feels more physical like taking a ball out.
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
