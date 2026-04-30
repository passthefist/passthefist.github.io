const SPACING = getComputedStyle(document.querySelector(":root")).getPropertyValue('--verlet-spacing') || 1;
const SPRING_K = 0.1;
const REST_SPRING_K_BASE = 0.8;
const DAMPING = 0.82;
const COL_GAP = 90*SPACING;
const ROW_GAP = 34*SPACING;
const REPEL_RADIUS = 90;
const REPEL_STRENGTH = 5;
const REST_K_MOD_DECAY = 1;

function initGroup(innerId, svgId, titleId, tagIds, cols) {
  var rest_spring_k_mod = 0;
  var relaxRestK = false;
  const inner = document.getElementById(innerId);
  const svg = document.getElementById(svgId);
  const titleEl = document.getElementById(titleId);
  const tags = tagIds.map(id => document.getElementById(id));
  const n = tags.length;
  if (!n) return;

  function getTitleCenter() {
    const tr = titleEl.getBoundingClientRect();
    const ir = inner.getBoundingClientRect();
    return { x: tr.left + tr.width/2 - ir.left, y: tr.top + tr.height/2 - ir.top };
  }

  function nudge(vector) {
    if (rest_spring_k_mod < 0.3) {
        rest_spring_k_mod = 0.3;
    }
    
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      const xForce = (vector.x || 0);
      const yForce = (vector.y || 0);

      p.px += (Math.random()-0.5)*xForce + xForce/2;
      p.py += (Math.random()-0.5)*yForce + yForce/2;
    }
  }

  const rows = Math.ceil(n / cols);

  function getRestPositions() {
    const tc = getTitleCenter();
    return tags.map((_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        x: tc.x + (col - (cols-1)/2) * COL_GAP * (3/cols),
        y: tc.y + (row + 1) * ROW_GAP - ROW_GAP * 0.3
      };
    });
  }

  let restPos = getRestPositions();

  const particles = restPos.map(r => ({
    x: r.x,
    y: r.y,
    px: r.x, py: r.y
  }));

  // neighbor springs between tags
  const springs = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    if (col + 1 < cols && i+1 < n) springs.push([i, i+1]);
    if (i + cols < n) springs.push([i, i+cols]);
    if (col + 1 < cols && i+cols+1 < n) springs.push([i, i+cols+1]);
    if (col > 0 && i+cols-1 < n) springs.push([i, i+cols-1]);
  }

  // title-to-top-row springs: connect title center to each tag in row 0
  // handled separately using getTitleCenter() each frame

  const lines = springs.map(() => {
    const l = document.createElementNS('http://www.w3.org/2000/svg','line');
    l.setAttribute('stroke','rgba(200, 200, 200)');
    l.setAttribute('stroke-width','1');
    svg.appendChild(l);
    return l;
  });

  // title connector lines (one per top-row tag)
  const topRowCount = Math.min(cols, n);
  const titleLines = Array.from({length: topRowCount}, () => {
    const l = document.createElementNS('http://www.w3.org/2000/svg','line');
    l.setAttribute('stroke','rgba(200, 200, 200)');
    l.setAttribute('stroke-width','1');
    svg.appendChild(l);
    return l;
  });

  let pointerX = -9999, pointerY = -9999;

  inner.addEventListener('mouseover', e => {
    relaxRestK = true;
  })
  inner.addEventListener('mousemove', e => {
    const r = inner.getBoundingClientRect();
    pointerX = e.clientX - r.left;
    pointerY = e.clientY - r.top;
  });
  inner.addEventListener('mouseleave', () => {
    pointerX = -9999;
    pointerY = -9999;
    relaxRestK = false;
  });

  inner.addEventListener('touchstart', e => {
    rest_spring_k_mod = 1;
    relaxRestK = true;
  })
  inner.addEventListener('touchmove', e => {
    const r = inner.getBoundingClientRect();
    pointerX = e.touches[0].clientX - r.left;
    pointerY = e.touches[0].clientY - r.top;
  }, {passive: true});
  inner.addEventListener('touchend', () => {
    pointerX = -9999;
    pointerY = -9999;
    relaxRestK = false;
  });

  const options = {
    root: null, // Use the viewport as the root
    rootMargin: '-220px', // No margin around the root
    threshold: 1 // Trigger when 10% of the target is visible
  };
 
  var triggers = 1;
  const observer = new IntersectionObserver((_, o) => {
    let direc = 50*(Math.random() - 0.5);
    if (direc < 0 && direc > -20) {
        direc = -20;
    } else if (direc > 0 && direc < 20) {
        direc = 20;
    }

    nudge({x: direc});
    if (triggers-- < 0){
        o.disconnect();
    }
  }, options);
  observer.observe(titleEl);

  let scrollY = window.scrollY;

  function step() {
    const newScrollY = window.scrollY;
    const scrollDelta = newScrollY - scrollY;

    scrollY = newScrollY;

    restPos = getRestPositions();

    const tc = getTitleCenter();

    for (let i = 0; i < n; i++) {
      const p = particles[i];
      const r = restPos[i];

      if (relaxRestK) {
        rest_spring_k_mod = 0.95;
      } else {
        rest_spring_k_mod = rest_spring_k_mod*REST_K_MOD_DECAY;
      }

      const yDist = r.y - p.y;

      const boundMod = ((yDist*yDist > 100*100) ? 30 : 1);
        
      let ax = (r.x - p.x) * REST_SPRING_K_BASE * (1-rest_spring_k_mod);
      let ay = (r.y - p.y) * REST_SPRING_K_BASE * (1-rest_spring_k_mod) * boundMod + scrollDelta * 0.1;

      if (ay > 5) {
        ay = 5;
      } else if (ay < -5){
        ay = -5;
      }

      // neighbor springs
      for (const [a, b] of springs) {
        const other = a === i ? b : (b === i ? a : -1);
        if (other < 0) continue;
        const o = particles[other];
        const ro = restPos[other];
        const restDx = r.x - ro.x;
        const restDy = r.y - ro.y;
        const restDist = Math.sqrt(restDx*restDx + restDy*restDy) || 1;
        const dx = p.x - o.x;
        const dy = p.y - o.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 0.001;
        const force = (dist - restDist) * SPRING_K;
        ax -= (dx/dist) * force;
        ay -= (dy/dist) * force;
      }

      // title spring for top row
      if (Math.floor(i / cols) === 0) {
        const dx = p.x - tc.x;
        const dy = p.y - tc.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 0.001;
        const restDist = ROW_GAP * 3;
        const force = (dist - restDist) * SPRING_K * 0.8;
        ax -= (dx/dist) * force;
        ay -= (dy/dist) * force;
      }

      // pointer repulsion
      const pdx = p.x - pointerX;
      const pdy = p.y - pointerY;
      const pdist = Math.sqrt(pdx*pdx + pdy*pdy);
      if (pdist < REPEL_RADIUS && pdist > 0.1) {
        const strength = REPEL_STRENGTH * (1 - pdist/REPEL_RADIUS);
        ax += (pdx/pdist) * strength;
        ay += (pdy/pdist) * strength;
      }

      var vx = (p.x - p.px) * DAMPING + ax;
      var vy = (p.y - p.py) * DAMPING + ay;

      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy;
    }

    // render tags
    for (let i = 0; i < n; i++) {
      tags[i].style.left = particles[i].x + 'px';
      tags[i].style.top = particles[i].y + 'px';
    }

    // render neighbor lines
    for (let s = 0; s < springs.length; s++) {
      const [a, b] = springs[s];
      lines[s].setAttribute('x1', particles[a].x);
      lines[s].setAttribute('y1', particles[a].y);
      lines[s].setAttribute('x2', particles[b].x);
      lines[s].setAttribute('y2', particles[b].y);
    }

    // render title lines
    for (let c = 0; c < topRowCount; c++) {
      titleLines[c].setAttribute('x1', tc.x);
      titleLines[c].setAttribute('y1', tc.y);
      titleLines[c].setAttribute('x2', particles[c].x);
      titleLines[c].setAttribute('y2', particles[c].y);
    }

    requestAnimationFrame(step);
  }

  step();
}

window.addEventListener('load', () => {
    initGroup('inner-teaching','svg-teaching','title-teaching',
      ['tag-teaching-0','tag-teaching-1','tag-teaching-2','tag-teaching-3','tag-teaching-4','tag-teaching-5'],2);
    initGroup('inner-making','svg-making','title-making',
       ['tag-making-0','tag-making-1','tag-making-2','tag-making-3','tag-making-4','tag-making-5'],2);
    initGroup('inner-bridge','svg-bridge','title-bridge',
      ['tag-bridge-0','tag-bridge-1','tag-bridge-2','tag-bridge-3','tag-bridge-4','tag-bridge-5'],2);
});