/**
 * TEMPORARY on-device diagnostic route for #730 (Tier-2 components on iOS).
 * Not linked from anywhere; removed once the fix is confirmed.
 *
 * v4: confirmed root cause is the 0x0 native <dialog> collapsing its
 * position:fixed content panel on WebKit (now fixed: the host fills the
 * viewport). This version VERIFIES the dialog fix and also probes the two
 * other Tier-2 mechanisms on-device so we know whether they share the bug:
 *   - dialog (showModal top-layer)  -> measure the content panel is visible
 *   - tooltip (Popover API top-layer) -> open + measure the popover is visible
 *   - tabs (no overlay, reactive re-render) -> switch tab + measure the panel
 * Plain inline scripts; opens then closes everything so scroll is never left
 * locked.
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
function rct(el){if(!el)return 'noEl';var r=el.getBoundingClientRect();var on=(r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0);return Math.round(r.width)+'x'+Math.round(r.height)+' @'+Math.round(r.left)+','+Math.round(r.top)+(on?' ON-SCREEN':' off-screen');}
setTimeout(function(){
  var rep={ua:navigator.userAgent, ERRORS:__wjd.e.length?__wjd.e:'(none)'};
  var d=document.getElementById('d');
  try{ if(d&&d.show) d.show(); }catch(e){rep.dialogShowErr=e.message;}
  setTimeout(function(){
    rep.DIALOG={ nativeOpen:((document.querySelector('#d dialog')||{}).open?'Y':'n'), nativeRect:rct(document.querySelector('#d dialog')), panel:rct(document.querySelector('#d [data-slot=\"dialog-content\"]')) };
    try{ if(d&&d.hide) d.hide(); }catch(e){}
    var tt=document.getElementById('tt');
    try{ if(tt&&tt.show) tt.show(); }catch(e){rep.ttShowErr=e.message;}
    setTimeout(function(){
      var pop=document.querySelector('#tt [popover]');
      rep.TOOLTIP={ openAttr:(tt&&tt.hasAttribute('open'))?'Y':'n', popoverShown: pop?(pop.matches(':popover-open')?'Y':'n'):'noPop', popoverRect:rct(pop) };
      try{ if(tt&&tt.hide) tt.hide(); }catch(e){}
      var tb=document.getElementById('tb');
      var pBefore=rct(tb?tb.querySelector('ui-tabs-content[value=\"password\"]'):null);
      var trig=tb?tb.querySelector('ui-tabs-trigger[value=\"password\"]'):null;
      var clk=trig?(trig.querySelector('button')||trig):null;
      try{ if(clk) clk.click(); }catch(e){rep.tabsClickErr=e.message;}
      setTimeout(function(){
        var pPanel=tb?tb.querySelector('ui-tabs-content[value=\"password\"]'):null;
        rep.TABS={ tabsValue: tb?tb.getAttribute('value'):'noTabs', passwordPanel_before:pBefore, passwordPanel_after:rct(pPanel), passwordPanel_inert: pPanel?(pPanel.hasAttribute('inert')?'inert(hidden)':'active(shown)'):'noPanel' };
        rep.bodyOverflowEnd=document.body.style.overflow||'(unset)';
        document.getElementById('wjdiag').textContent=JSON.stringify(rep,null,2);
      },350);
    },350);
  },450);
},1200);
</script>`;

export default function Diag() {
  return html`
    ${unsafeHTML(EARLY)}
    <main style="padding:1rem;font-family:system-ui;max-width:100%">
      <h1 style="font-size:1.1rem">webjs Tier-2 iOS diagnostic v4 (#730)</h1>
      <p style="font-size:.85rem;color:#666">Wait about 2s, then copy the whole readout and send it to me. The page stays scrollable.</p>
      <button onclick="location.reload()" style="margin-bottom:.75rem" class=${buttonClass({ variant: 'outline', size: 'sm' })}>Re-run</button>
      <pre id="wjdiag" style="white-space:pre-wrap;word-break:break-word;font:12px/1.5 monospace;background:#f4f4f5;color:#111;padding:1rem;border-radius:8px;border:1px solid #ccc">collecting (wait about 2s)...</pre>
      <div style="height:50vh"></div>
      <ui-dialog id="d" style="position:absolute;width:0;height:0;overflow:hidden">
        <ui-dialog-content><p style="padding:1rem">dialog probe content</p></ui-dialog-content>
      </ui-dialog>
      <ui-tooltip id="tt" delay-duration="0" skip-delay-duration="0" style="position:absolute;width:0;height:0;overflow:hidden">
        <ui-tooltip-trigger><button class=${buttonClass({ size: 'sm' })} aria-label="probe">?</button></ui-tooltip-trigger>
        <ui-tooltip-content>tooltip probe</ui-tooltip-content>
      </ui-tooltip>
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
