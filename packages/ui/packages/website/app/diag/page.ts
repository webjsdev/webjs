/**
 * TEMPORARY on-device diagnostic route for #730 (Tier-2 components on iOS).
 * Not linked from anywhere; removed once the core fix is confirmed.
 *
 * v7: webjs hydration re-renders fresh (createInstance) and bindPart does
 * el.addEventListener('click', dispatcher) on the rendered button, then
 * slot.js re-projects. v6 proved the live button receives clicks but the webjs
 * @click never fires. This instruments addEventListener BEFORE hydration to
 * record every button/div webjs binds a click to, then checks whether the LIVE
 * tab-trigger button is one webjs bound (and whether any bound button ended up
 * DETACHED, meaning the slot re-projection replaced the @click-bound node).
 */
import { html, unsafeHTML } from '@webjsdev/core';
import { buttonClass } from '#components/ui/button.ts';
import '#components/ui/dialog.ts';
import '#components/ui/alert-dialog.ts';
import '#components/ui/tabs.ts';
import '#components/ui/tooltip.ts';
import '#components/ui/hover-card.ts';
import '#components/ui/dropdown-menu.ts';
import '#components/ui/toggle.ts';
import '#components/ui/toggle-group.ts';
import '#components/ui/sonner.ts';

const EARLY = `<script>
window.__wjd={e:[],clickEls:[]};
(function(){
  var O=EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener=function(t,f,o){
    try{ if(t==='click' && this && this.nodeType===1 && (this.tagName==='BUTTON'||this.tagName==='DIV')){ __wjd.clickEls.push(this); } }catch(e){}
    return O.call(this,t,f,o);
  };
})();
addEventListener('error',function(ev){__wjd.e.push((ev.message||ev.type)+' @@ '+String(ev.filename||'').split('/').slice(-2).join('/')+':'+(ev.lineno||0))});
addEventListener('unhandledrejection',function(ev){var r=ev.reason;__wjd.e.push('reject: '+((r&&r.message)||String(r)))});
</script>`;

const REPORT = `<script>
setTimeout(function(){
  var rep={ua:navigator.userAgent, ERRORS:__wjd.e.length?__wjd.e:'(none)'};
  var tb=document.getElementById('tb');
  var trig=tb?tb.querySelector('ui-tabs-trigger[value=\"password\"]'):null;
  var btn=trig?trig.querySelector('button'):null;
  var els=__wjd.clickEls;
  var detachedBound=0,boundButtonsTotal=0;
  for(var i=0;i<els.length;i++){ if(els[i].tagName==='BUTTON'){ boundButtonsTotal++; if(!els[i].isConnected) detachedBound++; } }
  rep.TABS={
    liveButtonFound: btn?'Y':'n',
    webjsBoundClickToLiveButton: btn?(els.indexOf(btn)>=0?'Y':'n'):'noBtn',
    totalClickBindingsRecorded: els.length,
    buttonClickBindingsRecorded: boundButtonsTotal,
    boundButtonsNowDetached: detachedBound,
    liveButtonConnected: btn?(btn.isConnected?'Y':'n'):'noBtn'
  };
  var th=document.querySelector('theme-toggle button, button[aria-label*=\"theme\" i], button[title*=\"theme\" i]');
  rep.THEME_CONTROL={ liveBtn: th?'Y':'n', webjsBoundClickToIt: th?(els.indexOf(th)>=0?'Y':'n'):'noBtn' };
  document.getElementById('wjdiag').textContent=JSON.stringify(rep,null,2);
},1600);
</script>`;

export default function Diag() {
  return html`
    ${unsafeHTML(EARLY)}
    <main style="padding:1rem;font-family:system-ui;max-width:100%">
      <h1 style="font-size:1.1rem">webjs Tier-2 iOS diagnostic v7 (#730)</h1>
      <p style="font-size:.85rem;color:#666">Wait about 2s, then copy the whole readout and send it to me. The page stays scrollable.</p>
      <button onclick="location.reload()" style="margin-bottom:.75rem" class=${buttonClass({ variant: 'outline', size: 'sm' })}>Re-run</button>
      <pre id="wjdiag" style="white-space:pre-wrap;word-break:break-word;font:12px/1.5 monospace;background:#f4f4f5;color:#111;padding:1rem;border-radius:8px;border:1px solid #ccc">collecting (wait about 2s)...</pre>
      <div style="height:40vh"></div>
      <ui-tabs id="tb" value="account" style="position:absolute;width:0;height:0;overflow:hidden">
        <ui-tabs-list>
          <ui-tabs-trigger value="account">Account</ui-tabs-trigger>
          <ui-tabs-trigger value="password">Password</ui-tabs-trigger>
        </ui-tabs-list>
        <ui-tabs-content value="account">Account panel</ui-tabs-content>
        <ui-tabs-content value="password">Password panel</ui-tabs-content>
      </ui-tabs>
    </main>
    ${unsafeHTML(REPORT)}
  `;
}
