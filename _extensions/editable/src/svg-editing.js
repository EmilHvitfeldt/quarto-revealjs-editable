/** Edit vector parts in place; persist inline SVG in QMD, never generated assets. */
import { editableRegistry } from './editable-element.js';
import { pushUndoState } from './undo.js';
import { splitIntoSlideChunks } from './serialization.js';
import { getCurrentSlideIndex, getQmdHeadingIndex, getSlideScale } from './utils.js';
import { svgOccurrences, replaceSVGSource } from './svg-source.js';
import { htmlTextElements, patchHtmlOpening } from './text-source.js';
import { combinedSVGMatrix, identityMatrix, inverseMatrix, resizeSVGState, svgStateMatrix } from './svg-geometry.js';

const NS = 'http://www.w3.org/2000/svg';
const diagrams = new WeakMap();
const identities = new Map();
const repaired = new WeakSet();
let mode = false, order = 0;
let selected = null, controls = null;
const blocked = 'defs, marker, clipPath, mask, pattern, symbol, script, style, .editable-toolbar';
const visible = () => document.documentElement.classList.contains('presentation-editor-visible');

export function svgPartsEnabled() { return mode; }
export function setSVGPartsEnabled(value) {
  mode = value;
  document.querySelector('.reveal')?.classList.toggle('editable-svg-mode', mode);
  document.querySelector('.toolbar-diagram-parts')?.classList.toggle('active', mode);
  updateControls();
}

function partBounds(part) {
  if (part.frame) {
    const b = part.data.root.viewBox.baseVal;
    return { x:b.x, y:b.y, width:b.width, height:b.height };
  }
  const boxes = part.members.map(bounds).filter(Boolean);
  if (!boxes.length) return null;
  const x=Math.min(...boxes.map(b=>b.x)), y=Math.min(...boxes.map(b=>b.y));
  return { x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y };
}

function updateControls() {
  if (!controls) return;
  const active = selected?.current() && visible() && (selected.part.frame ? !mode : mode)
    && selected.element.isConnected && selected.element.closest('section')?.classList.contains('present');
  controls.hidden = !active;
  if (!active) return;
  const b=partBounds(selected.part), matrix=selected.part.data.root.getScreenCTM();
  if (!b || !matrix) { controls.hidden=true; return; }
  const points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]]
    .map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
  const left=Math.min(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y));
  const width=Math.max(...points.map(p=>p.x))-left,height=Math.max(...points.map(p=>p.y))-top;
  Object.assign(controls.style, { left:`${left-Math.max(0,12-width)/2}px`, top:`${top-Math.max(0,12-height)/2}px`, width:`${Math.max(12,width)}px`, height:`${Math.max(12,height)}px` });
}

function resizeControls() {
  if (controls) return controls;
  controls=document.createElement('div');
  controls.className='editable-toolbar editable-svg-controls';
  controls.setAttribute('aria-label','Resize selected diagram part');
  for (const handle of ['nw','n','ne','e','se','s','sw','w']) {
    const button=document.createElement('button');
    button.type='button';button.className=`editable-svg-resize-handle handle-${handle}`;
    button.dataset.handle=handle;button.setAttribute('aria-label',`Resize diagram ${handle}`);
    for (const event of ['mousedown','touchstart']) button.addEventListener(event,e=>selected?.beginResize(e,handle),{passive:false});
    controls.append(button);
  }
  document.body.append(controls);
  window.addEventListener('resize',updateControls);
  document.addEventListener('scroll',updateControls,true);
  document.addEventListener('editable-content-restored',updateControls);
  const deselect=event=>{
    if(event.target.closest?.('svg[data-editable-svg-id], .editable-toolbar'))return;
    selected?.element.classList.remove('editable-svg-selected');selected=null;updateControls();
  };
  document.addEventListener('mousedown',deselect);document.addEventListener('touchstart',deselect,{passive:true});
  window.Reveal?.on('slidechanged',updateControls);
  window.Reveal?.on('fragmentshown',updateControls);
  window.Reveal?.on('fragmenthidden',updateControls);
  return controls;
}

function transformedMember(data, member, stateFor) {
  const parent=member.parentElement.getScreenCTM(),root=data.root.getScreenCTM();
  if (!parent || !root) return null;
  const svgMatrix=parent.inverse().multiply(root);
  // getScreenCTM still returns legacy SVGMatrix in some browsers; its
  // multiply() rejects DOMMatrix, so convert before composing edit transforms.
  const fromRoot=new DOMMatrix([svgMatrix.a,svgMatrix.b,svgMatrix.c,svgMatrix.d,svgMatrix.e,svgMatrix.f]);
  const delta=new DOMMatrix(combinedSVGMatrix(data.parts,member,stateFor));
  const m=fromRoot.multiply(delta).multiply(fromRoot.inverse());
  return `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f}) ${data.baselines.get(member)}`.trim();
}

function partPrefixMatrix(part) {
  return combinedSVGMatrix(part.data.parts.slice(0,part.data.parts.indexOf(part)),part.node);
}

function scopeImportedSVG(root, identity, baseURL) {
  const ids = new Map([...root.querySelectorAll('[id]')].map(node => [node.id, `${identity}-${node.id}`]));
  if (root.id) ids.set(root.id, `${identity}-${root.id}`);
  for (const node of [root, ...root.querySelectorAll('*')]) {
    if(node.id)node.dataset.editableSvgRef=node.id;
    for (const attr of [...node.attributes]) {
      let value = attr.value.replace(/url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/g, (all, id) => ids.has(id) ? `url(#${ids.get(id)})` : all);
      if (attr.name === 'id') value = ids.get(value) || value;
      if (attr.name === 'aria-labelledby' || attr.name === 'aria-describedby') value = value.split(/\s+/).map(id => ids.get(id) || id).join(' ');
      if (attr.localName === 'href') {
        if (value.startsWith('#')) value = `#${ids.get(value.slice(1)) || value.slice(1)}`;
        else if (!/^(?:data:|https?:|\/)/i.test(value)) {
          const resolved = new URL(value, baseURL);
          const directory = new URL('.', document.baseURI);
          value = resolved.href.startsWith(directory.href) ? resolved.href.slice(directory.href.length) : resolved.href;
        }
      }
      node.setAttributeNS(attr.namespaceURI, attr.name, value);
    }
  }
  root.dataset.editableSvgId = identity;
  for(const node of root.querySelectorAll('[data-editable-svg-ref]'))node.dataset.editableSvgName=node.id;
  // External SVG styles were isolated by the image document. Keep that scope
  // after inlining so text, colors and marker references cannot leak between diagrams.
  for (const style of root.querySelectorAll('style')) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(style.textContent.replace(/url\(\s*#([^\s)]+)\s*\)/g, (all, id) => ids.has(id) ? `url(#${ids.get(id)})` : all));
    const scope = rules => [...rules].map(rule => {
      if (rule.selectorText) return `[data-editable-svg-id="${identity}"] :is(${rule.selectorText}) {${rule.style.cssText}}`;
      if (rule.cssRules && rule.conditionText) return `${rule.cssText.slice(0, rule.cssText.indexOf('{'))}{${scope(rule.cssRules)}}`;
      return rule.cssText;
    }).join('\n');
    style.textContent = scope(sheet.cssRules);
  }
}

/** Deck down-slide clones may drop IDs. Recreate private marker/clip IDs. */
export function initializeSVGReferences(scope=document) {
  for(const root of scope.querySelectorAll('svg[data-editable-svg-id]')) {
    if(repaired.has(root))continue;
    const nodes=[...root.querySelectorAll('[data-editable-svg-ref]')],prefix=`${root.dataset.editableSvgId}-${crypto.randomUUID()}`;
    const names=new Map(nodes.map(node=>[node.dataset.editableSvgName,`${prefix}-${node.dataset.editableSvgRef}`]));
    for(const node of nodes){node.id=names.get(node.dataset.editableSvgName);node.dataset.editableSvgName=node.id;}
    const update=value=>value.replace(/url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/g,(all,id)=>names.has(id)?`url(#${names.get(id)})`:all);
    for(const node of [root,...root.querySelectorAll('*')]) {
      for(const attr of [...node.attributes]) {
        let value=update(attr.value);
        if(attr.localName==='href'&&value.startsWith('#')&&names.has(value.slice(1)))value=`#${names.get(value.slice(1))}`;
        if(attr.name==='aria-labelledby'||attr.name==='aria-describedby')value=value.split(/\s+/).map(id=>names.get(id)||id).join(' ');
        if(value!==attr.value)node.setAttributeNS(attr.namespaceURI,attr.name,value);
      }
      if(node.localName==='style')node.textContent=update(node.textContent);
    }
    repaired.add(root);
  }
}

async function inlineImage(image, identity) {
  const src = image.getAttribute('src') || image.getAttribute('data-src');
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Cannot load diagram: ${response.status}`);
  const xml = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
  if (xml.querySelector('parsererror') || xml.documentElement.localName !== 'svg') throw new Error('Invalid SVG diagram');
  const root = document.importNode(xml.documentElement, true);
  scopeImportedSVG(root, identity, new URL(src, document.baseURI));
  const computed = getComputedStyle(image);
  const originalStyle = root.getAttribute('style') || '';
  root.setAttribute('class', image.className);
  root.classList.remove('r-stretch', 'stretch');
  root.setAttribute('style', `${originalStyle};${image.getAttribute('style') || ''}`);
  for (const key of ['width', 'height', 'display', 'position', 'left', 'top', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'verticalAlign', 'objectFit', 'transform', 'transformOrigin', 'gridArea', 'alignSelf', 'justifySelf', 'flexGrow', 'flexShrink', 'flexBasis']) root.style[key] = computed[key];
  root.style.maxWidth = 'none'; root.style.maxHeight = 'none';
  root.style.boxShadow = computed.boxShadow;
  if (image.id) root.id = image.id;
  if (image.getAttribute('alt')) root.setAttribute('aria-label', image.getAttribute('alt'));
  for (const attribute of [...image.attributes]) if (attribute.name.startsWith('data-fragment')) root.setAttribute(attribute.name, attribute.value);
  if (!root.hasAttribute('viewBox')) root.setAttribute('viewBox', `0 0 ${parseFloat(root.getAttribute('width')) || image.naturalWidth} ${parseFloat(root.getAttribute('height')) || image.naturalHeight}`);
  image.replaceWith(root);
  return root;
}

function bounds(element) {
  try {
    if(element.localName==='svg') {
      // A nested SVG's client rectangle includes its off-viewport artwork.
      // Group by the authored crop viewport, rather than that overflow.
      const m=element.parentElement.getScreenCTM(),inverse=element.ownerSVGElement.getScreenCTM().inverse();
      const x=element.x.baseVal.value,y=element.y.baseVal.value;
      const a=new DOMPoint(x,y).matrixTransform(m).matrixTransform(inverse),z=new DOMPoint(x+element.width.baseVal.value,y+element.height.baseVal.value).matrixTransform(m).matrixTransform(inverse);
      return{x:a.x,y:a.y,width:z.x-a.x,height:z.y-a.y};
    }
    const b = element.getBBox(), m = element.getScreenCTM(), root = element.ownerSVGElement;
    if (!m || !root) return null;
    const inverse = root.getScreenCTM()?.inverse();
    if (!inverse) return null;
    const points = [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y]) => new DOMPoint(x,y).matrixTransform(m).matrixTransform(inverse));
    return { x: Math.min(...points.map(p=>p.x)), y: Math.min(...points.map(p=>p.y)), width: Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)), height: Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y)) };
  } catch { return null; }
}
const contains = (a,b,pad=2) => b.x >= a.x-pad && b.y >= a.y-pad && b.x+b.width <= a.x+a.width+pad && b.y+b.height <= a.y+a.height+pad;

function buildParts(root) {
  const primitives = [...root.querySelectorAll('g.node, g.edge, g.cluster, [data-diagram-part], rect, path, line, polyline, polygon, circle, ellipse, text, image, svg')].filter(node => !node.closest(blocked) && node.ownerSVGElement === root && !node.parentElement.closest('g.node, g.edge, g.cluster, [data-diagram-part]'));
  const cached=new Map(primitives.map(node=>[node,bounds(node)])),boxOf=node=>cached.get(node);
  const view = root.viewBox.baseVal;
  const page = node => {const b=boxOf(node);return node.localName==='rect'&&b&&b.width>=view.width*.95&&b.height>=view.height*.95;};
  const boxes = primitives.filter(node => ['rect','g'].includes(node.localName) && boxOf(node) && !page(node));
  const decoration=node=>node.localName==='rect'&&getComputedStyle(node).fill==='none'&&boxes.some(box=>box!==node&&getComputedStyle(box).fill!=='none'&&contains(boxOf(box),boxOf(node),.1)&&contains(boxOf(node),boxOf(box),.1));
  const labels=new Map(primitives.filter(node=>node.localName==='text').map(node=>{
    const b=boxOf(node);
    const choices=boxes.filter(box=>{const bb=boxOf(box);return b&&Math.abs(b.x+b.width/2-(bb.x+bb.width/2))<12&&b.y+b.height<=bb.y&&bb.y-b.y-b.height<35;}).sort((a,b)=>boxOf(a).width*boxOf(a).height-boxOf(b).width*boxOf(b).height);
    return[node,choices[0]];
  }));
  const heads = new Set(), parts = [];
  for (const node of primitives) {
    if (heads.has(node)||decoration(node)) continue;
    const b = boxOf(node);
    if (!b || (!b.width && !b.height)) continue;
    // The page background is not a movable box.
    if (node.localName === 'rect' && b.width >= view.width*.95 && b.height >= view.height*.95) continue;
    if (boxes.some(box => box !== node && contains(boxOf(box), b) && !contains(b, boxOf(box)) && ['text','image','svg'].includes(node.localName))) continue;
    const members = [node];
    if (['rect','g'].includes(node.localName)) {
      for (const child of primitives) {
        if (child === node || child.contains(node) || node.contains(child)) continue;
        const cb = boxOf(child);
        if (!cb) continue;
        const isLabel = labels.get(child) === node;
        if (contains(b,cb) || isLabel) members.push(child);
      }
    }
    // Hand-authored arrows often use separate triangle heads, rather than markers.
    const next = node.nextElementSibling;
    if (['polyline','line','path'].includes(node.localName) && next && ['polygon','path'].includes(next.localName) && !heads.has(next) && !node.hasAttribute('marker-end')) {
      const nb = boxOf(next), fill = getComputedStyle(next).fill;
      if (nb && fill !== 'none' && nb.width < 40 && nb.height < 40 && contains({ x:b.x-25,y:b.y-25,width:b.width+50,height:b.height+50 }, nb)) {members.push(next);heads.add(next);}
    }
    parts.push({ node, members, state:{x:0,y:0,matrix:identityMatrix(),order:0} });
  }
  return parts;
}

function sourceIndex(slide) { return Number(slide.dataset.editableSourceIndex ?? getQmdHeadingIndex(getCurrentSlideIndex()) + 1); }

async function prepare(slide) {
  const chunkIndex = sourceIndex(slide), chunk = splitIntoSlideChunks(window._input_file || '')[chunkIndex];
  if (!chunk) return;
  const records = svgOccurrences(chunk);
  const candidates = [...slide.querySelectorAll('svg, img')].filter(node => !node.parentElement.closest('svg') && !node.closest('.editable-toolbar, .editable-arrow-container, .shape-wrapper, button, pre, code') && (node.localName==='svg' || /\.svg(?:[?#]|$)/i.test(node.getAttribute('src') || node.getAttribute('data-src') || '')));
  const used=new Set();
  for (const record of records) {
    const attr=name=>record.opening.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`,'i'))?.slice(1).find(value=>value!==undefined);
    let root=candidates.find(node=>!used.has(node)&&(record.kind==='image'
      ? (node.localName==='img'&&(node.getAttribute('src')||node.getAttribute('data-src'))===record.src)||diagrams.get(node)?.anchor.ordinal===record.ordinal
      : node.localName==='svg'&&(record.id?node.dataset.editableSvgId===record.id:(!attr('viewBox')||node.getAttribute('viewBox')===attr('viewBox'))&&(!attr('aria-label')||node.getAttribute('aria-label')===attr('aria-label')))));
    if(!root)continue;
    used.add(root);
    if (diagrams.has(root)) continue;
    const key = `${chunkIndex}:${record.ordinal}`;
    if (!identities.has(key)) identities.set(key, record.id || `diagram-${crypto.randomUUID()}`);
    const id = identities.get(key);
    const anchor = { ...record, id, key, chunkIndex };
    if (root.localName === 'img') {
      if(!mode)continue;
      // Existing image tools own activated media until a refresh.
      if (root.closest('.editable-container')) continue;
      try { root = await inlineImage(root, id); } catch(error) { console.warn(error); continue; }
    }
    root.dataset.editableSvgId = id;
    initializeSVGReferences(slide);
    const data = { root, anchor, parts: buildParts(root), baselines:new Map() };
    const translate=getComputedStyle(root).translate.split(/\s+/);
    const frameMatrix=root.getScreenCTM(), slideScale=getSlideScale(), frameStyle=getComputedStyle(root);
    data.frame={node:root,members:[root],data,key:`${key}:frame`,frame:true,state:{x:0,y:0,scaleX:1,scaleY:1,order:0},base:{
      x:parseFloat(translate[0])||0,y:parseFloat(translate[1])||0,
      width:parseFloat(frameStyle.width),height:parseFloat(frameStyle.height),
      a:frameMatrix.a/slideScale,b:frameMatrix.b/slideScale,c:frameMatrix.c/slideScale,d:frameMatrix.d/slideScale,
    }};
    diagrams.set(root, data);
    for (const [index, part] of data.parts.entries()) {
      part.key = `${key}:${index}`;
      part.data = data;
      for (const member of part.members) {
        if(!data.baselines.has(member))data.baselines.set(member,member.getAttribute('transform')||'');
      }
    }
    for(const [index,member]of [...data.baselines.keys()].entries()) {
      member.dataset.editableSvgMember=String(index);
      const choices=data.parts.filter(part=>part.members.includes(member));
      const primary=choices.find(part=>part.node===member)??choices.sort((a,b)=>{const aa=bounds(a.node),bb=bounds(b.node);return aa.width*aa.height-bb.width*bb.height;})[0];
      member.dataset.editableSvgPart=String(data.parts.indexOf(primary));
    }
  }
}

function cleanSVG(root) {
  const copy = root.cloneNode(true);
  for (const node of [copy,...copy.querySelectorAll('*')]) {
    for (const name of ['modify-mode-valid','modify-mode-warn','editable-svg-selected','editable-svg-target']) node.classList.remove(name);
    for (const name of ['tabindex','data-editable-svg-part','data-editable-svg-member']) node.removeAttribute(name);
    if(node.classList.contains('fragment'))node.classList.remove('visible','current-fragment');
    if (!node.getAttribute('class')) node.removeAttribute('class');
  }
  return copy;
}

class SVGPart {
  constructor(part) {
    this.part = part; this.element = part.node; this.container = part.node; this.type = 'svg-part';
    this.state = part.state;
    this.adoptLatest();
    this.element.classList.add('editable-svg-target');
    this.element.setAttribute('tabindex','0');
    this.attach();
  }
  getState() { return {...this.state,...(this.state.matrix ? {matrix:[...this.state.matrix]} : {})}; }
  syncFromDOM() {}
  getResizeHandles() { return [...resizeControls().querySelectorAll('button')]; }
  current() { return editableRegistry.get(this.element) === this; }
  adoptLatest() {
    const latest = [...editableRegistry.values()].filter(item=>item.type==='svg-part' && item.current() && item.part.key===this.part.key).sort((a,b)=>b.state.order-a.state.order)[0];
    if (latest && latest.state.order > this.state.order) this.setState(latest.state);
  }
  setState(state) {
    Object.assign(this.state,state);
    const data=this.part.data,root=data.root;
    if(this.part.frame) {
      const base=this.part.base;
      root.style.translate=`${base.x+base.a*this.state.x+base.c*this.state.y}px ${base.y+base.b*this.state.x+base.d*this.state.y}px`;
      root.style.width=`${base.width*(this.state.scaleX||1)}px`;root.style.height=`${base.height*(this.state.scaleY||1)}px`;
      const matrix=root.getScreenCTM(),scale=getSlideScale();
      for(const overlay of this.part.overlays||[]){
        const p=new DOMPoint(overlay.rootX,overlay.rootY).matrixTransform(matrix);
        overlay.node.style.translate=`${overlay.x+(p.x-overlay.screenX)/scale}px ${overlay.y+(p.y-overlay.screenY)/scale}px`;
        overlay.node.style.width=`${overlay.width*Math.hypot(matrix.a,matrix.b)/overlay.rootScaleX}px`;
        overlay.node.style.height=`${overlay.height*Math.hypot(matrix.c,matrix.d)/overlay.rootScaleY}px`;
      }
      updateControls();
      return;
    }
    // Native protocol insets are HTML siblings of the SVG design box.
    for (const overlay of this.part.overlays || []) {
      const m=svgStateMatrix(this.state),p=new DOMPoint(overlay.rootX,overlay.rootY).matrixTransform(new DOMMatrix(m));
      overlay.node.style.translate=`${overlay.x+(p.x-overlay.rootX)*overlay.scale}px ${overlay.y+(p.y-overlay.rootY)*overlay.scale}px`;
      overlay.node.style.width=`${overlay.width*Math.hypot(m[0],m[1])}px`;overlay.node.style.height=`${overlay.height*Math.hypot(m[2],m[3])}px`;
    }
    for (const member of this.part.members) {
      const transform=transformedMember(data,member);
      if(transform)member.setAttribute('transform',transform);
    }
    updateControls();
  }
  select() {
    document.querySelectorAll('.editable-svg-selected').forEach(n=>n.classList.remove('editable-svg-selected'));
    this.element.classList.add('editable-svg-selected');selected=this;resizeControls();updateControls();
  }
  beginResize(event, handle) {
    if(!this.current()||!visible()||(this.part.frame?mode:!mode)||event.button>0)return;
    this.adoptLatest();this.select();
    const matrix=this.part.data.root.getScreenCTM()?.inverse(),box=partBounds(this.part),p=event.touches?.[0]??event;
    if(!matrix||!box)return;
    this.resize={point:new DOMPoint(p.clientX,p.clientY).matrixTransform(matrix),matrix,box,handle,state:this.getState(),prefixMatrix:partPrefixMatrix(this.part),recorded:false};
    event.preventDefault();event.stopPropagation();
  }
  attach() {
    let drag=null;
    const begin = event => {
      if (!this.current() || !visible() || (this.part.frame ? mode : !mode) || event.button>0) return;
      this.adoptLatest(); this.select();
      const p=event.touches?.[0]??event,base=this.part.base,scale=getSlideScale();
      const matrix=this.part.frame
        ? new DOMMatrix([base.a*scale,base.b*scale,base.c*scale,base.d*scale,0,0]).inverse()
        : this.part.data.root.getScreenCTM()?.inverse();
      if (!matrix) return;
      const point=new DOMPoint(p.clientX,p.clientY).matrixTransform(matrix);
      drag={point,matrix,x:this.state.x,y:this.state.y,inversePrefix:inverseMatrix(partPrefixMatrix(this.part)),recorded:false};
      event.preventDefault();event.stopPropagation();
    };
    for (const member of this.part.members.filter(node=>this.part.frame||Number(node.dataset.editableSvgPart)===this.part.data.parts.indexOf(this.part))) { member.addEventListener('mousedown',begin); member.addEventListener('touchstart',begin,{passive:false}); }
    const move=event=>{
      if(this.resize&&this.current()) {
        const resize=this.resize,p=event.touches?.[0]??event,point=new DOMPoint(p.clientX,p.clientY).matrixTransform(resize.matrix),dx=point.x-resize.point.x,dy=point.y-resize.point.y;
        if(!resize.recorded){if(Math.hypot(dx,dy)<2)return;pushUndoState();resize.recorded=true;}
        if(this.part.frame) {
          const next=resizeSVGState({x:0,y:0},resize.box,resize.handle,dx,dy,{keepAspect:event.shiftKey,minSize:4}),m=next.matrix;
          this.setState({x:resize.state.x+m[4]*resize.state.scaleX,y:resize.state.y+m[5]*resize.state.scaleY,scaleX:resize.state.scaleX*m[0],scaleY:resize.state.scaleY*m[3],order:++order});
        } else this.setState({...resizeSVGState(resize.state,resize.box,resize.handle,dx,dy,{keepAspect:event.shiftKey,minSize:4,prefixMatrix:resize.prefixMatrix}),order:++order});
        event.preventDefault();return;
      }
      if(!drag||!this.current())return;
      const p=event.touches?.[0]??event,point=new DOMPoint(p.clientX,p.clientY).matrixTransform(drag.matrix),dx=point.x-drag.point.x,dy=point.y-drag.point.y;
      if(!drag.recorded){if(Math.hypot(dx,dy)<2)return;pushUndoState();drag.recorded=true;}
      const m=drag.inversePrefix;
      this.setState({x:drag.x+m[0]*dx+m[2]*dy,y:drag.y+m[1]*dx+m[3]*dy,order:++order});event.preventDefault();
    };
    document.addEventListener('mousemove',move);document.addEventListener('touchmove',move,{passive:false});
    const end=()=>{drag=null;this.resize=null;};
    document.addEventListener('mouseup',end);document.addEventListener('touchend',end);document.addEventListener('touchcancel',end);
    this.element.addEventListener('keydown',event=>{
      if(!this.current()||!visible()||(this.part.frame?mode:!mode))return;
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
      if(!delta||event.ctrlKey||event.metaKey)return;
      event.preventDefault();event.stopPropagation();this.adoptLatest();pushUndoState();
      const step=event.shiftKey?10:1,m=inverseMatrix(partPrefixMatrix(this.part));
      this.setState({x:this.state.x+(m[0]*delta[0]+m[2]*delta[1])*step,y:this.state.y+(m[1]*delta[0]+m[3]*delta[1])*step,order:++order});
    });
    this.select();
  }
}

export const svgClassifier = {
  label:'Diagram parts', prepare,
  classify(slide) {
    if(!mode)return{valid:[...slide.querySelectorAll('svg[data-editable-svg-id]')].filter(root=>diagrams.has(root)&&!editableRegistry.has(root)),warn:[]};
    return {valid:[...slide.querySelectorAll('svg[data-editable-svg-id]')].flatMap(root=>{const data=diagrams.get(root);return data?[...data.baselines.keys()].filter(node=>!editableRegistry.has(data.parts[Number(node.dataset.editableSvgPart)]?.node)):[];}),warn:[]};
  },
  activate(element) {
    const root=element.closest('svg[data-editable-svg-id]'),data=diagrams.get(root),part=element===root?data?.frame:data?.parts[Number(element.dataset.editableSvgPart)];
    if(!part)return;
    // Keep a scrollable HTML protocol attached to its surrounding design box.
    if(part.frame||part.node.localName==='rect') {
      const r=part.node.getBoundingClientRect(),scale=root.getBoundingClientRect().width/root.viewBox.baseVal.width/getSlideScale();
      part.overlays=[...root.parentElement.querySelectorAll(':scope > .emulator-story-attempt-protocol')].filter(node=>{const b=node.getBoundingClientRect();return b.left>=r.left&&b.right<=r.right&&b.top>=r.top&&b.bottom<=r.bottom;}).map(node=>{
        const rect=node.getBoundingClientRect(),matrix=root.getScreenCTM(),point=new DOMPoint(rect.left,rect.top).matrixTransform(matrix.inverse()),style=getComputedStyle(node);
        return{node,scale,x:parseFloat(style.translate)||0,y:parseFloat(style.translate.split(' ')[1])||0,rootX:point.x,rootY:point.y,width:parseFloat(style.width),height:parseFloat(style.height),screenX:rect.left,screenY:rect.top,rootScaleX:Math.hypot(matrix.a,matrix.b),rootScaleY:Math.hypot(matrix.c,matrix.d)};
      });
    }
    const editable=new SVGPart(part);editableRegistry.set(part.node,editable);editable.select();
  },
  serialize(text) {
    const chunks=splitIntoSlideChunks(text),latest=new Map();
    for(const editable of editableRegistry.values())if(editable.type==='svg-part'&&editable.current()){
      const old=latest.get(editable.part.key);if(!old||old.state.order<editable.state.order)latest.set(editable.part.key,editable);
    }
    const roots=new Map();
    for(const editable of latest.values())if(editable.state.order){const key=editable.part.data.anchor.key;if(!roots.has(key))roots.set(key,editable.part.data);}
    for(const data of roots.values()){
      const copy=data.root.cloneNode(true);
      // Reconcile independent part edits made in duplicated down slides.
      for(const [index,member]of [...data.baselines.keys()].entries()) {
        const target=copy.querySelector(`[data-editable-svg-member="${index}"]`);
        const transform=transformedMember(data,member,part=>latest.get(part.key)?.state??part.state);
        if(target&&transform)target.setAttribute('transform',transform);
      }
      const anchor=data.anchor;
      const frame=latest.get(data.frame.key);
      if(frame){const base=frame.part.base;copy.style.translate=`${base.x+base.a*frame.state.x+base.c*frame.state.y}px ${base.y+base.b*frame.state.x+base.d*frame.state.y}px`;copy.style.width=`${base.width*(frame.state.scaleX||1)}px`;copy.style.height=`${base.height*(frame.state.scaleY||1)}px`;}
      chunks[anchor.chunkIndex]=replaceSVGSource(chunks[anchor.chunkIndex],anchor,cleanSVG(copy).outerHTML);
      for(const editable of latest.values())if(editable.part.data.anchor.key===anchor.key&&editable.state.order)for(const overlay of editable.part.overlays||[]){
        const record=htmlTextElements(chunks[anchor.chunkIndex]).find(record=>record.classes.includes('emulator-story-attempt-protocol'));
        if(record)chunks[anchor.chunkIndex]=chunks[anchor.chunkIndex].slice(0,record.start)+patchHtmlOpening(record.opening,{styleText:overlay.node.style.cssText})+chunks[anchor.chunkIndex].slice(record.openEnd);
      }
    }
    return chunks.join('');
  },
};
