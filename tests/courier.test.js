import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics, Simulation, DT } from '../src/core/controller.js';
import { Course } from '../src/core/course.js';
import { WIND_STAGE } from '../src/game/wind-stage.js';

before(initPhysics);

const sphereDistanceToPost = (position, post) => {
  const x = Math.max(post.x - post.w / 2, Math.min(post.x + post.w / 2, position.x)),
    z = Math.max(post.z - post.d / 2, Math.min(post.z + post.d / 2, position.z));
  return Math.hypot(position.x - x, position.z - z);
};

for (const [direction, start, target] of [
  ['south', { x: 0, z: 2 }, { x: 0, z: -2 }],
  ['north', { x: 0, z: -2 }, { x: 0, z: 2 }],
  ['east', { x: -2, z: 0 }, { x: 2, z: 0 }],
  ['west', { x: 2, z: 0 }, { x: -2, z: 0 }],
  ['diagonal', { x: 2, z: 2 }, { x: -2, z: -2 }],
]) {
  test(`courier physically passes a thin flagpost from the ${direction}`, () => {
    const post = { x: 0, y: 1.6, z: 0, w: 0.18, h: 3.2, d: 0.18 },
      sim = new Simulation([post], { x: 5, y: 0.8, z: 5 });
    try {
      let position = { ...start, y: 0.8 },
        distanceTravelled = 0,
        reached = false;
      for (let frame = 0; frame < 240; frame++) {
        const dx = target.x - position.x,
          dz = target.z - position.z,
          distance = Math.hypot(dx, dz);
        if (distance < 0.1) {
          reached = true;
          break;
        }
        const next = sim.moveActor(position, {
          x: (dx / distance) * Math.min(distance, 4.8 * DT),
          z: (dz / distance) * Math.min(distance, 4.8 * DT),
          courier: true,
          avoidSide: position.avoidSide,
        });
        const movement = Math.hypot(next.x - position.x, next.z - position.z);
        assert.ok(movement <= 4.8 * DT + 0.001, 'avoidance cannot teleport the courier');
        assert.ok(
          sphereDistanceToPost(next, post) >= 0.35 - 0.002,
          `the sphere entered the post: ${JSON.stringify(next)}`,
        );
        distanceTravelled += movement;
        position = { ...position, ...next };
      }
      assert.ok(reached, `courier stopped at the post: ${JSON.stringify(position)}`);
      assert.ok(
        distanceTravelled > Math.hypot(target.x - start.x, target.z - start.z) + 0.05,
        'the route must physically bend around the obstacle',
      );
      assert.ok(sim.platforms[0].isEnabled(), 'avoidance must retain the physical obstacle');
      assert.equal(sim.lineClear({ x: 0, y: 0.8, z: 1 }, { x: 0, y: 0.8, z: -1 }), false);
    } finally {
      sim.dispose();
    }
  });
}

// Player poses sampled during the critic's keyboard run near the old stuck
// flagpost, starting at game time 40.9167. Interpolation below deliberately
// positions the player as a unit fixture; this is not a browser gameplay test.
// The original courier stopped at (-13.9877, -15.4655) until game time 91.4167.
const criticPoses = [
  [0, -10.205812, 0.995196, -16.037474],
  [0.1, -10.752285, 0.958529, -15.950022],
  [0.2, -11.258588, 0.921863, -16.102558],
  [0.3, -11.788553, 0.879085, -16.235189],
  [0.4, -12.274967, 0.842418, -16.081758],
  [0.5, -12.793157, 0.8201, -15.927103],
  [0.6, -13.363207, 0.820184, -15.863721],
  [0.7, -13.864456, 0.820114, -15.641218],
  [0.8, -14.321195, 0.82021, -15.387211],
  [0.9, -14.737994, 0.820095, -14.974905],
  [1, -15.148633, 0.8201, -14.548005],
  [1.1, -15.557681, 0.820136, -14.116752],
  [1.2, -15.966489, 0.820101, -13.684327],
  [1.3, -16.375378, 0.820147, -13.251692],
  [1.4, -16.784395, 0.820189, -12.819078],
  [1.5, -17.193487, 0.820344, -12.38657],
  [1.6, -17.602692, 0.8201, -11.954087],
  [1.7, -18.011921, 0.820961, -11.521688],
  [1.8, -18.421236, 0.820674, -11.089304],
  [1.9, -18.830561, 0.821017, -10.65695],
  [2, -19.239826, 0.820814, -10.224598],
  [2.1, -19.46335, 0.82332, -9.989184],
  [2.2, -19.536036, 0.828278, -9.91567],
  [2.3, -19.559679, 0.82996, -9.893698],
  [2.4, -19.567389, 0.830442, -9.888473],
  [2.5, -19.569935, 0.830383, -9.888165],
];

test('critic trace fixture: courier passes the real wind-stage post without penetrating it', () => {
  const course = new Course(WIND_STAGE, { hp: 100 }),
    courier = course.field.escorts.get('rescue'),
    post = WIND_STAGE.platforms.find((p) => p.x === -14 && p.z === -15 && p.w === 0.18);
  assert.ok(post, 'the regression uses the actual flagpost collider');
  Object.assign(courier, {
    x: -7.520713880930857,
    z: -16.158543491586567,
    started: true,
    trail: [],
  });
  course.elapsed = 40.91666666666563;
  const update = (pose) => {
    course.sim.body.setTranslation(pose, true);
    const previous = { x: courier.x, z: courier.z };
    course.field.updateIdentities(course, false, () => {});
    course.elapsed += DT;
    assert.ok(
      Math.hypot(courier.x - previous.x, courier.z - previous.z) <= 4.8 * DT + 0.001,
      'the fixture must not teleport the courier',
    );
    assert.ok(sphereDistanceToPost(courier, post) >= 0.35 - 0.002);
  };
  try {
    for (let index = 1; index < criticPoses.length; index++) {
      const a = criticPoses[index - 1],
        b = criticPoses[index],
        ticks = Math.round((b[0] - a[0]) / DT);
      for (let tick = 1; tick <= ticks; tick++) {
        const fraction = tick / ticks;
        update({
          x: a[1] + (b[1] - a[1]) * fraction,
          y: a[2] + (b[2] - a[2]) * fraction,
          z: a[3] + (b[3] - a[3]) * fraction,
        });
      }
    }
    const [, x, y, z] = criticPoses.at(-1);
    for (let tick = 0; tick < 360; tick++) update({ x, y, z });
    assert.ok(courier.x < -18 && courier.z > -12, JSON.stringify(courier));
    assert.ok(Math.hypot(courier.x - x, courier.z - z) < 1.5);
    assert.equal(courier.waiting, false);
    assert.equal(course.sim.deaths, 0);
  } finally {
    course.dispose();
  }
});
