/* DN1010 Experimental Interaction, Ashley Hi 2026
 * Week 7 - Drawable Canvas to Image
 * Styles cycle per click: acrylic → watercolor → oil → charcoal → repeat
 * Each click varies parameters; after a few clicks, abstraction ramps up.
 */

let statusMsg;
let drawArea;
let clearBtn;
let convertBtn;
let brushColor;
let brushSize;
let convertedImg;

// ── Style cycle order
const STYLES       = ["acrylic", "watercolor", "oil", "charcoal"];
const STYLE_LABELS = ["Acrylic Paint", "Watercolor", "Oil Painting", "Charcoal"];
const STYLE_ICONS  = ["🎨", "💧", "🖌️", "✏️"];

// ── State
let originalDrawing = null;
let clickCount      = 0;
let variant         = {};

// ── Abstraction ramp
const ABSTRACT_START = 3;
const ABSTRACT_FULL  = 12;

// ──────────────────────────────────────────────
function setup() {
  statusMsg    = select("#statusMsg");
  drawArea     = select("#drawArea");
  clearBtn     = select("#clearBtn");
  convertBtn   = select("#convertBtn");
  brushColor   = select("#brushColor");
  brushSize    = select("#brushSize");
  convertedImg = select("#convertedImg");

  const w = Math.max(320, drawArea.elt.clientWidth);
  const h = Math.max(300, drawArea.elt.clientHeight);
  const cnv = createCanvas(w, h);
  cnv.parent("drawArea");

  background(255);
  stroke(32);
  strokeWeight(6);
  noFill();
  statusMsg.html("Ready to draw.");

  clearBtn.mousePressed(clearCanvas);
  convertBtn.mousePressed(convertCanvasToImage);
}

function windowResized() {
  const w = Math.max(320, drawArea.elt.clientWidth);
  const h = Math.max(300, drawArea.elt.clientHeight);
  const snap = get();
  resizeCanvas(w, h);
  background(255);
  image(snap, 0, 0, width, height);
}

function mouseDragged() {
  if (!isPointerInsideCanvas()) return;
  stroke(brushColor.value());
  strokeWeight(Number(brushSize.value()));
  line(pmouseX, pmouseY, mouseX, mouseY);
}

function keyPressed() {
  if (key === "c" || key === "C") clearCanvas();
}

function clearCanvas() {
  originalDrawing = null;
  clickCount      = 0;
  background(255);
  statusMsg.html("Canvas cleared. Ready to draw.");
}

// ──────────────────────────────────────────────
// MAIN CONVERT
// ──────────────────────────────────────────────
function convertCanvasToImage() {
  if (!originalDrawing) {
    originalDrawing = get();
  }

  image(originalDrawing, 0, 0);

  let snapshot = originalDrawing.get();
  snapshot.loadPixels();

  clickCount++;
  const styleIndex = (clickCount - 1) % STYLES.length;
  const style      = STYLES[styleIndex];

  const abstraction = constrain(
    map(clickCount, ABSTRACT_START, ABSTRACT_FULL, 0, 1), 0, 1
  );
  const absMult = 1 + abstraction * 3;

  let seed = floor(millis()) % 1000000;
  randomSeed(seed);
  noiseSeed(seed);

  variant = {
    abstraction,
    angleOffset : random(TWO_PI),
    noiseScale  : random(0.006, 0.006 + 0.04  * abstraction),
    strokeLen   : random(0.6,   0.6   + absMult),
    strokeWeight: random(0.7,   0.7   + absMult * 0.6),
    warmth      : random(-30  * absMult, 30   * absMult),
    satBoost    : random(1.0,   1.0   + abstraction * 1.2),
    density     : random(0.6,   0.6   + abstraction * 1.4),
    edgeSens    : random(30   + abstraction * 50, 80 + abstraction * 120),
    posJitter   : abstraction * random(30, 80),
    colorJitter : abstraction * random(0,  120),
    swirl       : abstraction * random(0,  4),
  };

  if      (style === "acrylic")    renderAcrylic(snapshot);
  else if (style === "watercolor") renderWatercolor(snapshot);
  else if (style === "oil")        renderOil(snapshot);
  else if (style === "charcoal")   renderCharcoal(snapshot);

  const pct   = floor(abstraction * 100);
  const level = pct === 0 ? "grounded"
              : pct < 40  ? "loosening"
              : pct < 75  ? "abstract"
              :              "fully abstract";
  const nextLabel = STYLE_LABELS[clickCount % STYLES.length];
  statusMsg.html(
    STYLE_ICONS[styleIndex] + " <b>" + STYLE_LABELS[styleIndex] + "</b>" +
    " — click #" + clickCount + ", " + level + " (" + pct + "% abstract)<br>" +
    "<small>Next: " + nextLabel + "</small>"
  );
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
function sampleColor(snap, x, y) {
  let px = constrain(floor(x), 0, width  - 1);
  let py = constrain(floor(y), 0, height - 1);
  let i  = (px + py * width) * 4;
  let r = snap.pixels[i], g = snap.pixels[i+1], b = snap.pixels[i+2];
  if (r > 240 && g > 240 && b > 240) return null;
  return [r, g, b];
}

function sampleGray(snap, x, y) {
  let px = constrain(floor(x), 0, width  - 1);
  let py = constrain(floor(y), 0, height - 1);
  let i  = (px + py * width) * 4;
  return snap.pixels[i]*0.299 + snap.pixels[i+1]*0.587 + snap.pixels[i+2]*0.114;
}

function detectEdge(snap, x, y) {
  let tl=sampleGray(snap,x-1,y-1), tc=sampleGray(snap,x,y-1), tr=sampleGray(snap,x+1,y-1);
  let ml=sampleGray(snap,x-1,y),                               mr=sampleGray(snap,x+1,y);
  let bl=sampleGray(snap,x-1,y+1), bc=sampleGray(snap,x,y+1), br=sampleGray(snap,x+1,y+1);
  let gx = -tl - 2*ml - bl + tr + 2*mr + br;
  let gy = -tl - 2*tc - tr + bl + 2*bc + br;
  return sqrt(gx*gx + gy*gy);
}

function boostSaturation(r, g, b, factor) {
  let avg = (r+g+b)/3;
  return [
    constrain(avg + (r-avg)*factor, 0, 255),
    constrain(avg + (g-avg)*factor, 0, 255),
    constrain(avg + (b-avg)*factor, 0, 255),
  ];
}

function desaturate(r, g, b, factor) {
  let avg = (r+g+b)/3;
  return [
    constrain(avg + (r-avg)*factor, 0, 255),
    constrain(avg + (g-avg)*factor, 0, 255),
    constrain(avg + (b-avg)*factor, 0, 255),
  ];
}

function jitteredSample(snap, x, y) {
  let sx = x + random(-variant.posJitter, variant.posJitter);
  let sy = y + random(-variant.posJitter, variant.posJitter);
  return sampleColor(snap, sx, sy) || sampleColor(snap, x, y);
}

function applyTemperature(r, g, b) {
  let cj = random(-variant.colorJitter, variant.colorJitter);
  return [
    constrain(r + variant.warmth     + cj,       0, 255),
    constrain(g                      + cj * 0.4, 0, 255),
    constrain(b - variant.warmth*0.5 + cj,       0, 255),
  ];
}

function isPointerInsideCanvas() {
  return mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
}

// ──────────────────────────────────────────────
// STYLE 1 — ACRYLIC
// ──────────────────────────────────────────────
function renderAcrylic(snap) {
  background(
    constrain(245 + variant.warmth*0.4, 220, 255),
    constrain(238 + variant.warmth*0.2, 215, 255),
    constrain(224 - variant.warmth*0.3, 200, 245)
  );
  noFill(); strokeCap(ROUND); strokeJoin(ROUND);
  const ns = variant.noiseScale, ao = variant.angleOffset;

  for (let i = 0; i < floor(2200 * variant.density); i++) {
    let x = random(width), y = random(height);
    let col = jitteredSample(snap, x, y); if (!col) continue;
    let d = dist(x, y, width/2, height/2);
    let angle = noise(x*ns, y*ns)*TWO_PI + ao + variant.swirl*(d/width);
    let [r,g,b] = applyTemperature(...boostSaturation(...col, variant.satBoost));
    stroke(r, g, b, 210);
    strokeWeight(random(9, 22) * variant.strokeWeight);
    line(x, y, x+cos(angle)*random(28,70)*variant.strokeLen, y+sin(angle)*random(28,70)*variant.strokeLen);
  }

  for (let i = 0; i < floor(3000 * variant.density); i++) {
    let x = random(width), y = random(height);
    let col = jitteredSample(snap, x, y); if (!col) continue;
    let d = dist(x, y, width/2, height/2);
    let angle = noise(x*ns*1.4, y*ns*1.4, 10)*TWO_PI + ao + variant.swirl*(d/width)*0.7;
    let [r,g,b] = applyTemperature(...boostSaturation(...col, variant.satBoost*0.92));
    let v = random(-20,20);
    stroke(constrain(r+v,0,255), constrain(g+v,0,255), constrain(b+v,0,255), 220);
    strokeWeight(random(4, 11) * variant.strokeWeight);
    line(x, y, x+cos(angle)*random(14,38)*variant.strokeLen, y+sin(angle)*random(14,38)*variant.strokeLen);
  }

  for (let x = 2; x < width-2; x += 3) {
    for (let y = 2; y < height-2; y += 3) {
      let col = sampleColor(snap, x, y); if (!col) continue;
      if (detectEdge(snap,x,y) < variant.edgeSens) continue;
      let [r,g,b] = boostSaturation(...col, variant.satBoost*1.05);
      stroke(r*0.6, g*0.6, b*0.6, 180);
      strokeWeight(random(1.5, 4) * variant.strokeWeight);
      let angle = atan2(sampleGray(snap,x,y+1)-sampleGray(snap,x,y-1),
                        sampleGray(snap,x+1,y)-sampleGray(snap,x-1,y)) + HALF_PI + ao*0.1;
      line(x, y, x+cos(angle)*random(4,12)*variant.strokeLen, y+sin(angle)*random(4,12)*variant.strokeLen);
    }
  }

  for (let i = 0; i < floor(600 * variant.density); i++) {
    let x = random(width), y = random(height);
    if (!sampleColor(snap,x,y)) continue;
    if (detectEdge(snap,x,y) < variant.edgeSens*0.6) continue;
    stroke(255, 252, 245, random(60,130));
    strokeWeight(random(1,3) * variant.strokeWeight);
    let a = noise(x*0.02, y*0.02, 99)*TWO_PI + ao;
    line(x, y, x+cos(a)*random(4,14)*variant.strokeLen, y+sin(a)*random(4,14)*variant.strokeLen);
  }

  if (variant.abstraction > 0.2) {
    for (let i = 0; i < floor(variant.abstraction * 900); i++) {
      let x = random(width), y = random(height);
      let col = sampleColor(snap,x,y) || [random(80,220), random(80,220), random(80,220)];
      let [r,g,b] = applyTemperature(...boostSaturation(...col, variant.satBoost*1.3));
      stroke(r, g, b, random(80,180)*variant.abstraction);
      strokeWeight(random(2,20)*variant.strokeWeight*variant.abstraction);
      let a = noise(x*ns*2, y*ns*2, 200)*TWO_PI + ao + variant.swirl;
      line(x, y, x+cos(a)*random(20,140)*variant.strokeLen, y+sin(a)*random(20,140)*variant.strokeLen);
    }
  }

  noStroke();
  for (let i = 0; i < 3000; i++) {
    fill(120, 100, 70, random(2,6));
    rect(random(width), random(height), 1, 1);
  }
}

// ──────────────────────────────────────────────
// STYLE 2 — WATERCOLOR
// ──────────────────────────────────────────────
function renderWatercolor(snap) {
  background(
    constrain(250 + variant.warmth*0.3, 235, 255),
    constrain(246 + variant.warmth*0.1, 232, 255),
    constrain(238 - variant.warmth*0.2, 220, 255)
  );
  noStroke();
  const satF = map(variant.satBoost, 1.0, 2.2, 0.75, 1.0);
  const ao   = variant.angleOffset;

  for (let i = 0; i < floor(1400 * variant.density); i++) {
    let x = random(width), y = random(height);
    let col = jitteredSample(snap, x, y); if (!col) continue;
    let [r,g,b] = applyTemperature(...desaturate(...col, satF));
    fill(r, g, b, random(18,38));
    push();
    translate(x+random(-8,8), y+random(-8,8));
    rotate(random(TWO_PI)+ao);
    let sz = random(22,65)*variant.strokeLen;
    ellipse(0, 0, sz*random(0.7,1.4), sz*random(0.5,1.0));
    pop();
  }

  for (let i = 0; i < floor(800 * variant.density); i++) {
    let x = random(width), y = random(height);
    let col = jitteredSample(snap, x, y); if (!col) continue;
    let [r,g,b] = applyTemperature(...desaturate(...col, satF*1.05));
    let steps = floor(random(4,10));
    for (let s = 0; s < steps; s++) {
      let t = s/steps;
      fill(lerp(r,250,t), lerp(g,246,t), lerp(b,238,t), random(10,25)*(1-t));
      let spread = random(6,18)*variant.strokeLen*(1+t*2);
      ellipse(x+random(-spread,spread), y+random(-spread,spread), spread*0.8, spread*0.6);
    }
  }

  strokeCap(ROUND);
  for (let x = 1; x < width-1; x += 2) {
    for (let y = 1; y < height-1; y += 2) {
      let col = sampleColor(snap, x, y); if (!col) continue;
      if (detectEdge(snap,x,y) < variant.edgeSens) continue;
      stroke(col[0]*0.5, col[1]*0.5, col[2]*0.5, random(50,110));
      strokeWeight(random(0.5,1.8)*variant.strokeWeight);
      noFill();
      point(x+random(-1,1), y+random(-1,1));
    }
  }

  if (variant.abstraction > 0.2) {
    noStroke();
    for (let i = 0; i < floor(variant.abstraction * 700); i++) {
      let x = random(width), y = random(height);
      let col = sampleColor(snap,x,y) || [random(100,220), random(100,220), random(150,220)];
      let [r,g,b] = applyTemperature(...col);
      fill(r, g, b, random(15,50)*variant.abstraction);
      let sz = random(30,160)*variant.strokeLen*variant.abstraction;
      ellipse(x+random(-variant.posJitter*2,variant.posJitter*2),
              y+random(-variant.posJitter*2,variant.posJitter*2), sz, sz*random(0.4,0.9));
    }
  }

  noStroke();
  for (let i = 0; i < 5000; i++) {
    fill(160, 140, 110, random(2,7));
    rect(random(width), random(height), 1, 1);
  }
}

// ──────────────────────────────────────────────
// STYLE 3 — OIL PAINTING
// ──────────────────────────────────────────────
function renderOil(snap) {
  background(
    constrain(235 + variant.warmth*0.5, 210, 255),
    constrain(225 + variant.warmth*0.2, 205, 255),
    constrain(205 - variant.warmth*0.4, 180, 235)
  );
  strokeCap(ROUND); noFill();
  const ns = variant.noiseScale, ao = variant.angleOffset;

  for (let i = 0; i < floor(1800 * variant.density); i++) {
    let x = random(width), y = random(height);
    let col = jitteredSample(snap, x, y); if (!col) continue;
    let d = dist(x, y, width/2, height/2);
    let angle = noise(x*ns*0.8, y*ns*0.8)*TWO_PI + ao + variant.swirl*(d/width);
    let len   = random(40,100)*variant.strokeLen;
    let [r,g,b] = applyTemperature(...boostSaturation(...col, variant.satBoost*0.9));
    stroke(r, g, b, 160);
    strokeWeight(random(12,28)*variant.strokeWeight);
    for (let s = 0; s < 3; s++) {
      let a2 = angle+random(-0.3,0.3);
      let sx = x+cos(angle)*len*0.33*s, sy = y+sin(angle)*len*0.33*s;
      line(sx, sy, sx+cos(a2)*len*0.33, sy+sin(a2)*len*0.33);
    }
  }

  for (let i = 0; i < floor(3500 * variant.density); i++) {
    let x = random(width), y = random(height);
    let col = jitteredSample(snap, x, y); if (!col) continue;
    let d = dist(x, y, width/2, height/2);
    let angle = noise(x*ns, y*ns, 5)*TWO_PI + ao + variant.swirl*(d/width)*0.7;
    let len   = random(18,50)*variant.strokeLen;
    let [r,g,b] = applyTemperature(...boostSaturation(...col, variant.satBoost));
    let v = random(-30,30);
    stroke(constrain(r+v,0,255), constrain(g+v,0,255), constrain(b+v,0,255), 190);
    strokeWeight(random(4,12)*variant.strokeWeight);
    line(x, y, x+cos(angle)*len, y+sin(angle)*len);
  }

  for (let x = 2; x < width-2; x += 3) {
    for (let y = 2; y < height-2; y += 3) {
      let col = sampleColor(snap, x, y); if (!col) continue;
      if (detectEdge(snap,x,y) < variant.edgeSens*0.7) continue;
      stroke(col[0]*0.3, col[1]*0.3, col[2]*0.3, 120);
      strokeWeight(random(1,3.5)*variant.strokeWeight);
      let a = atan2(sampleGray(snap,x,y+1)-sampleGray(snap,x,y-1),
                    sampleGray(snap,x+1,y)-sampleGray(snap,x-1,y)) + ao*0.05;
      line(x, y, x+cos(a)*random(3,9)*variant.strokeLen, y+sin(a)*random(3,9)*variant.strokeLen);
    }
  }

  for (let i = 0; i < floor(500 * variant.density); i++) {
    let x = random(width), y = random(height);
    if (!sampleColor(snap,x,y)) continue;
    stroke(255, 248, 230, random(40,100));
    strokeWeight(random(1.5,4)*variant.strokeWeight);
    let a = random(TWO_PI)+ao;
    line(x, y, x+cos(a)*random(4,12)*variant.strokeLen, y+sin(a)*random(4,12)*variant.strokeLen);
  }

  if (variant.abstraction > 0.2) {
    for (let i = 0; i < floor(variant.abstraction * 800); i++) {
      let x = random(width), y = random(height);
      let col = sampleColor(snap,x,y) || [random(80,200), random(60,180), random(40,160)];
      let [r,g,b] = applyTemperature(...boostSaturation(...col, variant.satBoost*1.2));
      stroke(r, g, b, random(60,160)*variant.abstraction);
      strokeWeight(random(3,24)*variant.strokeWeight*variant.abstraction);
      let a = noise(x*ns*2, y*ns*2, 300)*TWO_PI + ao + variant.swirl;
      line(x, y, x+cos(a)*random(30,150)*variant.strokeLen, y+sin(a)*random(30,150)*variant.strokeLen);
    }
  }
}

// ──────────────────────────────────────────────
// STYLE 4 — CHARCOAL / GRAPHITE
// ──────────────────────────────────────────────
function renderCharcoal(snap) {
  background(
    constrain(240 + variant.warmth*0.2, 220, 255),
    constrain(237 + variant.warmth*0.1, 218, 255),
    constrain(230 - variant.warmth*0.2, 210, 250)
  );
  strokeCap(ROUND); noFill();
  const ns = variant.noiseScale, ao = variant.angleOffset;

  for (let i = 0; i < floor(2000 * variant.density); i++) {
    let x = random(width), y = random(height);
    let col = jitteredSample(snap, x, y); if (!col) continue;
    let gray = col[0]*0.299 + col[1]*0.587 + col[2]*0.114;
    let dark = map(gray, 0, 255, 10, 160);
    let d = dist(x, y, width/2, height/2);
    let angle = noise(x*ns, y*ns)*TWO_PI + ao + variant.swirl*(d/width);
    let rr = constrain(dark + variant.warmth*0.3, 0, 200);
    let bb = constrain(dark - variant.warmth*0.2, 0, 200);
    stroke(rr, dark*0.95, bb*0.9, random(40,90));
    strokeWeight(random(6,18)*variant.strokeWeight);
    line(x, y, x+cos(angle)*random(20,60)*variant.strokeLen, y+sin(angle)*random(20,60)*variant.strokeLen);
  }

  for (let x = 1; x < width-1; x += 2) {
    for (let y = 1; y < height-1; y += 2) {
      let col = sampleColor(snap, x, y); if (!col) continue;
      if (detectEdge(snap,x,y) < variant.edgeSens*0.8) continue;
      let gray = col[0]*0.299 + col[1]*0.587 + col[2]*0.114;
      let dark = map(gray, 0, 255, 5, 80);
      stroke(dark, dark*0.95, dark*0.88, random(120,200));
      strokeWeight(random(0.8,2.5)*variant.strokeWeight);
      let a = atan2(sampleGray(snap,x,y+1)-sampleGray(snap,x,y-1),
                    sampleGray(snap,x+1,y)-sampleGray(snap,x-1,y)) + HALF_PI + ao*0.1;
      line(x, y, x+cos(a)*random(3,8)*variant.strokeLen, y+sin(a)*random(3,8)*variant.strokeLen);
    }
  }

  for (let i = 0; i < floor(3000 * variant.density); i++) {
    let x = random(width), y = random(height);
    let col = jitteredSample(snap, x, y); if (!col) continue;
    let gray = col[0]*0.299 + col[1]*0.587 + col[2]*0.114;
    if (gray > 140) continue;
    let dark = map(gray, 0, 140, 10, 80);
    stroke(dark, dark, dark*0.9, random(60,140));
    strokeWeight(random(0.5,1.5)*variant.strokeWeight);
    let angle = floor(random(4))*QUARTER_PI + ao;
    line(x, y, x+cos(angle)*random(6,18)*variant.strokeLen, y+sin(angle)*random(6,18)*variant.strokeLen);
  }

  if (variant.abstraction > 0.2) {
    for (let i = 0; i < floor(variant.abstraction * 700); i++) {
      let x = random(width), y = random(height);
      let col = sampleColor(snap,x,y) || [60, 60, 60];
      let gray = col[0]*0.299 + col[1]*0.587 + col[2]*0.114;
      let dark = map(gray, 0, 255, 5, 120) * (0.5 + variant.abstraction*0.5);
      stroke(constrain(dark+variant.warmth*0.3,0,200), dark,
             constrain(dark-variant.warmth*0.2,0,200), random(80,180)*variant.abstraction);
      strokeWeight(random(2,16)*variant.strokeWeight*variant.abstraction);
      let a = noise(x*ns*2, y*ns*2, 400)*TWO_PI + ao + variant.swirl;
      line(x, y, x+cos(a)*random(15,100)*variant.strokeLen, y+sin(a)*random(15,100)*variant.strokeLen);
    }
  }

  noStroke();
  for (let i = 0; i < 4000; i++) {
    fill(100, 95, 85, random(2,8));
    rect(random(width), random(height), 1, 1);
  }
}