/**
 * TEMPORARY on-device diagnostic route for #730 (Tier-2 components dead on
 * iOS). Not linked from anywhere; removed once the root cause is confirmed.
 *
 * v2: the user reported "can't scroll, especially after the diagnostic runs."
 * That is the dialog's body-scroll-lock firing, which means the dialog DOES
 * open on iOS (interactivity fires) but renders invisibly. So this version
 * opens the dialog, MEASURES whether its content panel is actually visible
 * (rect / display / on-screen) and whether the native <dialog> + scroll lock
 * engaged, then CLOSES it and confirms scroll is unlocked, so the page is
 * never left scroll-locked. Plain inline scripts (not a webjs component).
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
  var anchor;try{anchor=(window.CSS&&CSS.supports)?(CSS.supports('anchor-name','--x')?'Y':'n'):'noCSS'}catch(e){anchor='E'}
  var rep={
    ua:navigator.userAgent,
    ERRORS:__wjd.e.length?__wjd.e:'(none)',
    registered:T.map(function(t){return t+':'+g(t)}).join('  '),
    dialogUpgraded: dlg?(typeof dlg.show==='function'?'Y':'n'):'noEl',
    slotPatchName:(window.HTMLSlotElement&&HTMLSlotElement.prototype.assignedNodes)?HTMLSlotElement.prototype.assignedNodes.name:'noSlotProto',
    feat_showPopover:('showPopover' in HTMLElement.prototype)?'Y':'n',
    feat_showModal:(window.HTMLDialogElement&&HTMLDialogElement.prototype.showModal)?'Y':'n',
    feat_anchorPos:anchor
  };
  function measure(){
    var native=document.querySelector('ui-dialog-content dialog');
    var panel=document.querySelector('ui-dialog-content [data-slot="dialog-content"]');
    var pr=panel?panel.getBoundingClientRect():null;
    var nr=native?native.getBoundingClientRect():null;
    var pcs=panel?getComputedStyle(panel):null;
    var ncs=native?getComputedStyle(native):null;
    return {
      dialogOpenAttr: dlg?(dlg.hasAttribute('open')?'Y':'n'):null,
      bodyOverflow: document.body.style.overflow||'(unset)',
      nativeDialogOpenProp: native?(native.open?'Y':'n'):'noNative',
      nativeRect: nr?(Math.round(nr.width)+'x'+Math.round(nr.height)+' @'+Math.round(nr.left)+','+Math.round(nr.top)):'noNative',
      nativeDisplay: ncs?ncs.display:null,
      panelRect: pr?(Math.round(pr.width)+'x'+Math.round(pr.height)+' @'+Math.round(pr.left)+','+Math.round(pr.top)):'noPanel',
      panelDisplay: pcs?pcs.display:null,
      panelVisibility: pcs?pcs.visibility:null,
      panelOpacity: pcs?pcs.opacity:null,
      panelPosition: pcs?pcs.position:null,
      viewport: innerWidth+'x'+innerHeight,
      panelOnScreen: pr?((pr.width>0&&pr.height>0&&pr.top<innerHeight&&pr.bottom>0&&pr.left<innerWidth&&pr.right>0)?'Y':'n'):'noPanel'
    };
  }
  try{ if(dlg&&dlg.show) dlg.show(); else rep.showMissing=true; }catch(e){rep.showThrew=e.message;}
  setTimeout(function(){
    rep.WHEN_OPEN=measure();
    try{ if(dlg&&dlg.hide) dlg.hide(); }catch(e){rep.hideThrew=e.message;}
    var nd=document.querySelector('ui-dialog-content dialog');
    rep.DIRECT={found: nd?'Y':'NO'};
    if(nd){
      rep.DIRECT.connected=nd.isConnected;
      rep.DIRECT.parentTag=nd.parentElement?nd.parentElement.tagName.toLowerCase():'none';
      rep.DIRECT.displayBefore=getComputedStyle(nd).display;
      try{ nd.showModal(); rep.DIRECT.threw='no'; }catch(e){ rep.DIRECT.threw=e.name+': '+e.message; }
      rep.DIRECT.openAfter=nd.open?'Y':'n';
      rep.DIRECT.displayAfter=getComputedStyle(nd).display;
      var dr=nd.getBoundingClientRect(); rep.DIRECT.nativeRectAfter=Math.round(dr.width)+'x'+Math.round(dr.height)+' @'+Math.round(dr.left)+','+Math.round(dr.top);
      var pnl=nd.querySelector('[data-slot="dialog-content"]'); if(pnl){var prr=pnl.getBoundingClientRect(); rep.DIRECT.panelRectAfter=Math.round(prr.width)+'x'+Math.round(prr.height)+' @'+Math.round(prr.left)+','+Math.round(prr.top);}
      try{ if(nd.open) nd.close(); }catch(e){}
    }
    setTimeout(function(){
      rep.afterClose_bodyOverflow=document.body.style.overflow||'(unset)';
      document.getElementById('wjdiag').textContent=JSON.stringify(rep,null,2);
    },350);
  },450);
},1200);
</script>`;

export default function Diag() {
  return html`
    ${unsafeHTML(EARLY)}
    <main style="padding:1rem;font-family:system-ui;max-width:100%">
      <h1 style="font-size:1.1rem">webjs Tier-2 iOS diagnostic v3 (#730)</h1>
      <p style="font-size:.85rem;color:#666">Wait about 2 seconds, then copy the whole readout and send it to me. The page stays scrollable (the diagnostic opens then auto-closes the probe dialog).</p>
      <button onclick="location.reload()" style="margin-bottom:.75rem" class=${buttonClass({ variant: 'outline', size: 'sm' })}>Re-run</button>
      <pre id="wjdiag" style="white-space:pre-wrap;word-break:break-word;font:12px/1.5 monospace;background:#f4f4f5;color:#111;padding:1rem;border-radius:8px;border:1px solid #ccc">collecting (wait about 2s)...</pre>
      <div style="height:60vh"></div>
      <ui-dialog style="position:absolute;width:0;height:0;overflow:hidden">
        <ui-dialog-content><p style="padding:1rem">probe dialog content</p></ui-dialog-content>
      </ui-dialog>
    </main>
    ${unsafeHTML(REPORT)}
  `;
}
