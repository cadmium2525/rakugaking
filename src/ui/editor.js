import { PARTS, LABELS, COLORS, DrawingHistory, defaultDrawing, copy } from '../core/drawing.js';
export class Editor {
  constructor(onBirth, onPreview) {
    this.history = new DrawingHistory();
    this.part = 'body';
    this.color = COLORS[0];
    this.eraser = false;
    this.stroke = null;
    this.pointer = null;
    this.onBirth = onBirth;
    this.onPreview = onPreview;
    this.previewAngle = 0;
    this.previewRevision = 0;
    this.root = document.createElement('dialog');
    this.root.className = 'editor';
    this.root.innerHTML = `<div class="editor-heading"><div><p class="eyebrow">DRAW YOUR OWN HERO</p><h2>線から、いのちが生まれる。</h2></div><button data-do="close" aria-label="エディタを閉じる">×</button></div><div class="editor-layout"><nav class="parts">${PARTS.map((p) => `<button data-part="${p}">${LABELS[p]}</button>`).join('')}</nav><div class="drawing-area"><p id="drawing-prompt">からだを描こう</p><canvas width="480" height="480" aria-label="ラクガキキャンバス"></canvas><small>指で輪郭を描いてね。線は自動でつながるよ。</small></div><div class="editor-tools"><div class="swatches">${COLORS.map((c) => `<button data-color="${c}" style="--swatch:${c}" aria-label="色 ${c}"></button>`).join('')}</div><div class="tool-grid"><button data-do="undo">↶ 戻す</button><button data-do="redo">↷ 進む</button><button data-do="erase">消しゴム</button><button data-do="clear">パーツ消去</button><button data-do="copy">左右コピー</button><button data-do="reset">やり直し</button></div><p class="editor-tip">どんなかたちも、きみの個性。<br>うまく描けなくても大丈夫。</p><label class="name-label">キャラクターの名前<input id="character-name" maxlength="20" value="らくがきくん" autocomplete="off"></label><button class="primary" data-do="birth">誕生させる ✦</button><p id="editor-feedback" role="status"></p></div></div>`;
    document.body.append(this.root);
    this.canvas = this.root.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.assembly = document.createElement('section');
    this.assembly.className = 'assembly';
    this.assembly.innerHTML =
      '<p class="assembly-title">できあがりを見ながら描こう</p><img alt="組み立て中のキャラクター" draggable="false"><div class="assembly-angles"><button data-angle="0">正面</button><button data-angle="0.65">斜め</button><button data-angle="1.57">横</button></div><p class="assembly-note">オレンジ枠が編集中のパーツ。描くたびに完成形も変わります。</p>';
    this.root.querySelector('.drawing-area').after(this.assembly);
    this.previewPanel = document.createElement('div');
    this.previewPanel.className = 'preview-panel';
    this.previewPanel.hidden = true;
    this.previewPanel.innerHTML =
      '<img alt="ラクガキの3Dプレビュー"><button data-do="back-to-drawing">線に戻る</button>';
    this.root.querySelector('.drawing-area').append(this.previewPanel);
    const previewButton = document.createElement('button');
    previewButton.dataset.do = 'preview';
    previewButton.textContent = '3Dプレビュー';
    this.root
      .querySelector('.editor-tools')
      .insertBefore(previewButton, this.root.querySelector('[data-do="birth"]'));
    this.root.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;
      if (button.dataset.part) {
        this.finish();
        this.part = button.dataset.part;
      }
      if (button.dataset.color) {
        this.color = button.dataset.color;
        this.eraser = false;
      }
      const op = button.dataset.do;
      if (button.dataset.angle !== undefined) this.previewAngle = Number(button.dataset.angle);
      if (op === 'preview') {
        this.finish();
        this.previewPanel.querySelector('img').src = onPreview(this.history.data);
        this.previewPanel.hidden = false;
      } else this.previewPanel.hidden = true;
      if (op === 'undo') this.history.undo();
      if (op === 'redo') this.history.redo();
      if (op === 'erase') this.eraser = !this.eraser;
      if (op === 'clear') this.history.change((d) => (d[this.part] = []));
      if (op === 'reset')
        this.history.change((d) => {
          for (const p of PARTS) d[p] = [];
        });
      if (op === 'copy') {
        const target = this.part.replace('Left', 'Right');
        if (target !== this.part)
          this.history.change(
            (d) =>
              (d[target] = d[this.part].map((s) => ({
                ...copy(s),
                points: s.points.map((p) => ({ x: 1 - p.x, y: p.y })),
              }))),
          );
        else
          this.root.querySelector('#editor-feedback').textContent =
            '左うで・左あしを選ぶと、右側へコピーできます。';
      }
      if (op === 'close') this.root.close();
      if (op === 'birth') {
        this.finish();
        this.onBirth(
          copy(this.history.data),
          this.root.querySelector('input').value.trim() || 'ななしのラクガキ',
        );
      }
      this.render();
    });
    const point = (e) => {
      const r = this.canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
        y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
      };
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.pointer !== null) return;
      this.pointer = e.pointerId;
      this.canvas.setPointerCapture(e.pointerId);
      const p = point(e);
      if (this.eraser) {
        this.history.change(() => this.eraseAt(p));
      } else this.stroke = { color: this.color, points: [p] };
      this.render();
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointer) return;
      if (this.eraser) {
        this.eraseAt(point(e));
        this.render();
        return;
      }
      if (!this.stroke) return;
      const samples = e.getCoalescedEvents?.();
      for (const sample of samples?.length ? samples : [e]) {
        const p = point(sample),
          last = this.stroke.points.at(-1);
        if (Math.hypot(p.x - last.x, p.y - last.y) > 0.004 && this.stroke.points.length < 512)
          this.stroke.points.push(p);
      }
      this.render();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      this.canvas.addEventListener(type, (e) => {
        if (e.pointerId === this.pointer) this.finish();
      });
  }
  eraseAt(point) {
    this.history.data[this.part] = this.history.data[this.part].filter((stroke) => {
      if (stroke.points.some((p) => Math.hypot(p.x - point.x, p.y - point.y) < 0.08)) return false;
      let inside = false;
      const points = stroke.points;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i],
          b = points[j];
        if (
          a.y > point.y !== b.y > point.y &&
          point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
        )
          inside = !inside;
      }
      return !inside;
    });
  }
  finish() {
    if (this.stroke) {
      const stroke = this.stroke;
      this.history.change((d) => {
        if (d[this.part].length >= 24) d[this.part].shift();
        d[this.part].push(stroke);
      });
    }
    this.stroke = null;
    this.pointer = null;
    this.render();
  }
  open(drawing) {
    this.previewPanel.hidden = true;
    if (drawing) this.history = new DrawingHistory(drawing);
    this.root.showModal();
    this.render();
  }
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 480, 480);
    ctx.strokeStyle = '#dfdfd2';
    ctx.lineWidth = 1;
    for (let n = 24; n < 480; n += 24) {
      ctx.beginPath();
      ctx.moveTo(n, 0);
      ctx.lineTo(n, 480);
      ctx.moveTo(0, n);
      ctx.lineTo(480, n);
      ctx.stroke();
    }
    // Connection reference uses the same normalized part coordinates as the mesh builder.
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = '#e9a28a';
    ctx.beginPath();
    ctx.moveTo(240, 0);
    ctx.lineTo(240, 480);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const s of [...this.history.data[this.part], ...(this.stroke ? [this.stroke] : [])]) {
      ctx.beginPath();
      s.points.forEach((p, i) =>
        i ? ctx.lineTo(p.x * 480, p.y * 480) : ctx.moveTo(p.x * 480, p.y * 480),
      );
      if (s.points.length === 1)
        ctx.arc(s.points[0].x * 480, s.points[0].y * 480, 6, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    this.root.querySelector('#drawing-prompt').textContent = `${LABELS[this.part]}を描こう`;
    for (const b of this.root.querySelectorAll('[data-part]'))
      b.classList.toggle('selected', b.dataset.part === this.part);
    for (const b of this.root.querySelectorAll('[data-color]'))
      b.classList.toggle('selected', b.dataset.color === this.color);
    this.root.querySelector('[data-do="erase"]').classList.toggle('selected', this.eraser);
    this.root.querySelector('[data-do="undo"]').disabled = !this.history.undoStack.length;
    this.root.querySelector('[data-do="redo"]').disabled = !this.history.redoStack.length;
    this.queuePreview();
  }
  queuePreview() {
    if (!this.root.open || this.previewPending) return;
    this.previewPending = setTimeout(() => {
      this.previewPending = null;
      if (!this.root.open) return;
      const drawing = this.stroke ? copy(this.history.data) : this.history.data;
      if (this.stroke) drawing[this.part].push(copy(this.stroke));
      this.assembly.querySelector('img').src = this.onPreview(
        drawing,
        this.previewAngle,
        this.part,
      );
      this.assembly.dataset.revision = ++this.previewRevision;
      for (const b of this.assembly.querySelectorAll('[data-angle]'))
        b.classList.toggle('selected', Number(b.dataset.angle) === this.previewAngle);
    }, 100);
  }
  reset() {
    this.history = new DrawingHistory(defaultDrawing());
    this.render();
  }
}
