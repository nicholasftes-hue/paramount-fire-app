/* Defense in depth: same-origin static assets only, with all cloud APIs absent. */
(() => {
  const allowed = value => { try { return new URL(value, location.href).origin === location.origin; } catch { return false; } };
  const nativeFetch=window.fetch.bind(window);
  window.fetch=(input,options={})=>allowed(typeof input==='string'||input instanceof URL?input:input.url)&&(!options.method||options.method==='GET')?nativeFetch(input,options):Promise.reject(new Error('External requests and writes are disabled in this showcase.'));
  const open=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url,...rest){if(method!=='GET'||!allowed(url))throw Error('External requests and writes are disabled.');return open.call(this,method,url,...rest)};
  navigator.sendBeacon=()=>false;
  window.WebSocket=window.EventSource=class{constructor(){throw Error('External connections disabled.')}};
  window.SpeechRecognition=window.webkitSpeechRecognition=undefined;
  document.addEventListener('click',event=>{
    const a=event.target.closest('a[href]');if(a&&!allowed(a.href)&&!a.href.startsWith('blob:')){event.preventDefault();alert('External access is disabled in this isolated showcase.');}
    if(event.target.closest('[data-showcase-reset]')&&confirm('Reset all fictional showcase records and Academy progress?')){
      for(const key of Object.keys(localStorage))if(key.startsWith('paramount-mark-full-20261027'))localStorage.removeItem(key);
      for(const key of Object.keys(sessionStorage))if(key.startsWith('paramount-mark-full-20261027'))sessionStorage.removeItem(key);
      location.reload();
    }
  },true);
})();
