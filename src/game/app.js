import { Simulation, DT } from '../core/controller.js';
import { prototypePlatforms } from './prototype.js';
import { GameView } from './view.js';
import { Input } from '../ui/input.js';
import { Editor } from '../ui/editor.js';
import { calculateStats, statRows } from '../core/stats.js';
import { defaultDrawing } from '../core/drawing.js';
import { STAGES, getStage } from './stages.js';
import { Course } from '../core/course.js';
import { createStageSelect } from '../ui/stage-select.js';
import { levelFromExp, awardClear, levelStats } from '../core/progression.js';
import { RunTimer, formatTime } from '../core/timer.js';
import { $ } from '../ui/shell.js';
import { sanitizeDrawing } from '../core/shape.js';
import { RankingPanel } from '../ui/ranking-panel.js';
import { Library } from '../ui/library.js';
import { SAVE_VERSION } from '../core/save.js';
import { GAME_VERSION } from '../core/ranking.js';
import { FieldHUD } from '../ui/field-hud.js';
import { Combat } from '../core/combat.js';
import { cameraMovement } from '../core/camera.js';
import { CameraInput } from '../ui/camera-input.js';
import { CombatAudio } from '../ui/combat-audio.js';

export class GameApp {
  constructor(store, data, notice) {
    this.store = store;
    this.player = data.player;
    this.characters = data.characters;
    this.active = data.active;
    this.settings = data.settings;
    this.records = data.records;
    this.legacyRecords = data.legacyRecords || [];
    this.best = data.best;
    const active = this.characters.find((c) => c.id === this.active);
    this.drawing = active?.drawing || defaultDrawing();
    this.name = active?.name || 'らくがきくん';
    this.sim = new Simulation(
      prototypePlatforms,
      undefined,
      levelStats(calculateStats(this.drawing), levelFromExp(this.player.exp)),
    );
    this.course = null;
    this.fieldHUD = new FieldHUD();
    this.run = null;
    this.view = new GameView($('#world'), prototypePlatforms);
    this.view.setStage({
      ...STAGES[0],
      field: false,
      platforms: prototypePlatforms,
      routeLength: 0,
      checkpoints: [],
      collectibles: [],
      goal: { x: 0, y: 0, z: 100 },
    });
    this.view.setQuality(this.settings.quality);
    this.view.setCharacter(this.drawing);
    this.view.setupPractice();
    this.homeCombat = new Combat(this.sim.stats);
    this.homeCombat.facing = { x: 0, z: 1 };
    this.practiceHits = 0;
    this.input = new Input($('#stick'), $('#jump'), $('#action'));
    this.audio = new CombatAudio(this.settings.sound !== false);
    this.cameraInput = new CameraInput($('#world'), this.view, () => !this.paused && !!this.course);
    this.paused = false;
    this.last = performance.now();
    this.accumulator = 0;
    this.actionHeld = false;
    this.elapsed = 0;
    this.editor = new Editor(
      (drawing, name) => this.birth(drawing, name),
      (drawing, angle, part) => this.view.preview(drawing, angle, part),
    );
    $('#quality').value = this.settings.quality;
    $('#quality').onchange = () => {
      this.settings.quality = $('#quality').value;
      this.view.setQuality(this.settings.quality);
      this.save();
    };
    $('#sound').checked = this.settings.sound !== false;
    $('#sound').onchange = () => {
      this.settings.sound = $('#sound').checked;
      this.audio.enabled = this.settings.sound;
      this.audio.unlock();
      this.save();
    };
    $('#camera-reset').onclick = () => this.view.resetCamera();
    $('#game-version').textContent = `v${GAME_VERSION}`;
    $('#world').addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.run?.timer.invalidate('描画が中断したため記録対象外');
      this.pause();
      $('#pause-note').textContent = '描画の接続が切れました。復帰後に再開してください。';
    });
    $('#world').addEventListener('webglcontextrestored', () => {
      $('#pause-note').textContent = '描画が復帰しました。再開できます。';
    });
    this.library = new Library(
      (c) => this.selectCharacter(c),
      (id) => {
        this.characters = this.characters.filter((c) => c.id !== id);
        if (this.active === id) this.selectCharacter(this.characters[0]);
        this.save();
      },
    );
    this.library.dialog.addEventListener('close', () => this.resume());
    $('#library-open').onclick = () => {
      this.paused = true;
      this.input.clear();
      this.library.open(this.characters, this.active);
    };
    this.ranking = new RankingPanel();
    this.ranking.dialog.addEventListener('close', () => this.resume());
    $('#ranking-open').onclick = () => {
      this.paused = true;
      this.input.clear();
      this.ranking.open();
    };
    $('#submit-score').onclick = async () => {
      const button = $('#submit-score');
      button.disabled = true;
      $('#submit-status').textContent = '記録を送信しています…';
      try {
        await this.ranking.submit(this.records.at(-1), $('#player-name').value.trim());
        $('#submit-status').textContent = '登録しました。広場のランキングで確認できます。';
      } catch (error) {
        $('#submit-status').textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
    this.editor.root.addEventListener('close', () => this.resume());
    this.select = createStageSelect(STAGES, (id) => this.startStage(id));
    this.select.addEventListener('close', () => {
      if (this.course?.complete) this.goHome();
      else this.resume();
    });
    $('#draw-open').onclick = () => {
      this.paused = true;
      this.input.clear();
      this.editor.open(this.drawing);
    };
    $('#adventure').onclick = () => this.openStages();
    $('#time-attack').onclick = () => this.startRun();
    $('#pause').onclick = () => this.pause();
    $('#resume').onclick = () => {
      $('#pause-dialog').close();
      this.resume();
    };
    $('#reset').onclick = () => {
      if (this.course) this.course.retry();
      else {
        this.sim.reset();
        this.homeCombat.reset();
        this.view.combatView.reset();
      }
      $('#resume').click();
    };
    $('#home').onclick = () => {
      $('#pause-dialog').close();
      this.goHome();
    };
    $('#pause-dialog').addEventListener('cancel', (e) => {
      e.preventDefault();
      $('#resume').click();
    });
    $('#result').addEventListener('cancel', (e) => e.preventDefault());
    $('#select-next').onclick = () => {
      $('#result').close();
      if (this.run && !this.run.timer.finished) this.startStage(this.run.timer.splits.length + 1);
      else {
        this.run = null;
        this.openStages();
      }
    };
    document.addEventListener('visibilitychange', () => {
      this.input.clear();
      if (document.hidden && this.course && !this.course.complete) {
        this.run?.timer.invalidate('バックグラウンドに移動したため記録対象外');
        this.pause();
      }
    });
    window.addEventListener('resize', () => this.view.resize());
    this.refreshPlayer();
    $('#save-status').textContent = notice || 'この端末に自動保存';
    this.frame = this.frame.bind(this);
    this.lastHud = 0;
    this.ui = { status: $('#status'), run: $('#run-hud'), objective: $('#objective') };
    if (import.meta.env.DEV)
      window.__qa = { state: () => this.state(), reset: () => this.sim.reset() };
    requestAnimationFrame(this.frame);
  }
  refreshPlayer() {
    this.select.refresh(this.player.unlocked, this.player.medals);
    $('#player-level').textContent =
      `PLAYER LV.${levelFromExp(this.player.exp)} · ${this.player.exp} EXP`;
    $('#time-attack').disabled = !this.player.cleared.includes(5);
    $('#time-attack').textContent = this.player.cleared.includes(5)
      ? 'ALL STAGES TIME ATTACK →'
      : 'TIME ATTACK · 5ステージクリアで解放';
  }
  birth(drawing, name) {
    if (this.characters.length >= 24) {
      this.editor.root.querySelector('#editor-feedback').textContent =
        '24体まで保存できます。なかま一覧で不要なキャラクターを削除してください。';
      return;
    }
    const character = {
      id: crypto.randomUUID(),
      drawing: sanitizeDrawing(drawing),
      name,
      stats: calculateStats(drawing),
    };
    this.characters.push(character);
    this.selectCharacter(character);
    this.editor.root.close();
    this.sim.reset();
    this.view.celebrate();
    $('#birth-banner').hidden = false;
    clearTimeout(this.birthBannerTimeout);
    this.birthBannerTimeout = setTimeout(() => ($('#birth-banner').hidden = true), 1400);
    $('.intro h1').innerHTML = 'ヒーローが、<br>うまれた。';
    $('.intro>p:not(.eyebrow)').textContent = `${name}と、一緒に冒険へ。`;
    $('.pill').textContent = statRows(this.sim.stats)
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ');
  }
  selectCharacter(character) {
    this.active = character.id;
    this.drawing = character.drawing;
    this.name = character.name;
    this.view.setCharacter(this.drawing);
    if (!this.course && this.homeCombat) {
      this.homeCombat.reset();
      this.homeCombat.facing = { x: 0, z: 1 };
      this.view.combatView.reset();
    }
    this.sim.stats = levelStats(calculateStats(this.drawing), levelFromExp(this.player.exp));
    this.homeCombat.stats = this.sim.stats;
    this.save();
  }
  async save() {
    const data = {
      version: SAVE_VERSION,
      player: this.player,
      characters: this.characters,
      active: this.active,
      records: this.records.slice(-20),
      legacyRecords: this.legacyRecords,
      best: this.best,
      settings: this.settings,
    };
    $('#save-status').textContent = '保存しています…';
    try {
      const result = await this.store.save(data);
      $('#save-status').textContent = result;
      return result.startsWith('この端末に保存しました');
    } catch (error) {
      $('#save-status').textContent = `保存できません: ${error.message}`;
      return false;
    }
  }
  openStages() {
    this.paused = true;
    this.input.clear();
    this.select.showModal();
  }
  startRun() {
    if (!this.player.cleared.includes(5)) return;
    const drawing = sanitizeDrawing(this.drawing);
    this.run = {
      timer: new RunTimer(),
      drawing,
      stats: levelStats(calculateStats(drawing), levelFromExp(this.player.exp)),
      name: this.name,
      level: levelFromExp(this.player.exp),
    };
    this.startStage(1);
  }
  startStage(id) {
    if (!this.run && id > this.player.unlocked) return;
    this.sim.dispose();
    this.course = new Course(
      getStage(id),
      this.run?.stats || levelStats(calculateStats(this.drawing), levelFromExp(this.player.exp)),
    );
    this.sim = this.course.sim;
    this.view.setStage(this.course.stage);
    this.view.setCharacter(this.run?.drawing || this.drawing);
    this.accumulator = 0;
    this.input.clear();
    this.resume();
    document.body.classList.add('playing');
    document.body.classList.toggle('field-playing', !!this.course.field);
    $('.stage-label').textContent = `0${id} / ${this.course.stage.name}`;
    $('footer').textContent = this.course.stage.hint;
    $('#run-hud').hidden = !this.run;
    this.run?.timer.startStage(id);
  }
  goHome() {
    this.run = null;
    this.course = null;
    this.sim.dispose();
    this.sim = new Simulation(
      prototypePlatforms,
      undefined,
      levelStats(calculateStats(this.drawing), levelFromExp(this.player.exp)),
    );
    this.view.setStage({
      ...STAGES[0],
      field: false,
      platforms: prototypePlatforms,
      routeLength: 0,
      checkpoints: [],
      collectibles: [],
      goal: { x: 0, y: 0, z: 100 },
    });
    this.view.setCharacter(this.drawing);
    this.view.setupPractice();
    this.homeCombat = new Combat(this.sim.stats);
    this.homeCombat.facing = { x: 0, z: 1 };
    document.body.classList.remove('playing');
    document.body.classList.remove('field-playing');
    $('.stage-label').textContent = 'PLAYGROUND / はじまりの広場';
    $('#run-hud').hidden = true;
    this.resume();
  }
  pause() {
    this.paused = true;
    this.input.clear();
    this.cameraInput.clear();
    $('#pause-note').textContent = this.run ? 'タイムアタックの時計は一時停止中も進みます。' : '';
    if (!document.querySelector('dialog[open]')) $('#pause-dialog').showModal();
  }
  resume() {
    this.paused = false;
    this.last = performance.now();
    this.accumulator = 0;
  }
  finish() {
    this.paused = true;
    this.input.clear();
    const gained = awardClear(this.player, this.course.stage.id);
    const totalStars = this.course.stage.collectibles?.length || 0;
    const medal =
      this.course.collected.size >= totalStars
        ? 3
        : this.course.collected.size >= Math.ceil(totalStars * 0.5)
          ? 2
          : 1;
    this.player.medals ||= {};
    this.player.medals[this.course.stage.id] = Math.max(
      medal,
      this.player.medals[this.course.stage.id] || 0,
    );
    this.refreshPlayer();
    let time = this.course.elapsed;
    if (this.run) {
      time = this.run.timer.endStage(this.course.stage.id);
      if (this.run.timer.finished) {
        const record = {
          id: crypto.randomUUID(),
          version: GAME_VERSION,
          character: this.run.name,
          level: this.run.level,
          stats: this.run.stats,
          drawing: this.run.drawing,
          splits: [...this.run.timer.splits],
          total: this.run.timer.total(),
          valid: this.run.timer.valid,
          reason: this.run.timer.reason,
        };
        this.records.push(record);
        if (record.valid && (this.best === null || record.total < this.best))
          this.best = record.total;
      }
    }
    $('#result-title').textContent = this.run?.timer.finished
      ? '5つの世界を、きみの形で。'
      : 'ステージクリア！';
    $('#clear-time').textContent =
      `${this.run?.timer.finished ? 'TOTAL ' + formatTime(this.run.timer.total()) + ' / ' : ''}${formatTime(time)} · 落下 ${this.sim.deaths} 回 · +${gained} EXP`;
    $('#splits').textContent = this.run
      ? this.run.timer.splits.map((t, i) => `STAGE ${i + 1}  ${formatTime(t)}`).join(' / ') +
        (this.run.timer.valid ? '' : ` / ${this.run.timer.reason}`)
      : `${'★'.repeat(medal)}${'☆'.repeat(3 - medal)} · 星のかけら ${this.course.collected.size}/${totalStars} · 半分で★★ / 全部で★★★`;
    $('#select-next').textContent =
      this.run && !this.run.timer.finished ? '次のステージへ →' : 'ステージを選ぶ →';
    $('#result').showModal();
    $('#ranking-submit').hidden = !this.run?.timer.finished || !this.run?.timer.valid;
    $('#submit-status').textContent = '';
    this.save();
  }
  frame(now) {
    const delta = Math.max(0, Math.min((now - this.last) / 1000, 0.1));
    this.last = now;
    if (!this.paused) {
      this.accumulator += delta;
      while (this.accumulator >= DT) {
        const controls = cameraMovement(this.input.read(), this.course ? this.view.cameraHeading : 0);
        this.actionHeld = controls.action;
        if (!this.course) {
          this.homeCombat.update(controls, DT, {
            position: this.sim.position,
            grounded: this.sim.grounded && !(controls.jump && !this.sim.jumpHeld),
            targets: [{ key: 'practice', x: 0, y: 0.8, z: -2.8, radius: 0.7 }],
          });
        }
        const event = this.course
          ? this.course.step(controls)
          : this.sim.step(controls, this.homeCombat.motion);
        if (!this.course) {
          this.homeCombat.position = { ...this.sim.position };
          if (this.homeCombat.hit('practice', { x: 0, y: 0.8, z: -2.8 }, { radius: 0.7 }))
            this.practiceHits++;
        }
        this.accumulator -= DT;
        this.elapsed += DT;
        if (event === 'complete') {
          this.finish();
          break;
        }
      }
    } else this.accumulator = 0;
    const combat = this.course?.combat || this.homeCombat;
    if (this.course) {
      this.view.updateCourse(this.course);
      this.view.combatView.update(this.course, this.paused ? 0 : delta, this.view.fieldView);
    } else this.view.updatePractice(this.sim, combat, this.paused ? 0 : delta);
    this.audio.update(combat);
    this.view.render(this.sim, this.paused ? 0 : delta);
    if (now - this.lastHud > 100) {
      this.fieldHUD.update(this.course, this.view.cameraHeading);
      this.lastHud = now;
      this.ui.status.textContent = `${this.course ? `HP ${Math.ceil(this.course.hp)} · ` : ''}${this.sim.grounded ? '● ON GROUND' : '↑ IN THE AIR'} · ${Math.hypot(this.sim.vx, this.sim.vz).toFixed(1)} m/s`;
      if (this.run)
        this.ui.run.textContent = `STAGE ${formatTime(this.run.timer.stageTime())} · TOTAL ${formatTime(this.run.timer.total())} · BEST ${formatTime(this.best)}${this.run.timer.valid ? '' : ' · 記録対象外'}`;
      this.ui.objective.textContent = '';
      const action = combat.snapshot();
      $('#combat-hud').textContent = action.attacking
        ? `${action.airborne ? '空中' : ['● ○ ○', '● ● ○', '● ● ●'][action.combo - 1]} · ${action.name}${action.buffered ? ' · 次の一撃' : ''}`
        : this.course
          ? 'リズムよくACTIONで3連撃 · 空中ではスピン'
          : 'ACTIONで練習 · リズムよく押すと3連撃';
      $('#vitals').hidden = !this.course;
      if (this.course) {
        $('#health').value = this.course.hp;
        $('#health').max = this.sim.stats.hp || 100;
        $('#health-label').textContent =
          `HP ${Math.ceil(this.course.hp)}/${this.sim.stats.hp || 100}`;
      }
      if (this.course && !this.course.complete) {
        const p = this.sim.position,
          g = this.course.stage.goal;
        this.ui.objective.textContent =
          !this.course.field && Math.hypot(p.x - g.x, p.z - g.z) < 2.7 && !this.course.activated
            ? `ACTIONで封印を解こう · ${Math.max(0, Math.ceil(this.course.sealHP))}`
            : this.course.guidance() ||
              (this.course.elapsed < 4
                ? this.course.stage.hint
                : `${this.course.stage.zones?.[Math.min(2, Math.floor((Math.max(0, -p.z) / Math.abs(g.z)) * 3))] || ''} · ✦ ${this.course.collected.size}/${this.course.stage.collectibles?.length || 0}${this.course.checkpoint >= 0 ? ' · 復帰地点を記録' : ''}`);
      }
    }
    requestAnimationFrame(this.frame);
  }
  state() {
    return {
      position: { ...this.sim.position },
      grounded: this.sim.grounded,
      jumps: this.sim.jumps,
      deaths: this.sim.deaths,
      paused: this.paused,
      elapsed: this.elapsed,
      stage: this.course?.stage.id,
      complete: this.course?.complete,
      collected: this.course?.collected.size,
      checkpoint: this.course?.checkpoint,
      field: this.course?.field?.snapshot(),
      combat: (this.course?.combat || this.homeCombat).snapshot(),
      combatEvents: (this.course?.combat || this.homeCombat).events.map((e) => ({ ...e })),
      practiceHits: this.practiceHits,
      camera: {
        yaw: this.view.cameraHeading,
        intentYaw: this.view.cameraYaw,
        pitch: this.view.cameraPitch,
        position: {
          x: this.view.camera.position.x,
          y: this.view.camera.position.y,
          z: this.view.camera.position.z,
        },
      },
      version: GAME_VERSION,
      exp: this.player.exp,
      characters: this.characters.length,
      name: this.name,
      run: this.run
        ? {
            splits: [...this.run.timer.splits],
            total: this.run.timer.total(),
            valid: this.run.timer.valid,
            level: this.run.level,
            stats: this.run.stats,
          }
        : null,
      best: this.best,
      records: this.records.length,
      calls: this.view.renderer.info.render.calls,
      triangles: this.view.renderer.info.render.triangles,
      geometries: this.view.renderer.info.memory.geometries,
      quality: this.settings.quality,
      resolution: {
        width: this.view.renderer.domElement.width,
        height: this.view.renderer.domElement.height,
      },
    };
  }
}
