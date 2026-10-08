/** Independent right-edge section controls, movable with pointer or keyboard. */
export function getSecuremineSectionTabsScript(): string {
  return `(function() {
    const tabs = Array.from(document.querySelectorAll('.section-toggle'));
    const spacing = 8;
    const positions = new Map(tabs.map((tab, index) => [tab, 60 + index * 52]));
    function arrange() {
      const height = Math.max(20, Math.min(44, Math.floor((window.innerHeight - 16) / tabs.length) - spacing));
      const top = window.innerHeight >= tabs.length * (height + spacing) + 52 ? 52 : 8;
      const bottom = Math.max(top, window.innerHeight - height - 8);
      const sorted = tabs.slice().sort((a, b) => positions.get(a) - positions.get(b));
      for (let i = 0; i < sorted.length; i++) {
        const tab = sorted[i];
        positions.set(tab, Math.max(top, Math.min(bottom, positions.get(tab)), i ? positions.get(sorted[i - 1]) + height + spacing : top));
      }
      for (let i = sorted.length - 1; i >= 0; i--) {
        const tab = sorted[i];
        positions.set(tab, Math.min(positions.get(tab), i === sorted.length - 1 ? bottom : positions.get(sorted[i + 1]) - height - spacing));
        tab.style.top = positions.get(tab) + 'px'; tab.style.height = height + 'px';
      }
    }
    function setOpen(tab, open) {
      tab.setAttribute('aria-expanded', String(open));
      for (const id of tab.getAttribute('aria-controls').split(' ')) document.getElementById(id).hidden = !open;
      document.querySelector('.layout').classList.toggle('issues-closed', document.getElementById('issuesToggle').getAttribute('aria-expanded') === 'false');
    }
    tabs.forEach(tab => {
      let drag = null, suppressClick = false;
      tab.onclick = () => {
        if (suppressClick) { suppressClick = false; return; }
        setOpen(tab, tab.getAttribute('aria-expanded') !== 'true');
      };
      tab.onpointerdown = event => {
        if (event.button !== 0 || !event.isPrimary) return;
        suppressClick = false;
        drag = {id:event.pointerId,start:event.clientY,top:positions.get(tab),moved:false};
        tab.setPointerCapture(event.pointerId);
      };
      tab.onpointermove = event => {
        if (!drag || drag.id !== event.pointerId) return;
        const delta = event.clientY - drag.start;
        if (!drag.moved && Math.abs(delta) < 5) return;
        drag.moved = true; tab.classList.add('is-dragging');
        positions.set(tab, drag.top + delta); arrange();
      };
      function finish(event) {
        if (!drag || drag.id !== event.pointerId) return;
        suppressClick = drag.moved;
        drag = null; tab.classList.remove('is-dragging');
      }
      tab.onpointerup = finish; tab.onpointercancel = finish; tab.onlostpointercapture = finish;
      tab.onkeydown = event => {
        if (!['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
        event.preventDefault();
        positions.set(tab, event.key === 'Home' ? 0 : event.key === 'End' ? innerHeight : positions.get(tab) + (event.key === 'ArrowUp' ? -20 : 20));
        arrange();
      };
    });
    window.addEventListener('resize', arrange);
    arrange();
  })();`;
}
