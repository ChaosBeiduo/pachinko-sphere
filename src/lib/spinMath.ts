interface SpinPlanOptions {
  duration: number; // 秒
  turns: number;    // 圈数
  baseSpeed: number; // 基础速度 rad/s
}

export interface SpinPlan {
  maxAngularVelocity: number; // rad/ms (Three.js use ms in some cases, but here we use per frame or per ms)
  accelerationDuration: number; // ms
  constantDuration: number;    // ms
  decelerationDuration: number; // ms
}

/**
 * 计算旋转方案
 * 
 * 逻辑：
 * 1. 动画由 duration 驱动，turns 为目标。
 * 2. 动画分为三个阶段：加速 (20%)、匀速 (40%)、减速 (40%)。
 * 3. 总旋转弧度 = turns * 2 * PI。
 * 4. 设最大角速度为 V，则：
 *    - 加速位移 = 0.5 * V * t1
 *    - 匀速位移 = V * t2
 *    - 减速位移 = 0.5 * V * t3
 *    - 总位移 = V * (0.5 * t1 + t2 + 0.5 * t3)
 */
export function computeSpinPlan(options: SpinPlanOptions): SpinPlan {
  const { duration, turns } = options;
  const totalRadian = turns * Math.PI * 2;
  const totalMs = duration * 1000;

  // 阶段分配
  const accelRatio = 0.2;
  const constRatio = 0.4;
  const decelRatio = 0.4;

  const t1 = totalMs * accelRatio;
  const t2 = totalMs * constRatio;
  const t3 = totalMs * decelRatio;

  // 计算最大角速度 V (rad/ms)
  // totalRadian = V * (0.5 * t1 + t2 + 0.5 * t3)
  const V = totalRadian / (0.5 * t1 + t2 + 0.5 * t3);

  return {
    maxAngularVelocity: V,
    accelerationDuration: t1,
    constantDuration: t2,
    decelerationDuration: t3,
  };
}
