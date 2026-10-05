import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cameraMovement, cameraClearance, cameraFollow } from '../src/core/camera.js';
import { defaultDrawing } from '../src/core/drawing.js';
import { sketchTemplate } from '../src/core/sketch.js';
import { buildCharacter, disposeCharacter } from '../src/game/character.js';
import { Simulation, initPhysics } from '../src/core/controller.js';
import { CITY_STAGE } from '../src/game/city-stage.js';

function lensInside(position, box, margin = 0.1) {
  return (
    Math.abs(position.x - box.x) < box.w / 2 + margin &&
    Math.abs(position.y - box.y) < box.h / 2 + margin &&
    Math.abs(position.z - box.z) < box.d / 2 + margin
  );
}
test('movement follows the view without reversing diagonal length', () => {
  const input = { x: 0, z: -1, jump: true, action: true };
  assert.deepEqual(cameraMovement(input, 0), input);
  const side = cameraMovement(input, Math.PI / 2);
  assert.ok(Math.abs(side.x + 1) < 0.00001);
  assert.ok(Math.abs(side.z) < 0.00001);
  assert.equal(side.jump, true);
  const diagonal = cameraMovement({ x: 1, z: -1 }, 1.1);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - Math.sqrt(2)) < 0.00001);
});
test('follow camera stops in front of a house and a hillside', () => {
  const focus = { x: 0, y: 2, z: 0 },
    desired = { x: 0, y: 8, z: 16 };
  const house = { platforms: [{ x: 0, y: 4, z: 8, w: 6, h: 8, d: 4 }] };
  assert.ok(cameraClearance(focus, desired, house).z < 5.7);
  house.platforms[0].cameraBlock = false;
  assert.deepEqual(cameraClearance(focus, desired, house), desired);
  assert.deepEqual(cameraClearance(focus, desired, { platforms: [] }), desired);
  assert.ok(cameraClearance(focus, desired, { height: (_, z) => (z > 8 ? 12 : 0) }).z < 8.1);
});

test('the lens clears the actual city house from every nearby face and diagonal', () => {
  const house = CITY_STAGE.platforms.find((p) => p.x === -19 && p.z === -1 && p.h === 4),
    solids = CITY_STAGE.platforms.filter(
      (p) => !p.terrain && !p.gate && p.cameraBlock !== false && p.w && p.h && p.d,
    );
  for (const gap of [0.4, 0.7, 1, 1.5, 2])
    for (const [sx, sz] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
      [-1, -1],
      [1, 1],
    ]) {
      const x = house.x + sx * (house.w / 2 + gap),
        z = house.z + sz * (house.d / 2 + gap),
        y = CITY_STAGE.height(x, z) + 0.82,
        direction = Math.hypot(house.x - x, house.z - z),
        focus = { x, y: y + 0.7, z },
        desired = {
          x: x + ((house.x - x) / direction) * 16,
          y: y + 9,
          z: z + ((house.z - z) / direction) * 16,
        },
        safe = cameraClearance(focus, desired, CITY_STAGE);
      assert.ok(Object.values(safe).every(Number.isFinite));
      for (const box of solids)
        assert.ok(!lensInside(safe, box), JSON.stringify({ gap, sx, sz, safe, box }));
      assert.ok(safe.y >= CITY_STAGE.height(safe.x, safe.z) + 0.1);
    }
});

test('a focus inside the wall safety margin can retreat but cannot push the lens through it', () => {
  const box = { x: 0, y: 3, z: 4, w: 8, h: 6, d: 2 },
    stage = { platforms: [box] },
    focus = { x: 0, y: 2, z: 2.8 },
    toward = cameraClearance(focus, { x: 0, y: 2, z: 8 }, stage),
    away = { x: 0, y: 2, z: -8 };
  assert.ok(toward.z < 2.7, JSON.stringify(toward));
  assert.ok(!lensInside(toward, box));
  assert.deepEqual(cameraClearance(focus, away, stage), away);
  assert.deepEqual(cameraClearance(focus, focus, stage), focus);
});

test('the interpolated camera is rechecked when an orbit chord passes through a wall', () => {
  const focus = { x: 0, y: 2, z: 0 },
    stage = { platforms: [{ x: 4, y: 3, z: 4, w: 3, h: 6, d: 3 }] },
    first = { x: 0, y: 4, z: 8 },
    last = { x: 8, y: 4, z: 0 };
  assert.deepEqual(cameraClearance(focus, first, stage), first);
  assert.deepEqual(cameraClearance(focus, last, stage), last);
  const interpolated = { x: 4, y: 4, z: 4 };
  assert.ok(lensInside(interpolated, stage.platforms[0], 0));
  const clipped = cameraClearance(focus, interpolated, stage);
  assert.ok(!lensInside(clipped, stage.platforms[0]));
});

test('nearby terrain clips before the surface even inside the former minimum follow distance', () => {
  const focus = { x: 0, y: 1, z: 0 },
    desired = { x: 0, y: 3, z: 16 },
    stage = { height: (_, z) => (z > 0.5 ? 2 : 0) },
    safe = cameraClearance(focus, desired, stage);
  assert.ok(safe.z < 0.5 && safe.z > 0, JSON.stringify(safe));
  assert.ok(safe.y > stage.height(safe.x, safe.z) + 0.3);
  const flat = { height: () => 0 },
    shallow = cameraClearance({ x: 0, y: 0.31, z: 0 }, { x: 0, y: 0.2, z: 16 }, flat);
  assert.ok(shallow.y >= 0.3);
  assert.ok(shallow.z < 2);
  assert.deepEqual(cameraClearance(focus, desired, flat), desired);
});

test('unobstructed follow preserves the ordinary camera position, height and look ahead', () => {
  const player = { x: 4, y: 2, z: -10 };
  for (const [distance, baseHeight, lookAhead] of [
    [16, 9, 8],
    [11, 6.5, 3],
    [22, 15, 8],
  ])
    for (const pitch of [-0.2, 0, 0.6])
      for (const yaw of [0, 0.7, -2.1]) {
        const desired = {
            x: player.x + Math.sin(yaw) * distance,
            y: player.y + baseHeight + pitch * 14,
            z: player.z + Math.cos(yaw) * distance,
          },
          follow = cameraFollow(player, desired, { platforms: [] }, { yaw, lookAhead });
        assert.deepEqual(follow.position, desired);
        assert.equal(follow.fallback, false);
        assert.ok(Math.abs(follow.look.x - (player.x - Math.sin(yaw) * lookAhead)) < 0.00001);
        assert.ok(Math.abs(follow.look.z - (player.z - Math.cos(yaw) * lookAhead)) < 0.00001);
        assert.ok(Math.abs(follow.look.y - (player.y + 1.5)) < 0.00001);
      }
});

test('close city walls keep the hero in frame through low pitch and interpolated orbit turns', () => {
  const house = CITY_STAGE.platforms.find((p) => p.x === -19 && p.z === -1 && p.h === 4),
    solids = CITY_STAGE.platforms.filter(
      (p) => !p.terrain && !p.gate && p.cameraBlock !== false && p.w && p.h && p.d,
    ),
    hero = buildCharacter(defaultDrawing());
  hero.updateMatrixWorld(true);
  const models = [
      hero,
      buildCharacter(sketchTemplate('dog')),
      buildCharacter(sketchTemplate('dragon')),
    ],
    modelBoxes = models.map((model) => {
      model.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(model);
    }),
    partPoints = ['body', 'head', 'legLeft', 'legRight'].map((part) => {
      const joint = hero.userData.joints[part],
        box = new THREE.Box3();
      if (part === 'body')
        joint.children.filter((o) => o.isMesh).forEach((o) => box.expandByObject(o));
      else box.setFromObject(joint);
      const point = box.getCenter(new THREE.Vector3());
      if (part.startsWith('leg')) point.y = box.min.y;
      point.y -= 0.8;
      return point;
    });
  for (const gap of [0.4, 0.7, 1, 1.5, 2])
    for (const [sx, sz] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
      [-1, -1],
      [1, 1],
    ])
      for (const followDistance of [11, 16, 22])
        for (const height of [9, 6.2, 3.7])
          for (const turn of [-0.16, 0, 0.16])
            for (const blend of [1, 0.08]) {
              const player = {
                x: house.x + sx * (house.w / 2 + gap),
                z: house.z + sz * (house.d / 2 + gap),
              };
              player.y = CITY_STAGE.height(player.x, player.z) + 0.82;
              const yaw = Math.atan2(house.x - player.x, house.z - player.z) + turn,
                desired = {
                  x: player.x + Math.sin(yaw) * followDistance,
                  y: player.y + height,
                  z: player.z + Math.cos(yaw) * followDistance,
                },
                previous = {
                  x: player.x + Math.sin(yaw + 0.32) * followDistance,
                  y: player.y + height,
                  z: player.z + Math.cos(yaw + 0.32) * followDistance,
                },
                follow = cameraFollow(player, desired, CITY_STAGE, { previous, blend, yaw }),
                lens = follow.position,
                detail = JSON.stringify({
                  gap,
                  sx,
                  sz,
                  followDistance,
                  height,
                  turn,
                  blend,
                  follow,
                });
              assert.ok(
                Math.hypot(lens.x - player.x, lens.y - player.y, lens.z - player.z) >= 6,
                detail,
              );
              assert.ok(Math.hypot(lens.x - player.x, lens.z - player.z) >= 4, detail);
              assert.equal(follow.limited, false, detail);
              for (const box of solids) assert.ok(!lensInside(lens, box), detail);
              assert.ok(lens.y > CITY_STAGE.height(lens.x, lens.z) + 0.1, detail);
              for (const [aspect, fov] of [
                [1280 / 800, 60],
                [390 / 844, 60],
                [844 / 390, 50],
              ]) {
                const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 350);
                camera.position.set(lens.x, lens.y, lens.z);
                camera.lookAt(follow.look.x, follow.look.y, follow.look.z);
                camera.updateMatrixWorld(true);
                // Feet, body and head centers must stay visible. In particular,
                // the close lens must not enter the head or point over the hero.
                for (const height of [-0.6, 0.2, 1.2]) {
                  const point = new THREE.Vector3(player.x, player.y + height, player.z).project(
                    camera,
                  );
                  assert.ok(Math.abs(point.x) < 0.95 && Math.abs(point.y) < 0.95, detail);
                  assert.ok(point.z > -1 && point.z < 1, detail);
                }
                for (const local of partPoints) {
                  const point = local
                    .clone()
                    .add(new THREE.Vector3(player.x, player.y, player.z))
                    .project(camera);
                  assert.ok(Math.abs(point.x) < 0.95 && Math.abs(point.y) < 0.95, detail);
                  assert.ok(point.z > -1 && point.z < 1, detail);
                }
                for (const box of modelBoxes) {
                  const projected = [-1, 1].flatMap((x) =>
                    [-1, 1].flatMap((y) =>
                      [-1, 1].map((z) =>
                        new THREE.Vector3(
                          player.x + (x < 0 ? box.min.x : box.max.x),
                          player.y - 0.8 + (y < 0 ? box.min.y : box.max.y),
                          player.z + (z < 0 ? box.min.z : box.max.z),
                        ).project(camera),
                      ),
                    ),
                  );
                  for (const point of projected) {
                    assert.ok(Math.abs(point.x) < 0.95 && Math.abs(point.y) < 0.95, detail);
                    assert.ok(point.z > -1 && point.z < 1, detail);
                  }
                  const width =
                      Math.max(...projected.map((p) => p.x)) -
                      Math.min(...projected.map((p) => p.x)),
                    height =
                      Math.max(...projected.map((p) => p.y)) -
                      Math.min(...projected.map((p) => p.y));
                  assert.ok(
                    width < 1.2 && height < 1.2,
                    'the real silhouette must not fill the viewport',
                  );
                }
              }
            }
  models.forEach(disposeCharacter);
});

test('a blocked camera keeps its previous clear side and movement follows its optical heading', () => {
  const player = { x: 0, y: 0.82, z: 0 },
    desired = { x: 0, y: 9.82, z: 16 },
    stage = { platforms: [{ x: 0, y: 6, z: 4, w: 20, h: 12, d: 2 }] };
  let previous = { x: -16, y: 9.82, z: 0 };
  for (const yaw of [0, 0.01, -0.01, 0]) {
    const follow = cameraFollow(player, desired, stage, { previous, yaw, blend: 0.08 });
    assert.ok(follow.position.x < -4, 'small changes retain the left side');
    assert.ok(Math.abs(follow.heading + Math.PI / 2) < 0.03);
    const forward = cameraMovement({ x: 0, z: -1 }, follow.heading),
      toward = { x: follow.look.x - follow.position.x, z: follow.look.z - follow.position.z },
      length = Math.hypot(toward.x, toward.z);
    assert.ok((forward.x * toward.x) / length + (forward.z * toward.z) / length > 0.99999);
    previous = follow.position;
  }
});

test('a real walk to the city market awning keeps every shipped body framed at a safe distance', async () => {
  await initPhysics();
  // This fixture starts on the open approach, then uses ordinary controller
  // input to reach the narrow gap beside the stall; it never teleports there.
  const stage = CITY_STAGE,
    sim = new Simulation(stage.platforms, { x: 32.4, y: stage.height(32.4, -9) + 0.82, z: -9 }),
    target = { x: 31.87, z: -12 },
    models = [defaultDrawing(), sketchTemplate('dog'), sketchTemplate('dragon')].map(
      buildCharacter,
    ),
    solids = stage.platforms.filter(
      (p) => !p.terrain && !p.gate && p.cameraBlock !== false && p.w && p.h && p.d,
    );
  try {
    for (let i = 0; i < 600; i++) {
      const p = sim.position;
      if (Math.hypot(target.x - p.x, target.z - p.z) < 0.035) break;
      sim.step({ x: (target.x - p.x) * 1.5, z: (target.z - p.z) * 1.5 });
    }
    for (let i = 0; i < 90; i++) sim.step({});
    const player = sim.position;
    assert.ok(Math.hypot(player.x - target.x, player.z - target.z) < 0.25);
    assert.equal(sim.grounded, true);
    assert.equal(sim.deaths, 0);
    assert.equal(sim.jumps, 0);
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
      for (const [distance, height, aspect, fov] of [
        [16, 9, 1280 / 800, 60],
        [22, 15, 390 / 844, 60],
        [11, 6.5, 844 / 390, 50],
      ]) {
        const desired = {
            x: player.x + Math.sin(yaw) * distance,
            y: player.y + height,
            z: player.z + Math.cos(yaw) * distance,
          },
          follow = cameraFollow(player, desired, stage, { yaw }),
          lens = follow.position;
        assert.equal(follow.limited, false);
        assert.ok(Math.hypot(lens.x - player.x, lens.z - player.z) >= 4);
        assert.ok(Math.hypot(lens.x - player.x, lens.y - player.y, lens.z - player.z) >= 6);
        for (const solid of solids) assert.ok(!lensInside(lens, solid));
        assert.equal(
          sim.lineClear({ ...player, y: player.y + 0.7 }, lens),
          true,
          'the physical roof and house leave a clear view to the hero',
        );
        const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 350);
        camera.position.set(lens.x, lens.y, lens.z);
        camera.lookAt(follow.look.x, follow.look.y, follow.look.z);
        camera.updateMatrixWorld(true);
        for (const model of models) {
          model.position.set(player.x, player.y - 0.8, player.z);
          model.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(model),
            points = [box.min.x, box.max.x].flatMap((x) =>
              [box.min.y, box.max.y].flatMap((y) =>
                [box.min.z, box.max.z].map((z) => new THREE.Vector3(x, y, z).project(camera)),
              ),
            );
          for (const point of points)
            assert.ok(
              Math.abs(point.x) < 0.95 && Math.abs(point.y) < 0.95 && point.z > -1 && point.z < 1,
            );
          const width = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)),
            height = Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));
          assert.ok(
            width < 1.2 && height < 1.2,
            'the visible body fits without becoming a close-up',
          );
        }
      }
  } finally {
    sim.dispose();
    models.forEach(disposeCharacter);
  }
});

test('a low ceiling permits a distant eye-level view beneath the physical roof', () => {
  const player = { x: 0, y: 0.82, z: 0 },
    desired = { x: 0, y: 9.82, z: 16 },
    roof = { x: 0, y: 2.3, z: 0, w: 100, h: 0.2, d: 100 },
    follow = cameraFollow(player, desired, { platforms: [roof] });
  assert.equal(follow.limited, false);
  assert.ok(Math.hypot(follow.position.x, follow.position.z) >= 4);
  assert.ok(Math.hypot(follow.position.x, follow.position.y - player.y, follow.position.z) >= 6);
  assert.ok(follow.position.y < roof.y - roof.h / 2 - 0.3);
  assert.ok(!lensInside(follow.position, roof));
});
