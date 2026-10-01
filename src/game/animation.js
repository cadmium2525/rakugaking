export function animateCharacter(root, motion, dt) {
  const d = root.userData;
  if (!d.joints) return;
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
