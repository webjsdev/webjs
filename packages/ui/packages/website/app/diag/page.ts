/**
 * TEMPORARY on-device diagnostic route for #730 (Tier-2 components on iOS).
 * Not linked from anywhere; removed once the fixes are confirmed.
 *
 * v6: the tabs dissection (v5) showed @click on a slot-containing element does
 * not fire on iOS WebKit (afterClick no-op, afterSetAttr works). This isolates
 * the mechanism:
 *   - TABS.freshListenerFired: does the button RECEIVE a click at all (then only
 *     the @click BINDING is missing) vs not (a deeper click/pointer issue)?
 *   - TABS.atClickSwitched: does the component @click (_onClick) fire?
 *   - DIALOG_TRIGGER: tapping a real <ui-dialog-trigger><button> (slot + @click)
 *     -> does the dialog open? (the real user flow, post showModal fix)
 *   - THEME: clicking the theme-toggle (@click, NO slot) -> control that works.
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
window.__wjd={e:[]};
addEventListener('error',function(ev){__wjd.e.push((ev.message||ev.type)+' @@ '+String(ev.filename||'').split('/').slice(-2).join('/')+':'+(ev.lineno||0))});
addEventListener('unhandledrejection',function(ev){var r=ev.reason;__wjd.e.push('reject: '+((r&&r.message)||String(r)))});
</script>`;

const REPORT = `<script>
function ist(el){return el?(el.hasAttribute('inert')?'inert(hidden)':'active(shown)'):'noPanel';}
setTimeout(function(){
  var rep={ua:navigator.userAgent, ERRORS:__wjd.e.length?__wjd.e:'(none)'};
  // --- TABS: does the button receive clicks at all? does @click fire? ---
  var tb=document.getElementById('tb');
  var btn=tb?tb.querySelector('ui-tabs-trigger[value=\"password\"] button'):null;
  var fresh=false;
  if(btn){ try{ btn.addEventListener('click',function(){fresh=true;},{once:true}); btn.click(); }catch(e){rep.tabsErr=e.message;} }
  rep.TABS={ buttonCount: tb?tb.querySelectorAll('ui-tabs-trigger[value=\"password\"] button').length:'noTb', freshListenerFired: btn?(fresh?'Y':'n'):'noBtn', atClickSwitchedValue: tb?tb.getAttribute('value'):'noTb', passwordPanel: ist(tb?tb.querySelector('ui-tabs-content[value=\"password\"]'):null) };
  // --- DIALOG TRIGGER tap (real flow) ---
  var dt=document.querySelector('#d2 ui-dialog-trigger button');
  rep.DIALOG_TRIGGER={ triggerBtnFound: dt?'Y':'n' };
  try{ if(dt) dt.click(); }catch(e){rep.DIALOG_TRIGGER.err=e.message;}
  setTimeout(function(){
    var d2=document.getElementById('d2');
    rep.DIALOG_TRIGGER.dialogOpenedAfterTriggerTap = d2?(d2.hasAttribute('open')?'Y':'n'):'noDlg';
    try{ if(d2&&d2.hide) d2.hide(); }catch(e){}
    // --- THEME TOGGLE control (@click, no slot) ---
    var th=document.querySelector('[data-theme-toggle] button, theme-toggle button, button[aria-label*=\"theme\" i], button[title*=\"theme\" i]');
    var before = document.documentElement.getAttribute('data-theme') || document.documentElement.className || '(none)';
    rep.THEME={ toggleBtnFound: th?'Y':'n', rootBefore:before };
    try{ if(th) th.click(); }catch(e){rep.THEME.err=e.message;}
    setTimeout(function(){
      rep.THEME.rootAfter = document.documentElement.getAttribute('data-theme') || document.documentElement.className || '(none)';
      rep.THEME.changed = (rep.THEME.rootAfter!==rep.THEME.rootBefore)?'Y':'n';
      document.getElementById('wjdiag').textContent=JSON.stringify(rep,null,2);
    },300);
  },350);
},1300);
</script>`;

export default function Diag() {
  return html`
    ${unsafeHTML(EARLY)}
    <main style="padding:1rem;font-family:system-ui;max-width:100%">
      <h1 style="font-size:1.1rem">webjs Tier-2 iOS diagnostic v6 (#730)</h1>
      <p style="font-size:.85rem;color:#666">Wait about 2s, then copy the whole readout and send it to me. The page stays scrollable.</p>
      <button onclick="location.reload()" style="margin-bottom:.75rem" class=${buttonClass({ variant: 'outline', size: 'sm' })}>Re-run</button>
      <pre id="wjdiag" style="white-space:pre-wrap;word-break:break-word;font:12px/1.5 monospace;background:#f4f4f5;color:#111;padding:1rem;border-radius:8px;border:1px solid #ccc">collecting (wait about 2s)...</pre>
      <div style="height:50vh"></div>
      <ui-dialog id="d2" style="position:absolute;width:0;height:0;overflow:hidden">
        <ui-dialog-trigger><button class=${buttonClass()}>open</button></ui-dialog-trigger>
        <ui-dialog-content><p style="padding:1rem">dialog probe via trigger</p></ui-dialog-content>
      </ui-dialog>
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
