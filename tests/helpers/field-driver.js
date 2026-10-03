import { FIELD_STAGE } from '../../src/game/field-stage.js';

// Test pilot issues movement, jump and ACTION only; never mutates game state.
export function fieldControls(state, frame, order = ['orchard', 'ruins', 'boss']) {
  const f = state.field,
    p = state.position;
  let target,
    jump = false;
  const mission = order.find((id) => !f.rewards.includes(id));
  if (mission === 'orchard') {
    target = f.enemies.find((e) => e.hp > 0) || FIELD_STAGE.missions[0].reward;
  } else if (mission === 'ruins') {
    target =
      FIELD_STAGE.runes.find((r, i) => !f.runes.includes(i)) || FIELD_STAGE.missions[1].reward;
    jump = state.grounded;
  } else if (mission === 'boss') {
    const boss = FIELD_STAGE.boss;
    target =
      f.bossHP <= 0
        ? FIELD_STAGE.missions[2].reward
        : { x: boss.x + (f.bossPhase === 'rest' ? 2.8 : 8), z: boss.z };
  } else target = FIELD_STAGE.goal;
  const dx = target.x - p.x,
    dz = target.z - p.z;
  const distance = Math.hypot(dx, dz),
    scale = Math.max(1, distance);
  return {
    x: distance < 0.35 ? 0 : dx / scale,
    z: distance < 0.35 ? 0 : dz / scale,
    jump,
    action: frame % 48 === 0,
  };
}
export function driveField(course, maxFrames = 24000, order) {
  for (let frame = 0; frame < maxFrames && !course.complete; frame++) {
    course.step(
      fieldControls(
        {
          field: course.field.snapshot(),
          position: course.sim.position,
          grounded: course.sim.grounded,
        },
        frame,
        order,
      ),
    );
  }
  return { time: course.elapsed, deaths: course.sim.deaths };
}
