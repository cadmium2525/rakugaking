import * as THREE from 'three';

// Small scene accents make the two mission systems visible in the landscape.
// The marker poles use the same dimensions and positions as stage.solids;
// cloth, ground traces and water glints are decorative and never obstruct a route.
export function buildWindWaterIdentity(world, stage) {
  const flags = [],
    glints = [],
    dryGarden = new THREE.Group();
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1),
    poleMaterial = new THREE.MeshStandardMaterial({ color: 0x93734d, roughness: 1 });
  const addBox = (x, y, z, w, h, d, material) => {
    const mesh = new THREE.Mesh(boxGeometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    world.add(mesh);
    return mesh;
  };
  for (const marker of stage.windMarkers || []) {
    const ground = stage.height(marker.x, marker.z);
    addBox(marker.x, ground + 1.6, marker.z, 0.18, 3.2, 0.18, poleMaterial);
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.7, 3, 1),
      new THREE.MeshStandardMaterial({
        color: 0xf2c879,
        roughness: 1,
        side: THREE.DoubleSide,
      }),
    );
    const pivot = new THREE.Group();
    pivot.position.set(marker.x, ground + 2.75, marker.z);
    pivot.rotation.y = marker.direction;
    cloth.position.x = 0.95;
    pivot.add(cloth);
    world.add(pivot);
    flags.push({ cloth, phase: marker.x * 0.1, positions: cloth.geometry.attributes.position });
  }
  if (stage.id === 2) {
    const escort = stage.missions.find((mission) => mission.type === 'escort'),
      home = escort.destination,
      landingMaterial = new THREE.MeshStandardMaterial({
        color: 0x8b633f,
        roughness: 1,
        side: THREE.DoubleSide,
      });
    // A painted landing target sits on the real hill rather than a floating platform.
    const landing = new THREE.Mesh(new THREE.RingGeometry(2.5, 2.75, 40), landingMaterial);
    landing.rotation.x = -Math.PI / 2;
    landing.position.set(home.x, stage.height(home.x, home.z) + 0.12, home.z);
    world.add(landing);
    for (const [dx, dz] of [
      [-1.6, 0],
      [1.6, 0],
    ]) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 2.6), landingMaterial);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(home.x + dx, stage.height(home.x + dx, home.z + dz) + 0.13, home.z + dz);
      world.add(stripe);
    }
  }
  if (stage.id === 3) {
    const channelMaterial = new THREE.MeshStandardMaterial({
        color: 0x4ba4b7,
        roughness: 0.3,
        emissive: 0x215f6e,
        emissiveIntensity: 0.22,
      }),
      glintMaterial = new THREE.MeshBasicMaterial({ color: 0xc7eff0 }),
      glintGeometry = new THREE.IcosahedronGeometry(0.12, 0);
    for (const points of stage.drainChannels || []) {
      const curve = new THREE.CatmullRomCurve3(
        points.map(([x, z]) => new THREE.Vector3(x, stage.height(x, z) + 0.2, z)),
      );
      // Short ground-level channels only indicate the water's route. The wide
      // river and basin that affect movement remain stage.waters and are drained together.
      const samples = curve.getPoints(36);
      samples.forEach((point) => {
        point.y = stage.height(point.x, point.z) + 0.2;
      });
      const groundCurve = new THREE.CatmullRomCurve3(samples);
      const channel = new THREE.Mesh(
        new THREE.TubeGeometry(groundCurve, 36, 0.14, 5, false),
        channelMaterial,
      );
      world.add(channel);
      for (let i = 0; i < 6; i++) {
        const glint = new THREE.Mesh(glintGeometry, glintMaterial);
        world.add(glint);
        glints.push({ root: glint, curve: groundCurve, offset: i / 6 });
      }
    }
    const basin = stage.missions.find((mission) => mission.id === 'pearls'),
      traceMaterial = new THREE.LineBasicMaterial({ color: 0x9a9c78 });
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6,
        points = [];
      for (const radius of [3, 5, 7, 10, 12]) {
        const x = basin.x + Math.cos(angle + Math.sin(radius + i) * 0.03) * radius,
          z = basin.z + Math.sin(angle + Math.sin(radius + i) * 0.03) * radius;
        points.push(new THREE.Vector3(x, stage.height(x, z) + 0.08, z));
      }
      dryGarden.add(
        new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), traceMaterial),
      );
    }
    dryGarden.visible = false;
    world.add(dryGarden);
  }
  return {
    update(course) {
      const time = course.elapsed,
        gentle = stage.id === 2 && course.field.done('mills'),
        drained = stage.id === 3 && course.field.done('sluice');
      for (const flag of flags) {
        const positions = flag.positions;
        for (let index = 0; index < positions.count; index++) {
          const extent = (positions.getX(index) + 0.95) / 1.9;
          positions.setZ(
            index,
            Math.sin(time * (gentle ? 1.8 : 4.8) + flag.phase + extent * 5) *
              extent *
              (gentle ? 0.05 : 0.18),
          );
        }
        positions.needsUpdate = true;
      }
      for (const glint of glints) {
        glint.root.visible = !drained;
        if (!drained) glint.curve.getPointAt((time * 0.12 + glint.offset) % 1, glint.root.position);
      }
      dryGarden.visible = drained;
    },
  };
}
