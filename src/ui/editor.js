import { DrawingHistory, copy } from '../core/drawing.js';
import { sanitizeDrawing } from '../core/shape.js';
import {
  INKS,
  ROLES,
  SKETCH_LIMIT,
  legacyToSketch,
  sketchTemplate,
  sanitizeSketch,
  hitStroke,
  eraseSketch,
  sketchBounds,
} from '../core/sketch.js';
export class Editor {
  constructor(onBirth, onPreview) {
    Object.assign(this, {
      onBirth,
      onPreview,
      history: new DrawingHistory(sketchTemplate('blank')),
      color: INKS[0],
      width: 0.018,
      depth: 0.2,
      role: 'body',
      tool: 'pen',
      selected: -1,
      pointer: null,
      stroke: null,
      previewAngle: 0.35,
      previewRevision: 0,
    });
    this.root = document.createElement('dialog');
    this.root.className = 'editor sketch-editor';
    this.root.innerHTML = `<div class="editor-heading"><div><p class="eyebrow">ONE CANVAS · ANY CREATURE</p><h2>全身を、ひとつの紙に。</h2></div><button data-do="close" aria-label="エディタを閉じる">×</button></div>
      <div class="sketch-presets"><label>下絵 <select aria-label="下絵"><option value="">選んで描きかえる</option><option value="blank">白紙から自由に</option><option value="human">ひと</option><option value="dog">犬</option><option value="dragon">ドラゴン</option></select></label><span>切替も「戻す」で元に戻せます</span></div>
      <div class="sketch-grid"><div class="sketch-main"><div class="sketch-toolbar" role="group" aria-label="描画道具"><button data-tool="pen">ペン</button><button data-tool="fill">面</button><button data-tool="select">選択・移動</button><button data-tool="erase">消しゴム</button><button data-do="undo" aria-label="↶ 戻す">↶</button><button data-do="redo" aria-label="↷ 進む">↷</button></div>
      <div class="sketch-workspace"><div class="drawing-area"><canvas width="640" height="640" aria-label="ラクガキキャンバス"></canvas><small id="drawing-prompt">ペンは線を閉じません。面ツールだけ輪郭を閉じます。</small></div>
      <section class="assembly"><p class="assembly-title">そのまま立体に</p><img alt="組み立て中のキャラクター" draggable="false"><div class="assembly-angles"><button data-angle="0">正面</button><button data-angle="0.65">斜め</button><button data-angle="1.57">横</button></div></section></div></div>
      <aside class="editor-tools"><div class="ink-heading"><strong>色は自由に</strong><label>カスタム色<input type="color" aria-label="自由な色" value="${this.color}"></label></div><div class="swatches">${INKS.map((c) => `<button data-color="${c}" style="--swatch:${c}" aria-label="色 ${c}"></button>`).join('')}</div>
      <div class="sketch-properties"><label>線の太さ<input data-prop="width" aria-label="線の太さ" type="range" min="0.004" max="0.16" step="0.002" value="${this.width}"></label><label>立体の厚み<input data-prop="depth" aria-label="立体の厚み" type="range" min="0.03" max="0.5" step="0.01" value="${this.depth}"></label><label>この線・面の動き<select aria-label="この線・面の動き">${Object.entries(
        ROLES,
      )
        .map(([v, label]) => `<option value="${v}">${label}</option>`)
        .join('')}</select></label></div>
      <div class="selection-tools"><p data-selection>選択・移動で、線や面をつかんで配置</p><div class="tool-grid"><button data-do="smaller">縮小</button><button data-do="bigger">拡大</button><button data-do="rotate">回転 ↻</button><button data-do="flip">左右反転</button><button data-do="copy">複製</button><button data-do="delete">選択を削除</button></div></div>
      <p class="editor-tip">犬も、羽のある生き物も。足・翼・しっぽは好きな本数に。<br>描いた絵に厚みをつけた立体になります。</p>
      <label class="name-label">キャラクターの名前<input id="character-name" maxlength="20" value="らくがきくん" autocomplete="off"></label><button data-do="preview">大きく3Dを見る</button><button class="primary" data-do="birth">誕生させる ✦</button><p id="editor-feedback" role="status"></p></aside></div>`;
    document.body.append(this.root);
    this.canvas = this.root.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.assembly = this.root.querySelector('.assembly');
    this.previewPanel = document.createElement('div');
    this.previewPanel.className = 'preview-panel';
    this.previewPanel.hidden = true;
    this.previewPanel.innerHTML =
      '<img alt="ラクガキの3Dプレビュー"><button data-do="back-to-drawing">線に戻る</button>';
    this.root.querySelector('.drawing-area').append(this.previewPanel);
    this.root.addEventListener('click', (e) => this.click(e));
    this.root.querySelector('[aria-label="下絵"]').addEventListener('change', (e) => {
      if (!e.target.value) return;
      this.finish();
      const d = sketchTemplate(e.target.value);
      this.history.change((old) => {
        old.strokes = d.strokes;
      });
      this.selected = -1;
      this.feedback('下絵に描き足したり、選択・移動で組みかえられます。');
      this.render();
      e.target.value = '';
    });
    this.root.querySelector('[type="color"]').addEventListener('input', (e) => {
      this.color = e.target.value;
      this.render();
    });
    this.root
      .querySelector('[type="color"]')
      .addEventListener('change', () => this.applyProperty('color', this.color));
    for (const el of this.root.querySelectorAll('[data-prop]')) {
      el.addEventListener('input', () => {
        this[el.dataset.prop] = Number(el.value);
      });
      el.addEventListener('change', () => this.applyProperty(el.dataset.prop, Number(el.value)));
    }
    this.root.querySelector('[aria-label="この線・面の動き"]').addEventListener('change', (e) => {
      this.role = e.target.value;
      this.applyProperty('role', this.role);
    });
    this.canvas.addEventListener('pointerdown', (e) => this.down(e));
    this.canvas.addEventListener('pointermove', (e) => this.move(e));
    this.canvas.addEventListener('pointerup', (e) => {
      if (e.pointerId === this.pointer) this.finish();
    });
    for (const event of ['pointercancel', 'lostpointercapture'])
      this.canvas.addEventListener(event, (e) => {
        if (e.pointerId === this.pointer) {
          this.stroke = null;
          this.finish();
        }
      });
    this.root.addEventListener('close', () => {
      this.stroke = null;
      this.pointer = null;
      clearTimeout(this.previewPending);
      this.previewPending = null;
    });
    this.root.addEventListener('keydown', (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'z' &&
        !['INPUT', 'SELECT'].includes(e.target.tagName)
      ) {
        e.preventDefault();
        this.finish();
        if (e.shiftKey) this.history.redo();
        else this.history.undo();
        this.selected = -1;
        this.render();
      }
    });
    window.addEventListener('resize', () => {
      if (this.pointer !== null) {
        this.stroke = null;
        this.finish();
      }
    });
  }
  feedback(text) {
    this.root.querySelector('#editor-feedback').textContent = text;
  }
  applyProperty(key, value) {
    if (this.selected >= 0 && this.history.data.strokes[this.selected])
      this.history.change((d) => {
        d.strokes[this.selected][key] = value;
      });
    this.render();
  }
  click(e) {
    const b = e.target.closest('button');
    if (!b) return;
    this.finish();
    if (b.dataset.tool) {
      this.tool = b.dataset.tool;
      this.selected = -1;
    }
    if (b.dataset.color) {
      this.color = b.dataset.color;
      this.applyProperty('color', this.color);
    }
    if (b.dataset.angle !== undefined) this.previewAngle = Number(b.dataset.angle);
    const op = b.dataset.do;
    this.previewPanel.hidden = op !== 'preview';
    if (op === 'close') {
      this.root.close();
      return;
    }
    if (op === 'undo' || op === 'redo') {
      this.history[op]();
      this.selected = -1;
    }
    if (op === 'preview') {
      this.previewPanel.querySelector('img').src = this.onPreview(
        this.history.data,
        this.previewAngle,
      );
      this.previewPanel.hidden = false;
    }
    if (op === 'birth') {
      const d = sanitizeSketch(this.history.data);
      if (!d.strokes.length) {
        this.feedback('線や面を描いてから誕生させてください。');
        return;
      }
      this.onBirth(
        d,
        this.root.querySelector('#character-name').value.trim() || 'ななしのラクガキ',
      );
    }
    if (
      ['smaller', 'bigger', 'rotate', 'flip', 'copy', 'delete'].includes(op) &&
      this.selected >= 0
    ) {
      if (op === 'copy' && this.history.data.strokes.length >= SKETCH_LIMIT) {
        this.feedback('線と面は96個まで。不要なものを消してから複製してください。');
        return;
      }
      this.history.change((d) => {
        const s = d.strokes[this.selected];
        if (!s) return;
        if (op === 'delete') {
          d.strokes.splice(this.selected, 1);
          this.selected = -1;
          return;
        }
        if (op === 'copy') {
          const s2 = copy(s);
          s2.points = s2.points.map((p) => ({
            x: Math.min(0.99, p.x + 0.025),
            y: Math.min(0.99, p.y + 0.025),
          }));
          d.strokes.push(s2);
          this.selected = d.strokes.length - 1;
          return;
        }
        const b = sketchBounds(s.points),
          cx = (b.minX + b.maxX) / 2,
          cy = (b.minY + b.maxY) / 2,
          a = op === 'rotate' ? Math.PI / 12 : 0,
          scale = op === 'bigger' ? 1.12 : op === 'smaller' ? 1 / 1.12 : 1;
        const pts = s.points.map((p) => {
          const x = (p.x - cx) * (op === 'flip' ? -1 : 1) * scale,
            y = (p.y - cy) * scale;
          return {
            x: cx + x * Math.cos(a) - y * Math.sin(a),
            y: cy + x * Math.sin(a) + y * Math.cos(a),
          };
        });
        if (pts.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)) s.points = pts;
        else this.feedback('紙からはみ出します。中央へ移動してから試してください。');
      });
    }
    this.render();
  }
  point(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  }
  down(e) {
    if (this.pointer !== null) return;
    this.pointer = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.point(e);
    if (this.tool === 'select') {
      this.selected = this.history.data.strokes.findLastIndex((s) => hitStroke(s, p));
      if (this.selected >= 0) {
        this.history.change(() => {});
        this.drag = { start: p, stroke: copy(this.history.data.strokes[this.selected]) };
        const s = this.drag.stroke;
        this.color = s.color;
        this.width = s.width;
        this.depth = s.depth;
        this.role = s.role;
      }
    } else if (this.tool === 'erase') {
      this.selected = -1;
      this.history.change((d) => this.erase(d, p));
    } else if (this.history.data.strokes.length >= SKETCH_LIMIT)
      this.feedback('線と面は96個まで。消しゴムや選択削除で整理できます。');
    else {
      this.selected = -1;
      this.stroke = {
        color: this.color,
        width: this.width,
        depth: this.depth,
        role: this.role,
        closed: this.tool === 'fill',
        points: [p],
      };
    }
    this.render();
  }
  move(e) {
    if (e.pointerId !== this.pointer) return;
    const p = this.point(e);
    if (this.tool === 'erase') {
      this.erase(this.history.data, p);
      this.render();
      return;
    }
    if (this.drag) {
      const b = sketchBounds(this.drag.stroke.points),
        dx = Math.max(-b.minX, Math.min(1 - b.maxX, p.x - this.drag.start.x)),
        dy = Math.max(-b.minY, Math.min(1 - b.maxY, p.y - this.drag.start.y));
      this.history.data.strokes[this.selected].points = this.drag.stroke.points.map((q) => ({
        x: q.x + dx,
        y: q.y + dy,
      }));
      this.render();
      return;
    }
    if (!this.stroke) return;
    const samples = e.getCoalescedEvents?.();
    for (const sample of samples?.length ? samples : [e]) {
      const q = this.point(sample),
        last = this.stroke.points.at(-1);
      if (Math.hypot(q.x - last.x, q.y - last.y) > 0.002 && this.stroke.points.length < 2048)
        this.stroke.points.push(q);
    }
    this.render();
  }
  finish() {
    if (this.stroke) {
      const s = this.stroke;
      this.history.change((d) => d.strokes.push(s));
    }
    this.stroke = null;
    this.drag = null;
    this.pointer = null;
    this.render();
  }
  open(drawing) {
    this.previewPanel.hidden = true;
    this.selected = -1;
    this.tool = 'pen';
    const source = JSON.stringify(drawing);
    if (drawing && source !== this.source) {
      this.history = new DrawingHistory(legacyToSketch(sanitizeDrawing(drawing)));
      this.source = source;
    }
    this.root.showModal();
    this.render();
    this.root.scrollTop = 0;
    this.root.querySelector('.editor-tools').scrollTop = 0;
  }
  erase(drawing, point) {
    if (!eraseSketch(drawing, point))
      this.feedback('線が96個を超えます。選択を削除で整理してから部分消去してください。');
  }
  render() {
    if (!this.ctx) return;
    const ctx = this.ctx,
      size = 640;
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = '#e7e8de';
    ctx.lineWidth = 1;
    for (let n = 32; n < size; n += 32) {
      ctx.beginPath();
      ctx.moveTo(n, 0);
      ctx.lineTo(n, size);
      ctx.moveTo(0, n);
      ctx.lineTo(size, n);
      ctx.stroke();
    }
    for (const s of [...this.history.data.strokes, ...(this.stroke ? [this.stroke] : [])]) {
      ctx.beginPath();
      s.points.forEach((p, i) =>
        i ? ctx.lineTo(p.x * size, p.y * size) : ctx.moveTo(p.x * size, p.y * size),
      );
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = s.width * size;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (s.points.length === 1) {
        ctx.arc(s.points[0].x * size, s.points[0].y * size, (s.width * size) / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.closed) {
        ctx.closePath();
        ctx.fill();
      } else ctx.stroke();
    }
    const selected = this.history.data.strokes[this.selected];
    if (selected) {
      const b = sketchBounds(selected.points);
      ctx.strokeStyle = '#e88258';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 5]);
      ctx.strokeRect(
        b.minX * size - 7,
        b.minY * size - 7,
        (b.maxX - b.minX) * size + 14,
        (b.maxY - b.minY) * size + 14,
      );
      ctx.setLineDash([]);
    }
    this.root.querySelector('[data-selection]').textContent = selected
      ? `選択中: ${selected.closed ? '面' : '線'} · ${ROLES[selected.role]} / ドラッグで移動`
      : '選択・移動で、線や面をつかんで配置';
    this.root.querySelector('#drawing-prompt').textContent =
      this.tool === 'erase'
        ? '線はなぞった部分を消去。面はまとめて消去します。'
        : this.tool === 'select'
          ? '全身のどこでも選んで移動。色・太さ・動きも変更できます。'
          : 'ペンは線を閉じません。面ツールだけ輪郭を閉じます。';
    for (const b of this.root.querySelectorAll('[data-tool]'))
      b.setAttribute('aria-pressed', String(b.dataset.tool === this.tool));
    for (const b of this.root.querySelectorAll('[data-color]'))
      b.classList.toggle('selected', b.dataset.color === this.color);
    for (const b of this.root.querySelectorAll('.selection-tools button')) b.disabled = !selected;
    for (const key of ['width', 'depth'])
      this.root.querySelector(`[data-prop="${key}"]`).value = this[key];
    this.root.querySelector('[type="color"]').value = this.color;
    this.root.querySelector('[aria-label="この線・面の動き"]').value = this.role;
    this.root.querySelector('[data-do="undo"]').disabled = !this.history.undoStack.length;
    this.root.querySelector('[data-do="redo"]').disabled = !this.history.redoStack.length;
    this.root.querySelector('[data-do="birth"]').disabled = !this.history.data.strokes.length;
    this.queuePreview();
  }
  queuePreview() {
    if (!this.root.open || this.previewPending) return;
    this.previewPending = setTimeout(() => {
      this.previewPending = null;
      if (!this.root.open) return;
      const d = copy(this.history.data);
      if (this.stroke) d.strokes.push(copy(this.stroke));
      this.assembly.querySelector('img').src = this.onPreview(d, this.previewAngle);
      this.assembly.dataset.revision = ++this.previewRevision;
    }, 120);
  }
  reset() {
    this.history = new DrawingHistory(sketchTemplate('blank'));
    this.selected = -1;
    this.render();
  }
}
