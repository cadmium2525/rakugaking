export function createStageSelect(stages, onSelect) {
  const dialog = document.createElement('dialog');
  dialog.className = 'stage-select';
  dialog.innerHTML = `<p class="eyebrow">A WORLD MADE FOR YOU</p><h2>次は、どこへ行こう？</h2><div class="stage-grid">${stages.map((s) => `<button data-stage="${s.id}"><span>0${s.id} / ${s.theme}</span><strong>${s.name}</strong><small>${s.subtitle}</small><b>冒険する →</b></button>`).join('')}</div><button data-close>もどる</button>`;
  dialog.refresh = (unlocked) => {
    for (const b of dialog.querySelectorAll('[data-stage]')) {
      b.disabled = Number(b.dataset.stage) > unlocked;
      b.querySelector('b').textContent = b.disabled
        ? `STAGE ${Number(b.dataset.stage) - 1} クリアで解放`
        : '冒険する →';
    }
  };
  dialog.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b?.dataset.stage && !b.disabled) {
      dialog.close();
      onSelect(Number(b.dataset.stage));
    }
    if (b?.hasAttribute('data-close')) dialog.close();
  });
  document.body.append(dialog);
  return dialog;
}
