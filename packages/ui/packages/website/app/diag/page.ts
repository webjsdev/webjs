/**
 * TEMPORARY on-device diagnostic route for #730 (Tier-2 components on iOS).
 * Not linked from anywhere; removed once the core fix is confirmed.
 *
 * v8: instruments the ui-tabs-trigger LIFECYCLE on the device by wrapping
 * customElements.define BEFORE the boot module loads. Records how many times
 * connectedCallback / disconnectedCallback / render fire, in order, plus
 * whether webjs ever bound a click to the live tab button. This reveals the
 * WebKit divergence in the hydration / slot-projection-move / first-render
 * timing that source reading could not pin.
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
window.__wjd={e:[],log:[],cc:0,dc:0,render:0,clickEls:[]};
(function(){var O=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(t,f,o){try{if(t==='click'&&this&&this.nodeType===1&&(this.tagName==='BUTTON'||this.tagName==='DIV')){__wjd.clickEls.push(this);}}catch(e){}return O.call(this,t,f,o);};})();
(function(){
  var D=customElements.define.bind(customElements);
  customElements.define=function(n,c,o){
    if(n==='ui-tabs-trigger' && c && c.prototype){
      var p=c.prototype;
      var cc=p.connectedCallback;
      p.connectedCallback=function(){__wjd.cc++;__wjd.log.push('connect#'+__wjd.cc+' conn='+this.isConnected);return cc?cc.apply(this,arguments):undefined;};
      var dc=p.disconnectedCallback;
      p.disconnectedCallback=function(){__wjd.dc++;__wjd.log.push('disconnect#'+__wjd.dc);return dc?dc.apply(this,arguments):undefined;};
      var rr=p.render;
      if(rr){ p.render=function(){__wjd.render++;__wjd.log.push('render#'+__wjd.render);return rr.apply(this,arguments);}; }
    }
    return D(n,c,o);
  };
})();
addEventListener('error',function(ev){__wjd.e.push((ev.message||ev.type)+' @@ '+String(ev.filename||'').split('/').slice(-2).join('/')+':'+(ev.lineno||0))});
addEventListener('unhandledrejection',function(ev){var r=ev.reason;__wjd.e.push('reject: '+((r&&r.message)||String(r)))});
</script>`;

const REPORT = `<script>
setTimeout(function(){
  var rep={ua:navigator.userAgent, ERRORS:__wjd.e.length?__wjd.e:'(none)'};
  var tb=document.getElementById('tb');
  var btn=tb?tb.querySelector('ui-tabs-trigger[value=\"password\"] button'):null;
  rep.LIFECYCLE={ connectCallbacks:__wjd.cc, disconnectCallbacks:__wjd.dc, renderCalls:__wjd.render, timeline:__wjd.log.slice(0,16) };
  rep.CLICK={ liveButton:btn?'Y':'n', webjsBoundClickToLiveButton:btn?(__wjd.clickEls.indexOf(btn)>=0?'Y':'n'):'noBtn', totalButtonBindings:__wjd.clickEls.filter(function(e){return e.tagName==='BUTTON';}).length };
  document.getElementById('wjdiag').textContent=JSON.stringify(rep,null,2);
},1700);
</script>`;

export default function Diag() {
  return html`
    ${unsafeHTML(EARLY)}
    <main style="padding:1rem;font-family:system-ui;max-width:100%">
      <h1 style="font-size:1.1rem">webjs Tier-2 iOS diagnostic v8 (#730)</h1>
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
