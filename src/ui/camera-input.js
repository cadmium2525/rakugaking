export class CameraInput {
  constructor(canvas, view, enabled) {
    this.view = view;
    this.enabled = enabled;
    this.pointer = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (!enabled() || this.pointer !== null) return;
      this.pointer = e.pointerId;
      this.x = e.clientX;
      this.y = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointer) return;
      view.orbit(-(e.clientX - this.x) * 0.007, (e.clientY - this.y) * 0.005);
      this.x = e.clientX;
      this.y = e.clientY;
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      canvas.addEventListener(type, (e) => {
        if (e.pointerId === this.pointer) this.pointer = null;
      });
    window.addEventListener('keydown', (e) => {
      if (!enabled() || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.code === 'KeyQ') view.orbit(0.16, 0);
      if (e.code === 'KeyR') view.orbit(-0.16, 0);
      if (e.code === 'KeyC') view.resetCamera();
    });
    window.addEventListener('blur', () => this.clear());
    window.addEventListener('resize', () => this.clear());
  }
  clear() {
    this.pointer = null;
  }
}
