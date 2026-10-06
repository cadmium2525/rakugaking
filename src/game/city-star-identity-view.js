import * as THREE from 'three';

// Mission landmarks contain a fixed number of meshes. Their animation updates
// transforms and materials in place; defending the beacon never allocates props.
export function buildCityStarIdentity(world, stage) {
  if (stage.id !== 4 && stage.id !== 5) return { update() {} };
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1),
    crystalGeometry = new THREE.IcosahedronGeometry(1, 0),
    materials = new Map();
  const material = (color) => {
    if (!materials.has(color))
      materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    return materials.get(color);
  };
  const mesh = (geometry, color, parent, position, scale) => {
    const object = new THREE.Mesh(geometry, material(color));
    object.position.set(...position);
    object.scale.set(...scale);
    parent.add(object);
    return object;
  };
  if (stage.id === 4) {
    const repair = stage.missions.find((m) => m.type === 'repair'),
      gearGeometry = new THREE.TorusGeometry(1, 0.18, 6, 12),
      gears = [],
      mechanism = new THREE.Group();
    mechanism.position.set(repair.x, stage.height(repair.x, -72.8), -72.8);
    world.add(mechanism);
    mesh(boxGeometry, 0x65545a, mechanism, [0, 1.8, 0], [4, 3.6, 0.35]);
    mesh(boxGeometry, 0xcfad79, mechanism, [0, 1.8, 0.19], [3.7, 3.3, 0.08]);
    for (const [x, y, radius, direction] of [
      [-1, 1.25, 0.65, 1],
      [0, 2.05, 0.6, -1],
      [1, 1.25, 0.65, 1],
    ]) {
      const root = new THREE.Group();
      root.position.set(x, y, 0.32);
      mechanism.add(root);
      mesh(gearGeometry, 0x886641, root, [0, 0, 0], [radius, radius, 0.3]);
      mesh(boxGeometry, 0x5f5362, root, [0, 0, 0], [0.18, radius * 1.7, 0.17]);
      mesh(boxGeometry, 0x5f5362, root, [0, 0, 0], [radius * 1.7, 0.18, 0.17]);
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4,
          tooth = mesh(
            boxGeometry,
            0x886641,
            root,
            [Math.sin(angle) * radius, Math.cos(angle) * radius, 0],
            [0.22, 0.24, 0.2],
          );
        tooth.rotation.z = -angle;
      }
      gears.push({ root, direction });
    }
    const mechanic = new THREE.Group();
    mechanic.position.set(-19, stage.height(-19, -69), -69);
    world.add(mechanic);
    mesh(boxGeometry, 0x58657d, mechanic, [0, 0.35, 0], [0.7, 0.7, 0.55]);
    mesh(boxGeometry, 0x78a6a0, mechanic, [0, 0.95, 0], [0.8, 0.65, 0.65]);
    mesh(crystalGeometry, 0xebc795, mechanic, [0, 1.5, 0], [0.37, 0.34, 0.35]);
    mesh(boxGeometry, 0x675767, mechanic, [0, 1.8, 0], [0.8, 0.12, 0.65]);
    const wrench = mesh(boxGeometry, 0xc7d1d0, mechanic, [0.5, 1.15, 0.16], [0.14, 0.9, 0.12]);
    wrench.rotation.z = -0.45;
    const status = mesh(crystalGeometry, 0xf4cd7c, mechanism, [0, 3.12, 0.3], [0.22, 0.22, 0.22]);
    return {
      update(course) {
        const repaired = course.field.done(repair.id);
        for (const gear of gears)
          gear.root.rotation.z = repaired ? course.elapsed * gear.direction * 0.9 : 0;
        status.material.emissive.setHex(repaired ? 0x8ae8b7 : 0);
        status.material.emissiveIntensity = repaired ? 0.8 : 0;
        wrench.rotation.z = repaired ? -0.45 + Math.sin(course.elapsed * 2) * 0.18 : -0.45;
      },
    };
  }
  const defense = stage.missions.find((m) => m.type === 'defense'),
    beacon = new THREE.Group(),
    pulseMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe4a6,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    });
  beacon.position.set(defense.x, stage.height(defense.x, defense.z), defense.z);
  world.add(beacon);
  mesh(boxGeometry, 0xb4bfd7, beacon, [0, 0.3, 0], [0.7, 0.6, 0.7]);
  mesh(boxGeometry, 0x727eaa, beacon, [0, 1, 0], [0.32, 0.8, 0.32]);
  const light = mesh(crystalGeometry, 0xf4dfa2, beacon, [0, 1.6, 0], [0.35, 0.4, 0.35]);
  light.userData.identityRole = 'beacon-crystal';
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.75, 15, 8, 1, true),
    pulseMaterial,
  );
  beam.position.y = 9.5;
  beam.userData.identityRole = 'beacon-beam';
  beacon.add(beam);
  beam.visible = false;
  const healthCanvas = document.createElement('canvas');
  healthCanvas.width = 256;
  healthCanvas.height = 80;
  const healthContext = healthCanvas.getContext('2d'),
    healthTexture = new THREE.CanvasTexture(healthCanvas),
    healthBar = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: healthTexture, depthTest: false, depthWrite: false }),
    );
  healthBar.position.y = 3.3;
  healthBar.scale.set(3.9, 1.22, 1);
  healthBar.renderOrder = 15;
  healthBar.visible = false;
  healthBar.userData.identityRole = 'beacon-health';
  beacon.add(healthBar);
  let displayedHP = -1;
  const maxHP = defense.beaconHP || 100;
  const paintHealth = (hp) => {
    if (hp === displayedHP) return;
    displayedHP = hp;
    healthContext.clearRect(0, 0, 256, 80);
    healthContext.fillStyle = '#263347ee';
    healthContext.beginPath();
    healthContext.roundRect(0, 0, 256, 80, 12);
    healthContext.fill();
    healthContext.fillStyle = '#fff4d4';
    healthContext.font = 'bold 24px sans-serif';
    healthContext.textAlign = 'center';
    healthContext.fillText(`灯台 ${hp}/${maxHP}`, 128, 32);
    healthContext.fillStyle = '#526079';
    healthContext.fillRect(15, 47, 226, 17);
    healthContext.fillStyle =
      hp <= maxHP * 0.3 ? '#ef7f6b' : hp <= maxHP * 0.5 ? '#f4bd6c' : '#a8e7bd';
    healthContext.fillRect(15, 47, (226 * hp) / maxHP, 17);
    healthTexture.needsUpdate = true;
    healthBar.userData.hp = hp;
  };
  return {
    update(course) {
      const state = course.field.defenses?.get(defense.id),
        complete = course.field.done(defense.id),
        active = state?.started || false,
        hp = Math.max(0, Math.min(maxHP, Math.round(state?.hp ?? maxHP))),
        hit = (active || complete) && course.elapsed < (state?.hitUntil || 0),
        low = hp <= maxHP * 0.3;
      light.rotation.y = course.elapsed * (active || complete ? 0.9 : 0.15);
      light.material.emissive.setHex(
        hit ? 0xff342b : active || complete ? (low ? 0xee7952 : 0xffd980) : 0,
      );
      light.material.emissiveIntensity = hit ? 1.35 : active || complete ? 0.8 : 0;
      beam.visible = active || complete;
      pulseMaterial.color.setHex(hit ? 0xff5440 : low ? 0xefb07a : 0xffe4a6);
      pulseMaterial.opacity = hit
        ? 0.56
        : complete
          ? 0.4
          : 0.23 + Math.sin(course.elapsed * 3) * 0.04;
      healthBar.visible = active || complete;
      if (healthBar.visible) paintHealth(hp);
    },
  };
}
