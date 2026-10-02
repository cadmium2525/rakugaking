export function registerPwa() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const help = document.createElement('p');
  help.textContent =
    'ホーム画面に追加：iPhoneはSafariの共有メニュー、Androidはブラウザのメニューから追加できます。';
  document.querySelector('#pause-dialog').append(help);
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).catch(() => {
    // Storage restrictions must not prevent the online game from starting.
    const note = document.createElement('p');
    note.textContent = 'オフライン用の保存ができませんでした。オンラインでは遊べます。';
    document.querySelector('#pause-dialog').append(note);
  });
}
