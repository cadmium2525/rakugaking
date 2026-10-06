import * as THREE from 'three';

// A fixed set of actors and rings is reused throughout the run.
export function buildMissionIdentities(world, stage) {
  const escorts = [],
    defenses = [];
  const mesh = (geometry, color, parent) => {
    const object = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    parent.add(object);
    return object;
  };
  for (const m of stage.missions) {
    if (m.type === 'escort') {
      const bird = new THREE.Group();
      world.add(bird);
      const body = mesh(new THREE.IcosahedronGeometry(0.6, 1), 0xf0d88c, bird);
      body.position.y = 0.75;
      body.scale.set(0.75, 0.95, 1);
      for (const side of [-1, 1]) {
        const wing = mesh(new THREE.BoxGeometry(0.65, 0.12, 0.55), 0x77bcb0, bird);
        wing.position.set(side * 0.5, 0.8, 0);
        const eye = mesh(new THREE.SphereGeometry(0.07, 8, 6), 0x243e45, bird);
        eye.position.set(side * 0.18, 1.04, 0.45);
      }
      const beak = mesh(new THREE.ConeGeometry(0.16, 0.4, 4), 0xdf9569, bird);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.86, 0.63);
      const bag = mesh(new THREE.BoxGeometry(0.55, 0.45, 0.35), 0xb88760, bird);
      bag.position.set(0, 0.65, -0.5);
      const marker = mesh(new THREE.TorusGeometry(0.9, 0.045, 6, 24), m.color, bird);
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = 0.12;
      escorts.push({ m, bird, body, marker, previous: null });
    }
    if (m.type === 'defense') {
      const points = Array.from({ length: 81 }, (_, i) => {
        const angle = (i * Math.PI) / 40,
          x = m.x + Math.sin(angle) * m.radius,
          z = m.z + Math.cos(angle) * m.radius;
        return new THREE.Vector3(x, stage.height(x, z) + 0.12, z);
      });
      const ring = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0xf2d494 }),
      );
      world.add(ring);
      defenses.push({ m, ring });
    }
  }
  return {
    update(course) {
      for (const actor of escorts) {
        const e = course.field.escorts.get(actor.m.id),
          y = (e.y ?? stage.height(e.x, e.z) + 0.8) - 0.8;
        actor.bird.position.set(e.x, y, e.z);
        if (actor.previous && Math.hypot(e.x - actor.previous.x, e.z - actor.previous.z) > 0.005)
          actor.bird.rotation.y = Math.atan2(e.x - actor.previous.x, e.z - actor.previous.z);
        actor.previous = { x: e.x, z: e.z };
        actor.body.position.y =
          0.75 + (e.started && !e.waiting && !e.arrived ? Math.sin(course.elapsed * 12) * 0.08 : 0);
        actor.marker.material.color.setHex(
          e.waiting ? 0xef9363 : e.arrived ? 0x8be5b1 : actor.m.color,
        );
      }
      for (const { m, ring } of defenses) {
        const d = course.field.defenses.get(m.id);
        ring.material.color.setHex(d.complete ? 0x8be5b1 : d.started ? 0xefb660 : 0xaecede);
      }
    },
  };
}
