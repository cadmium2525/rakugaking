import * as THREE from 'three';

// Keep the drawing visible during close combat without bypassing world depth.
// Alpha hashing stays in the opaque pass, so walls and attack telegraphs retain
// their ordinary depth behavior and no duplicate character geometry is needed.
export class ActorVisibility {
  constructor() {
    this.actors = [];
    this.samples = [];
    this.avatar = null;
    this.ray = new THREE.Raycaster();
    this.point = new THREE.Vector3();
    this.origin = new THREE.Vector3();
    this.avatarPosition = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.hits = [];
    this.nearby = [];
  }
  setCharacter(avatar) {
    this.avatar = avatar;
    this.samples = [];
    if (!avatar) return;
    avatar.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox,
        size = box.getSize(new THREE.Vector3());
      if (box.isEmpty()) return;
      this.samples.push({
        mesh,
        local: box.getCenter(new THREE.Vector3()),
        area: Math.max(size.x * size.y, size.y * size.z, size.x * size.z),
      });
    });
    // These points follow the actual animated pieces, including arbitrary
    // sketches. Checking every stroke every frame would be wasteful on mobile.
    this.samples.sort((a, b) => b.area - a.area);
    this.samples.length = Math.min(3, this.samples.length);
  }
  setActors(roots, world) {
    this.clearActors();
    const owners = new Map(),
      meshOwners = new Map(),
      candidates = roots.filter(Boolean).map((root) => {
        const meshes = [];
        root.traverse((mesh) => {
          if (!mesh.isMesh) return;
          meshes.push(mesh);
          meshOwners.set(mesh, root);
        });
        return { root, meshes };
      });
    // The current enemies own their materials, but do not silently fade a wall
    // or another actor if a future model shares one of those materials.
    const collect = (mesh) => {
      if (!mesh.isMesh) return;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!material) continue;
        if (!owners.has(material)) owners.set(material, new Set());
        owners.get(material).add(meshOwners.get(mesh) || null);
      }
    };
    if (world) world.traverse(collect);
    else candidates.forEach(({ root }) => root.traverse(collect));
    this.actors = candidates.map(({ root, meshes }) => {
      const materials = new Map(),
        bindings = [];
      for (const mesh of meshes) {
        const original = mesh.material,
          list = Array.isArray(original) ? original : [original],
          replacement = list.map((material) => {
            if (!material || material.transparent || !material.depthTest) return material;
            let record = materials.get(material);
            if (!record) {
              const owned = (owners.get(material)?.size || 0) > 1,
                use = owned ? material.clone() : material;
              record = {
                material: use,
                opacity: use.opacity,
                alphaHash: use.alphaHash,
                owned,
              };
              materials.set(material, record);
              use.alphaHash = true;
              use.needsUpdate = true;
            }
            return record.material;
          });
        if (replacement.some((material, i) => material !== list[i])) {
          bindings.push({ mesh, original });
          mesh.material = Array.isArray(original) ? replacement : replacement[0];
        }
      }
      return { root, meshes, materials: [...materials.values()], bindings, opacity: 1 };
    });
  }
  update(camera, dt) {
    const step = Math.max(0, Math.min(0.1, dt));
    if (!this.avatar || !this.samples.length) return;
    this.avatar.updateWorldMatrix(true, true);
    this.avatar.getWorldPosition(this.avatarPosition);
    camera.getWorldPosition(this.origin);
    this.nearby.length = 0;
    for (const actor of this.actors) {
      actor.blocked = false;
      if (!actor.root.visible) continue;
      actor.root.getWorldPosition(this.point);
      const distance = Math.hypot(
        this.point.x - this.avatarPosition.x,
        this.point.z - this.avatarPosition.z,
      );
      actor.distance = distance;
      if (distance <= 6) this.nearby.push(actor);
    }
    this.nearby.sort((a, b) => a.distance - b.distance);
    this.nearby.length = Math.min(3, this.nearby.length);
    for (const actor of this.nearby) {
      actor.root.updateWorldMatrix(true, true);
      for (const sample of this.samples) {
        if (!sample.mesh.visible) continue;
        this.point.copy(sample.local).applyMatrix4(sample.mesh.matrixWorld);
        this.direction.copy(this.point).sub(this.origin);
        this.ray.far = Math.max(0, this.direction.length() - 0.08);
        this.ray.set(this.origin, this.direction.normalize());
        this.hits.length = 0;
        for (const mesh of actor.meshes) {
          if (mesh.visible) this.ray.intersectObject(mesh, false, this.hits);
        }
        if (this.hits.length) {
          actor.blocked = true;
          break;
        }
      }
    }
    for (const actor of this.actors) {
      const target = actor.blocked ? 0.35 : 1;
      actor.opacity = THREE.MathUtils.lerp(
        actor.opacity,
        target,
        1 - Math.exp(-step * (actor.blocked ? 28 : 10)),
      );
      if (Math.abs(actor.opacity - target) < 0.002) actor.opacity = target;
      for (const record of actor.materials)
        record.material.opacity = record.opacity * actor.opacity;
    }
  }
  clearActors() {
    for (const actor of this.actors) {
      for (const { mesh, original } of actor.bindings) mesh.material = original;
      for (const record of actor.materials) {
        if (record.owned) record.material.dispose();
        else {
          record.material.opacity = record.opacity;
          record.material.alphaHash = record.alphaHash;
          record.material.needsUpdate = true;
        }
      }
    }
    this.actors = [];
    this.nearby.length = 0;
  }
  dispose() {
    this.clearActors();
    this.samples = [];
    this.avatar = null;
    this.hits.length = 0;
  }
}
