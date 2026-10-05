export function animateCharacter(root, motion, dt, combat = {}) {
  const d = root.userData;
  if (!d.joints && !d.sketch) return;
  const speed = Math.hypot(motion.vx, motion.vz),
    grounded = motion.grounded;
  d.phase += dt * (speed > 0.2 ? speed * 2.4 : 2);
  if (grounded && !d.wasGrounded) d.land = 0.18;
  d.land = Math.max(0, d.land - dt);
  d.wasGrounded = grounded;
  d.state = !grounded
    ? motion.vy > 0
      ? 'Jump'
      : 'Fall'
    : d.land > 0
      ? 'Land'
      : speed > 3
        ? 'Run'
        : speed > 0.2
          ? 'Walk'
          : 'Idle';
  const amount = grounded ? Math.min(0.7, speed * 0.1) : 0,
    cycle = Math.sin(d.phase) * amount;
  if (d.sketch) {
    d.rig.rotation.set(0, 0, 0);
    d.rig.position.z = 0;
    for (const { joint, role, index } of d.pieces) {
      joint.rotation.z =
        role === 'leg'
          ? Math.sin(d.phase + (index % 2) * Math.PI) * amount * 0.3
          : role === 'tail'
            ? Math.sin(d.phase * 0.6) * 0.1
            : 0;
      joint.rotation.y =
        role === 'wing'
          ? Math.sin(d.phase * 1.5 + (index % 2) * Math.PI) * (grounded ? 0.15 : 0.5)
          : 0;
    }
    d.rig.position.y = grounded ? Math.abs(Math.sin(d.phase)) * Math.min(0.025, speed * 0.008) : 0;
    const squash = (d.land / 0.18) * 0.08;
    root.scale.set(1 + squash * 0.3, 1 - squash, 1 + squash * 0.3);
    applyActionPose(root, combat);
    return;
  }
  d.joints.legLeft.rotation.x = grounded ? cycle : 0.28;
  d.joints.legRight.rotation.x = grounded ? -cycle : -0.18;
  d.joints.armLeft.rotation.x = grounded ? -cycle : -0.7;
  d.joints.armRight.rotation.x = grounded ? cycle : -0.7;
  d.joints.armLeft.rotation.z = 0.12;
  d.joints.armRight.rotation.z = -0.12;
  d.joints.head.rotation.z = grounded ? Math.sin(d.phase * 0.5) * 0.035 : 0;
  d.joints.body.position.y = d.baseY + (grounded ? Math.abs(Math.sin(d.phase)) * 0.025 : 0);
  d.joints.body.position.z = 0;
  d.joints.body.rotation.set(0, 0, 0);
  const squash = (d.land / 0.18) * 0.14;
  root.scale.set(1 + squash * 0.4, 1 - squash, 1 + squash * 0.4);
  applyActionPose(root, combat);
}

function applyActionPose(root, combat) {
  const d = root.userData,
    torso = d.rig || d.joints.body;
  if (combat.attacking) {
    const windup = Math.max(0.01, combat.windup),
      active = Math.max(0.01, combat.active),
      charge = Math.min(1, combat.elapsed / windup),
      strike = Math.max(0, Math.min(1, (combat.elapsed - windup) / active)),
      recovery =
        combat.elapsed < windup + active
          ? 1
          : Math.max(
              0,
              1 -
                (combat.elapsed - windup - active) /
                  Math.max(0.01, combat.duration - windup - active),
            ),
      snap = 1 - Math.pow(1 - strike, 3),
      side = combat.combo === 2 ? -1 : 1;
    d.state = combat.airborne
      ? 'AirAttack'
      : combat.combo === 3
        ? 'Finish'
        : `Attack${combat.combo}`;
    if (combat.airborne) {
      torso.rotation.y = (combat.elapsed / combat.duration) * Math.PI * 2;
      torso.rotation.z = Math.sin(strike * Math.PI) * 0.2;
      root.scale.y *= 0.9 + Math.sin(strike * Math.PI) * 0.15;
      if (d.joints) {
        d.joints.armLeft.rotation.z = 1.15;
        d.joints.armRight.rotation.z = -1.15;
        d.joints.legLeft.rotation.x = 0.5;
        d.joints.legRight.rotation.x = -0.45;
      }
    } else if (combat.combo === 3) {
      torso.rotation.x = (-charge * 0.2 + snap * 0.6) * recovery;
      torso.position.z = snap * 0.22 * recovery;
      root.scale.y *= 1 - charge * 0.12 + snap * 0.2 * recovery;
      if (d.joints) {
        d.joints.armLeft.rotation.x = (0.7 - snap * 1.7) * recovery;
        d.joints.armRight.rotation.x = (0.7 - snap * 1.7) * recovery;
      }
    } else {
      torso.rotation.y = side * (-charge * 0.65 + snap * 1.5) * recovery;
      torso.rotation.z = side * (charge * 0.1 - snap * 0.22) * recovery;
      torso.position.z = snap * 0.12 * recovery;
      if (d.joints) {
        const lead = combat.combo === 2 ? d.joints.armLeft : d.joints.armRight;
        lead.rotation.x = -0.8 * recovery;
        lead.rotation.z = -side * (0.45 + snap * 0.5) * recovery;
      }
    }
    // All sketches use their complete silhouette as the attack. A dog, dragon,
    // or a drawing with no assigned limbs therefore has the same combat timing.
    if (d.sketch)
      for (const { joint, role, index } of d.pieces) {
        if (role === 'wing') joint.rotation.y += (index % 2 ? -1 : 1) * snap * 0.45 * recovery;
        if (role === 'tail') joint.rotation.z += side * snap * 0.3 * recovery;
      }
  }
  if (combat.hurt > 0) {
    d.state = 'Hurt';
    torso.rotation.x -= combat.hurt * 0.28;
    torso.rotation.z += Math.sin(combat.hurt * Math.PI) * 0.18;
    root.scale.y *= 1 - combat.hurt * 0.12;
  }
}
