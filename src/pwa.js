export function registerPwa({ canApply = () => false, save = async () => false } = {}) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const help = document.createElement('p');
  help.textContent =
    'ホーム画面に追加：iPhoneはSafariの共有メニュー、Androidはブラウザのメニューから追加できます。';
  document.querySelector('#pause-dialog').append(help);
  let applying = false,
    readyToReload = false;
  const note = document.createElement('aside');
  note.id = 'update-notice';
  note.hidden = true;
  const message = document.createElement('span');
  message.textContent = '新しいゲームがあります。広場で保存して更新できます。';
  const button = document.createElement('button');
  button.textContent = '保存して更新';
  note.append(message, button);
  document.body.append(note);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!applying) return;
    if (canApply()) location.reload();
    else {
      // Activation is asynchronous: the user may have opened the editor or
      // started an adventure after asking for the update. Keep that work alive.
      applying = false;
      readyToReload = true;
      button.disabled = false;
      message.textContent = '更新を用意しました。落書きを保存して閉じ、広場で更新できます。';
    }
  });
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== 'RAKUGA_UPDATE_BLOCKED') return;
    applying = false;
    button.disabled = false;
    message.textContent =
      'ほかのゲームのタブを閉じてから更新してください。落書きと進行は残ります。';
  });
  navigator.serviceWorker
    .register('./sw.js', { scope: './', updateViaCache: 'none' })
    .then((registration) => {
      const available = () => {
        if (registration.waiting && navigator.serviceWorker.controller) note.hidden = false;
      };
      available();
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', available);
      });
      button.onclick = async () => {
        if (!canApply()) {
          message.textContent = '落書きを保存して閉じ、冒険中は広場へ戻ってから更新してください。';
          return;
        }
        button.disabled = true;
        if (!(await save())) {
          button.disabled = false;
          message.textContent = '保存できませんでした。更新せず、このまま遊べます。';
          return;
        }
        if (!canApply() || (!registration.waiting && !readyToReload)) {
          button.disabled = false;
          message.textContent = '保存しました。広場へ戻ってから更新できます。';
          return;
        }
        applying = true;
        message.textContent = '保存しました。新しいゲームを開きます…';
        if (readyToReload) {
          location.reload();
          return;
        }
        registration.waiting?.postMessage({ type: 'RAKUGA_APPLY_UPDATE' });
      };
      window.addEventListener('focus', () => registration.update().catch(() => {}));
    })
    .catch(() => {
      // Storage restrictions must not prevent the online game from starting.
      const note = document.createElement('p');
      note.textContent = 'オフライン用の保存ができませんでした。オンラインでは遊べます。';
      document.querySelector('#pause-dialog').append(note);
    });
}
