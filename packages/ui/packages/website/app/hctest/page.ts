// TEMPORARY on-device diagnostic for #745 (hover-card stay-open on iOS).
// Removed once confirmed. Renders the (fixed) hover-card and logs every trigger
// event + every open-state change, so a single tap on a real iPhone either
// confirms the card stays open or shows exactly what closes it.
import { html, unsafeHTML } from '@webjsdev/core';
import '#components/ui/hover-card.ts';

const LOG = `<script>
window.__hc={ev:[],t0:Date.now()};
setTimeout(function(){
  var trig=document.querySelector('ui-hover-card-trigger');
  var card=document.querySelector('ui-hover-card');
  if(!trig||!card){document.getElementById('log').textContent='no hover-card found';return;}
  ['pointerdown','pointerup','click','mouseenter','mouseleave','focusin','focusout','touchstart','touchend'].forEach(function(t){
    trig.addEventListener(t,function(e){__hc.ev.push((Date.now()-__hc.t0)+'ms '+t+(e.pointerType?'('+e.pointerType+')':''));},true);
  });
  new MutationObserver(function(){__hc.ev.push((Date.now()-__hc.t0)+'ms OPEN='+card.hasAttribute('open'));}).observe(card,{attributes:true,attributeFilter:['open']});
  setInterval(function(){document.getElementById('log').textContent=JSON.stringify({ua:navigator.userAgent.slice(0,32),hoverNone:matchMedia('(hover: none)').matches,seq:__hc.ev.slice(-22)},null,1);},400);
},1000);
</script>`;

export default function HcTest() {
  return html`
    ${unsafeHTML(LOG)}
    <main style="padding:1rem;font-family:system-ui;max-width:100%">
      <h1 style="font-size:1.1rem">hover-card iOS test (#745)</h1>
      <p style="font-size:.85rem;color:#666">Tap the blue link once, wait about 2s, then copy the whole readout and send it. The card should OPEN and STAY open until you tap elsewhere.</p>
      <div style="height:18vh"></div>
      <ui-hover-card>
        <ui-hover-card-trigger><a href="/docs" style="color:#0066ff;text-decoration:underline">@vivek (tap me)</a></ui-hover-card-trigger>
        <ui-hover-card-content>
          <div style="padding:0.75rem">This card should stay open after a tap.</div>
        </ui-hover-card-content>
      </ui-hover-card>
      <div style="height:28vh"></div>
      <pre id="log" style="white-space:pre-wrap;word-break:break-word;font:12px/1.5 monospace;background:#f4f4f5;color:#111;padding:1rem;border-radius:8px;border:1px solid #ccc">tap the link, then wait about 2s</pre>
    </main>
  `;
}
