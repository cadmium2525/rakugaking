let RAPIER;

export const DT = 1 / 60;
export const HALF_HEIGHT = 0.8;
let initialization;
export async function initPhysics() {
  initialization ??= import('@dimforge/rapier3d-compat').then(async (module) => {
    RAPIER = module.default;
    await RAPIER.init();
  });
  await initialization;
}

export class Simulation {
  constructor(platforms, spawn = { x: 0, y: 2, z: 0 }, stats = {}) {
    this.world = new RAPIER.World({ x: 0, y: -22, z: 0 });
    this.world.timestep = DT;
    this.actorShape = new RAPIER.Ball(0.65);
    this.courierShape = new RAPIER.Ball(0.35);
    this.platforms = platforms.map((p) => {
      const desc = (
        p.terrain
          ? RAPIER.ColliderDesc.trimesh(p.vertices, p.indices)
          : p.hull
            ? RAPIER.ColliderDesc.convexHull(p.hull)
            : RAPIER.ColliderDesc.cuboid(p.w / 2, p.h / 2, p.d / 2)
      ).setTranslation(p.x, p.y, p.z);
      if (p.angle)
        desc.setRotation({ x: 0, y: 0, z: Math.sin(p.angle / 2), w: Math.cos(p.angle / 2) });
      return this.world.createCollider(desc);
    });
    this.terrainHandles = new Set(
      this.platforms.filter((_, i) => platforms[i].terrain).map((c) => c.handle),
    );
    this.body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z),
    );
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.45, 0.35), this.body);
    this.controller = this.world.createCharacterController(0.02);
    this.controller.enableAutostep(0.25, 0.3, false);
    // Gravity maintains contact without a second downward correction.
    // Rapier is pinned to 0.19.3: 0.21.0 failed the floor/diagonal regressions.
    this.controller.setMaxSlopeClimbAngle(Math.PI / 4);
    this.controller.setMinSlopeSlideAngle(Math.PI / 3);
    this.spawn = { ...spawn };
    this.stats = { speed: 6, jump: 8.5, weight: 1, ...stats };
    this.vx = 0;
    this.vz = 0;
    this.vy = 0;
    this.grounded = false;
    this.jumpHeld = false;
    this.jumps = 0;
    this.deaths = 0;
    this.motion = { x: 0, y: 0, z: 0 };
    this.next = { x: 0, y: 0, z: 0 };
    this.world.step();
  }
  get position() {
    return this.body.translation();
  }
  reset() {
    this.body.setTranslation(this.spawn, true);
    this.body.setNextKinematicTranslation(this.spawn);
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.grounded = false;
    this.jumpHeld = false;
    this.world.step();
  }
  step(input = {}, environment = {}) {
    let x = Number.isFinite(input.x) ? input.x : 0,
      z = Number.isFinite(input.z) ? input.z : 0;
    const length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
    }
    const jumping = !!input.jump && !this.jumpHeld;
    this.jumpHeld = !!input.jump;
    if (jumping && this.grounded) {
      this.vy = this.stats.jump;
      this.grounded = false;
      this.jumps++;
    }
    const acceleration =
      1 - Math.exp((-DT * (this.grounded ? 14 : 6)) / Math.sqrt(this.stats.weight));
    const water = environment.water
      ? Math.max(
          0.4,
          0.95 - this.stats.weight * 0.2 - (this.stats.analysis?.bodyArea || 0.25) * 0.15,
        )
      : 1;
    this.vx += (x * this.stats.speed * water - this.vx) * acceleration;
    this.vz += (z * this.stats.speed * water - this.vz) * acceleration;
    this.vy = Math.max(-30, this.vy - (environment.water ? 12 : 22) * DT);
    this.motion.x =
      (this.vx + (environment.wind || 0) / this.stats.weight + (environment.burstX || 0)) * DT;
    // Pushing into headwind retains 12% of forward velocity so every build can
    // cross the mandatory bridge; releasing the stick still lets wind push.
    const windZ = (environment.windZ || 0) / this.stats.weight;
    this.motion.y = this.vy * DT;
    this.motion.z =
      (this.vz +
        (z < 0 ? Math.min(windZ, Math.max(0, -this.vz) * 0.88) : windZ) +
        (environment.burstZ || 0)) *
      DT;
    this.controller.computeColliderMovement(this.collider, this.motion);
    const move = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();
    if (this.grounded && this.vy < 0) this.vy = 0;
    if (this.motion.y > 0 && move.y < this.motion.y - 0.001) this.vy = 0;
    const p = this.position;
    this.next.x = p.x + move.x;
    this.next.y = p.y + move.y;
    this.next.z = p.z + move.z;
    this.body.setNextKinematicTranslation(this.next);
    this.world.step();
    if (this.position.y < -12) {
      this.deaths++;
      this.reset();
      return 'death';
    }
    return this.grounded ? 'ground' : 'air';
  }
  dispose() {
    this.world.free();
  }
  lineClear(a, b) {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      dz = b.z - a.z,
      distance = Math.hypot(dx, dy, dz);
    if (distance < 0.05) return true;
    const ray = new RAPIER.Ray(a, { x: dx / distance, y: dy / distance, z: dz / distance });
    return !this.world.castRay(
      ray,
      Math.max(0, distance - 0.08),
      true,
      undefined,
      undefined,
      this.collider,
      this.body,
    );
  }
  moveActor(p, motion) {
    const cast = (from, x, z) =>
      this.world.castShape(
        from,
        { x: 0, y: 0, z: 0, w: 1 },
        { x, y: 0, z },
        motion.courier ? this.courierShape : this.actorShape,
        motion.courier ? 0.01 : 0.025,
        1,
        true,
        undefined,
        undefined,
        this.collider,
        this.body,
        (collider) => !this.terrainHandles.has(collider.handle),
      );
    const hit = cast(p, motion.x, motion.z);
    const t = hit ? Math.max(0, hit.time_of_impact - 0.01) : 1;
    const next = { x: p.x + motion.x * t, z: p.z + motion.z * t };
    if (motion.courier) {
      next.avoidSide = undefined;
      if (hit && t < 0.98) {
        const length = Math.hypot(hit.normal1.x, hit.normal1.z);
        if (length > 0.05) {
          const nx = hit.normal1.x / length,
            nz = hit.normal1.z / length,
            rx = motion.x * (1 - t),
            rz = motion.z * (1 - t),
            into = rx * nx + rz * nz;
          let sx = rx - into * nx,
            sz = rz - into * nz;
          // Keep one avoidance side around narrow posts. Each lateral step
          // still uses a new physical cast instead of bypassing the obstacle.
          const side = motion.avoidSide ?? (rx * nz - rz * nx >= 0 ? 1 : -1);
          if (Math.hypot(sx, sz) < Math.hypot(rx, rz) * 0.35) {
            const remaining = Math.hypot(rx, rz);
            sx = nz * side * remaining;
            sz = -nx * side * remaining;
          }
          const slide = cast({ ...next, y: p.y }, sx, sz),
            fraction = slide ? Math.max(0, slide.time_of_impact - 0.01) : 1;
          next.x += sx * fraction;
          next.z += sz * fraction;
          next.avoidSide = side;
        }
      }
    }
    return next;
  }
}
