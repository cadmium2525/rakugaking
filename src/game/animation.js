export function animateCharacter(root, motion, dt) {
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
  const squash = (d.land / 0.18) * 0.14;
  root.scale.set(1 + squash * 0.4, 1 - squash, 1 + squash * 0.4);
}
