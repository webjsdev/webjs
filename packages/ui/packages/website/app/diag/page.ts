/**
 * TEMPORARY on-device diagnostic route for #730 (Tier-2 components dead on
 * iOS). Not linked from anywhere; removed once the root cause is confirmed.
 *
 * It side-effect-loads every Tier-2 module (so a module that throws at load
 * on iOS WebKit surfaces in the early error handler), renders a real
 * slot-using <ui-dialog>, and prints a visible readout of: any window error,
 * which custom elements registered, whether the dialog upgraded, whether the
 * light-DOM slot polyfill installed + projected, feature support, and whether
 * tapping / programmatically opening the dialog actually works. Plain inline
 * scripts (NOT a webjs component), so the diagnostic itself does not depend on
 * the slot hydration it is testing.
 */
import { html, unsafeHTML } from '@webjsdev/core';
import { buttonClass } from '#components/ui/button.ts';
// Load every Tier-2 module so it registers (or throws at load, caught below).
import '#components/ui/dialog.ts';
import '#components/ui/alert-dialog.ts';
import '#components/ui/tabs.ts';
import '#components/ui/tooltip.ts';
import '#components/ui/hover-card.ts';
import '#components/ui/dropdown-menu.ts';
import '#components/ui/toggle.ts';
import '#components/ui/toggle-group.ts';
import '#components/ui/sonner.ts';

// Installed FIRST (classic inline script runs during parse, before the
// deferred module boot), so it catches a Tier-2 module throwing at load.
const EARLY = `<script>
window.__wjd={e:[]};
addEventListener('error',function(ev){__wjd.e.push((ev.message||ev.type)+' @@ '+String(ev.filename||'').split('/').slice(-2).join('/')+':'+(ev.lineno||0))});
addEventListener('unhandledrejection',function(ev){var r=ev.reason;__wjd.e.push('reject: '+((r&&r.message)||String(r)))});
</script>`;

const REPORT = `<script>
setTimeout(function(){
  var T=['ui-dialog','ui-dialog-trigger','ui-dialog-content','ui-alert-dialog','ui-tabs','ui-tabs-trigger','ui-tooltip','ui-tooltip-trigger','ui-hover-card','ui-dropdown-menu','ui-toggle','ui-toggle-group','ui-sonner'];
  function g(t){try{return customElements.get(t)?'Y':'n'}catch(e){return 'E'}}
  var dlg=document.querySelector('ui-dialog');
  var trg=document.querySelector('ui-dialog-trigger');
  var slot=trg?trg.querySelector('slot'):null;
  var btn=trg?trg.querySelector('button'):null;
  var anchor;try{anchor=(window.CSS&&CSS.supports)?(CSS.supports('anchor-name','--x')?'Y':'n'):'noCSS'}catch(e){anchor='E'}
  var rep={
    ua:navigator.userAgent,
    ERRORS:__wjd.e.length?__wjd.e:'(none)',
    registered:T.map(function(t){return t+':'+g(t)}).join('  '),
    dialogUpgraded: dlg?(typeof dlg.show==='function'?'Y':'n'):'noEl',
    slotPatchName:(window.HTMLSlotElement&&HTMLSlotElement.prototype.assignedNodes)?HTMLSlotElement.prototype.assignedNodes.name:'noSlotProto',
    slotProjection: slot?(String(slot.getAttribute('data-projection'))+' kids='+slot.children.length):'noSlot',
    btnInsideTrigger:(btn&&trg)?(trg.contains(btn)?'Y':'n'):'noBtn',
    feat_showPopover:('showPopover' in HTMLElement.prototype)?'Y':'n',
    feat_showModal:(window.HTMLDialogElement&&HTMLDialogElement.prototype.showModal)?'Y':'n',
    feat_anchorPos:anchor,
    feat_slotEl:(typeof HTMLSlotElement!=='undefined')?'Y':'n'
  };
  try{ if(btn){btn.click(); rep.afterBtnClickImmediate=dlg?(dlg.hasAttribute('open')?'Y':'n'):'noEl';} else {rep.afterBtnClickImmediate='noBtn';} }catch(e){rep.clickThrew=e.message;}
  setTimeout(function(){
    rep.afterBtnClick300=dlg?(dlg.hasAttribute('open')?'Y':'n'):'noEl';
    try{ if(dlg&&dlg.show){dlg.show(); rep.afterProgrammaticShow=dlg.hasAttribute('open')?'Y':'n';} else {rep.afterProgrammaticShow='noShowMethod';} }catch(e){rep.showThrew=e.message;}
    document.getElementById('wjdiag').textContent=JSON.stringify(rep,null,2);
  },500);
},2000);
</script>`;

export default function Diag() {
  return html`
    ${unsafeHTML(EARLY)}
    <main style="padding:1rem;font-family:system-ui;max-width:100%">
      <h1 style="font-size:1.1rem">webjs Tier-2 iOS diagnostic (#730)</h1>
      <p style="font-size:.85rem;color:#666">Wait about 3 seconds, then copy the whole readout below and send it to me.</p>
      <pre id="wjdiag" style="white-space:pre-wrap;word-break:break-word;font:12px/1.5 monospace;background:#f4f4f5;color:#111;padding:1rem;border-radius:8px;border:1px solid #ccc">collecting (wait about 3s)...</pre>
      <div style="margin-top:1.5rem;padding:1rem;border:1px dashed #bbb;border-radius:8px">
        <p style="font-size:.85rem;margin:0 0 .5rem">Manual check: tap this button. Does a modal dialog appear?</p>
        <ui-dialog>
          <ui-dialog-trigger><button class=${buttonClass()}>Open dialog (manual)</button></ui-dialog-trigger>
          <ui-dialog-content><p style="padding:1rem">If you can read this inside a modal, the dialog works on your device.</p></ui-dialog-content>
        </ui-dialog>
      </div>
    </main>
    ${unsafeHTML(REPORT)}
  `;
}
