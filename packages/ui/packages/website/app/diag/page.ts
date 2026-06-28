/**
 * TEMPORARY on-device diagnostic route for #730 (Tier-2 components on iOS).
 * Not linked from anywhere; removed once the core fix is confirmed.
 *
 * v9: controlled A/B to isolate kit-vs-core regression.
 *   PROBE_A: a real <ui-tabs-trigger> (the #656 render: parent lookup, id-gen,
 *            a parent-dependent second render).
 *   PROBE_B: a MINIMAL slot+@click custom element with no parent lookup, no
 *            id-gen, no reactive props. If B's @click fires on iOS but A's does
 *            not, #656's render additions are the regression. If B also fails,
 *            the slot+@click hydration itself regressed (core).
 */
import { html, unsafeHTML, WebComponent } from '@webjsdev/core';
import { buttonClass } from '#components/ui/button.ts';
import '#components/ui/tabs.ts';

// Minimal control: slot + @click, nothing else. Mirrors the pre-#656 trigger
// shape (a button wrapping a slot, with a click handler and no id/aria/parent).
class DiagSlotBtn extends WebComponent({}) {
  render() {
    return html`<button
      type="button"
      data-diag-btn
      @click=${() => {
        const w = /** @type {any} */ (window);
        if (w.__wjd) w.__wjd.probeBClicked = true;
      }}
    ><slot></slot></button>`;
  }
}
DiagSlotBtn.register('diag-slot-btn');

const EARLY = `<script>
window.__wjd={e:[],probeBClicked:false};
window.__WEBJS_DIAG=[];
addEventListener('error',function(ev){__wjd.e.push((ev.message||ev.type)+' @@ '+String(ev.filename||'').split('/').slice(-2).join('/')+':'+(ev.lineno||0))});
addEventListener('unhandledrejection',function(ev){var r=ev.reason;__wjd.e.push('reject: '+((r&&r.message)||String(r)))});
</script>`;

const REPORT = `<script>
setTimeout(function(){
  var rep={ua:navigator.userAgent, ERRORS:__wjd.e.length?__wjd.e:'(none)'};
  var bBtn=document.querySelector('diag-slot-btn button');
  __wjd.probeBClicked=false;
  if(bBtn) bBtn.click();
  rep.PROBE_B_minimal_slot_click={ buttonFound:bBtn?'Y':'n', clickFired:__wjd.probeBClicked?'Y':'n' };
  rep.CORE_TRACE=window.__WEBJS_DIAG;
  var tb=document.getElementById('tb');
  var aBtn=tb?tb.querySelector('ui-tabs-trigger[value=\"password\"] button'):null;
  if(aBtn) aBtn.click();
  rep.PROBE_A_real_tab_trigger={ buttonFound:aBtn?'Y':'n', switchedToPassword:(tb&&tb.getAttribute('value')==='password')?'Y':'n', valueNow:tb?tb.getAttribute('value'):'noTabs' };
  document.getElementById('wjdiag').textContent=JSON.stringify(rep,null,2);
},1700);
</script>`;

export default function Diag() {
  return html`
    ${unsafeHTML(EARLY)}
    <main style="padding:1rem;font-family:system-ui;max-width:100%">
      <h1 style="font-size:1.1rem">webjs Tier-2 iOS diagnostic v10 (#730)</h1>
      <p style="font-size:.85rem;color:#666">Wait about 2s, then copy the whole readout and send it to me. The page stays scrollable.</p>
      <button onclick="location.reload()" style="margin-bottom:.75rem" class=${buttonClass({ variant: 'outline', size: 'sm' })}>Re-run</button>
      <pre id="wjdiag" style="white-space:pre-wrap;word-break:break-word;font:12px/1.5 monospace;background:#f4f4f5;color:#111;padding:1rem;border-radius:8px;border:1px solid #ccc">collecting (wait about 2s)...</pre>
      <div style="height:30vh"></div>
      <diag-slot-btn style="position:absolute;width:0;height:0;overflow:hidden">Hello</diag-slot-btn>
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
