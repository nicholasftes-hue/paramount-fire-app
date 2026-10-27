(() => {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  let requested = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (requested) location.reload();
  });
  navigator.serviceWorker.register('./service-worker.js', {updateViaCache:'none'}).then(registration => {
    function offerUpdate() {
      if (!registration.waiting || document.getElementById('app-update')) return;
      const banner=document.createElement('aside');
      banner.id='app-update';
      banner.setAttribute('aria-label','App update available');
      banner.style.cssText='background:#e6f6fd;color:#173b5c;padding:16px;border-bottom:2px solid #168ac0';
      const text=document.createElement('p');
      text.textContent='An app update is ready. Save any unfinished work before reloading.';
      const button=document.createElement('button');
      button.type='button'; button.textContent='Update and reload';
      button.addEventListener('click',()=>{
        if(!confirm('Have you saved your unfinished work? Updating reloads this page.')) return;
        if (!registration.waiting) { location.reload(); return; }
        requested=true;
        registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
      });
      banner.append(text,button); document.body.prepend(banner);
    }
    offerUpdate();
    registration.addEventListener('updatefound',()=>{
      registration.installing?.addEventListener('statechange', offerUpdate);
    });
    registration.update().catch(()=>{});
  }).catch(()=>{
    const status=document.createElement('p');
    status.setAttribute('role','status');
    status.textContent='Offline app storage is unavailable. Keep an internet connection to reopen the app.';
    document.body.append(status);
  });
})();

