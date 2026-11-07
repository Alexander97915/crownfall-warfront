'use strict';
const SUPPORT_EFFECTS=new Set('healAll healSelf cleanse shieldAlly shieldAll shieldSelf buffSelf taunt refresh rage revive shadowheal hasteAll marksmanship moonlight'.split(' '));
// Four motifs in Q/W/E/R order for each roster ID. These visual signatures do not alter gameplay.
const HERO_SKILL_MOTIFS=[
  ['blades','whirl','heal','blades'],['volley','frost','wave','arrows'],['rune','beam','grasp','rune'],['counter','cleave','aura','duel'],
  ['veil','dagger','dash','crit'],['curse','specter','souls','specter'],['flesh','hook','venom','hook'],['quake','fissure','totem','quake'],
  ['aura','frost','frost','blizzard'],['flame','flame','flame','beam'],['drain','fissure','rune','beam'],['gaze','frost','shield','frost'],
  ['leap','lightning','lightning','lightning'],['lightning','specter','grasp','dash'],['tornado','frost','veil','meteor'],['matrix','beam','missile','matrix'],
  ['curse','taunt','whirl','axe'],['cleave','quake','aura','cleave'],['crit','flame','heal','souls'],['scales','flame','stun','scales'],
  ['crit','lightning','grasp','summon'],['shell','wave','cleave','quake'],['roots','quake','boulder','scales'],['veil','roots','shield','roots'],
  ['matrix','drain','dash','burst'],['dash','beam','veil','summon'],['leap','quake','totem','summon'],['clock','clock','dash','clock'],
  ['specter','dagger','shield','summon'],['summon','specter','scales','drain'],['drain','rune','leap','veil'],['blades','dash','smoke','blades'],
  ['arrows','arrows','dash','volley'],['dash','venom','wave','wave'],['aura','beam','curse','grasp'],['rune','beam','rune','meteor'],
  ['volley','serpent','shield','gaze'],['moon','moon','arrows','moon'],['stars','arrows','leap','veil'],['gun','missile','crit','gun']
];
const POSITIVE_MOTIFS=new Set(['aura','heal','shield','matrix','moon','scales','veil','totem']);
// Each transparent 2×2 sheet holds the combat signature for four consecutive heroes.
const HERO_VFX_SHEETS=Array.from({length:10},(_,i)=>{
  const image=new Image();image.src=`assets/skill-vfx-sheets/signatures-${String(i).padStart(2,'0')}.webp`;return image;
});
const ULTIMATE_VFX_SHEETS={
  9:Object.assign(new Image(),{src:'assets/skill-vfx-sheets/laguna-impact.webp'}),
  27:Object.assign(new Image(),{src:'assets/skill-vfx-sheets/chronosphere-field.webp'})
};
function drawPaintedSkillVfx(ctx,e,t){
  const sheet=HERO_VFX_SHEETS[Math.floor(e.hero/4)];
  if(sheet?.complete&&sheet.naturalWidth){
    const cell=e.hero%4,scale=e.source?.95:1.07,diameter=e.r*scale*(1.05+t*.35);
    ctx.save();ctx.translate(e.x,e.y);ctx.globalCompositeOperation='screen';
    ctx.globalAlpha=Math.min(1,(e.source?.34:.48)*(1-t)*1.8);
    ctx.rotate((e.source?-.13:.09)*Math.sin(t*5+e.index));
    ctx.drawImage(sheet,(cell%2)*512,Math.floor(cell/2)*512,512,512,-diameter,-diameter,diameter*2,diameter*2);
    ctx.restore();
  }
  const ultimate=ULTIMATE_VFX_SHEETS[e.hero];
  if(e.index===3&&ultimate?.complete&&ultimate.naturalWidth&&((e.hero===9&&!e.source)||(e.hero===27&&e.source))){
    const frame=Math.min(3,Math.floor(t*4)),diameter=e.r*(e.hero===27?1.9:1.55);
    ctx.save();ctx.translate(e.x,e.y);ctx.globalCompositeOperation='screen';ctx.globalAlpha=.88*(1-Math.max(0,t-.8)*4);
    ctx.drawImage(ultimate,(frame%2)*512,Math.floor(frame/2)*512,512,512,-diameter,-diameter,diameter*2,diameter*2);
    ctx.restore();
  }
}
function motifForSkill(id,index){return HERO_SKILL_MOTIFS[id]?.[index]||'rune'}
function emitSkillVisual(effects,caster,index,skill,target,units){
  const friendly=skill.target.startsWith('友')||skill.target==='自身'||skill.effect==='revive';
  let targets;
  if(skill.effect==='revive'){
    const dead=units.filter(v=>v.team===caster.team&&v.hp<=0).sort((a,b)=>b.maxHp-a.maxHp)[0];
    targets=dead?[dead]:units.filter(v=>v.team===caster.team&&v.hp>0);
  }else if(skill.target==='自身')targets=[caster];
  else if(skill.target==='友方單體'||skill.target==='敵方單體')targets=target?[target]:[];
  else if(friendly)targets=units.filter(v=>v.team===caster.team&&v.hp>0&&Math.hypot(v.x-caster.x,v.y-caster.y)<710);
  else{
    const opponents=units.filter(v=>v.team!==caster.team&&v.hp>0&&v.active&&Math.hypot(v.x-caster.x,v.y-caster.y)<850);
    if(skill.target==='敵方三人')targets=opponents.sort((a,b)=>a.hp-b.hp).slice(0,3);
    else{const center=target&&target.team!==caster.team?target:caster;targets=opponents.filter(v=>Math.hypot(v.x-center.x,v.y-center.y)<310)}
  }
  const motif=motifForSkill(caster.id,index),color=ELEMENTS[skill.element],duration=index===3?1.05:index===0?.72:.68;
  const source={kind:'skill',motif,x:caster.x,y:caster.y-caster.size*.53,fromX:caster.x,fromY:caster.y-caster.size*.53,color,index,hero:caster.id,seed:caster.id*7+index,life:duration,max:duration,r:index===3?80:56,source:true};
  effects.push(source);
  for(const [i,v] of (targets?.length?targets:[caster]).slice(0,5).entries()){
    if(v===caster)continue;
    effects.push({kind:'skill',motif,x:v.x,y:v.y-v.size*.48,fromX:caster.x,fromY:caster.y-caster.size*.53,color,index,hero:caster.id,seed:caster.id*11+index*5+i,life:duration,max:duration,r:index===3?Math.min(130,v.size*.8):Math.min(90,v.size*.62),source:false});
  }
}
function drawSkillVisual(ctx,e){
  const t=Math.max(0,Math.min(1,1-e.life/e.max)),f=1-t,large=e.index===3,r=e.r*(.5+t*.75),m=e.motif,spin=(e.hero%2?1:-1)*(e.seed*.37+t*3.8);
  drawPaintedSkillVfx(ctx,e,t);
  ctx.save();ctx.translate(e.x,e.y);ctx.globalAlpha=f*(large?.92:.78);ctx.globalCompositeOperation='screen';
  ctx.strokeStyle=e.color;ctx.fillStyle=e.color;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor=e.color;ctx.shadowBlur=large?18:10;
  const line=(x,y,X,Y,w=2)=>{ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(X,Y);ctx.lineWidth=w;ctx.stroke()};
  const arc=(x,y,rad,a,b,w=2)=>{ctx.beginPath();ctx.arc(x,y,rad,a,b);ctx.lineWidth=w;ctx.stroke()};
  const ring=(rad,w=2)=>arc(0,0,rad,0,Math.PI*2,w);
  const poly=(n,rad,angle=0,w=2)=>{ctx.beginPath();for(let i=0;i<=n;i++){const a=angle+i*Math.PI*2/n,x=Math.cos(a)*rad,y=Math.sin(a)*rad;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)}ctx.lineWidth=w;ctx.stroke()};
  const sparkle=(x,y,s)=>{line(x-s,y,x+s,y,1.8);line(x,y-s,x,y+s,1.8)};
  const streak=(dx,dy,w=3)=>{ctx.beginPath();ctx.moveTo(dx,dy);ctx.lineTo(dx*.48+Math.sin(spin)*8,dy*.48);ctx.lineTo(0,0);ctx.lineWidth=w;ctx.stroke()};
  // A small hero-specific rotating seal sits beneath every cast, including ranged hits.
  if(e.source){ctx.save();ctx.rotate(spin*.22);arc(0,0,r*.78,-.2,1.65,2);arc(0,0,r*.78,Math.PI-.2,Math.PI+1.65,2);for(let i=0;i<3+(e.hero%4);i++){let a=i*Math.PI*2/(3+e.hero%4);sparkle(Math.cos(a)*r*.78,Math.sin(a)*r*.78,2.5)}ctx.restore()}
  if(['blades','cleave','counter','dagger','axe','crit','duel'].includes(m)){
    const n=m==='blades'?5:m==='counter'?2:3;
    for(let i=0;i<n;i++){let a=spin*.25+i*(m==='counter'?Math.PI/2:.31)-.8;
      arc(0,0,r*(.52+i*.11),a,a+(m==='cleave'?1.85:1.25),large?5:3.5)}
    if(m==='counter'){line(-r*.42,-r*.4,r*.42,r*.4,3);line(r*.42,-r*.4,-r*.42,r*.4,3)}
    if(m==='axe'||m==='crit')for(let i=0;i<4;i++){let a=i*Math.PI/2+spin*.1;streak(Math.cos(a)*r,Math.sin(a)*r,3)}
  }else if(['volley','arrows','gun','missile','beam','hook','drain','grasp','dash','burst'].includes(m)){
    const dx=e.fromX-e.x,dy=e.fromY-e.y,hasPath=!e.source&&Math.hypot(dx,dy)>12;
    if(hasPath){ctx.globalAlpha*=.8;if(m==='hook'||m==='drain'||m==='grasp'){
      ctx.beginPath();ctx.moveTo(dx,dy);for(let j=1;j<7;j++){const v=j/7;ctx.lineTo(dx*(1-v),dy*(1-v)+Math.sin(j*4+spin)*8)}ctx.lineTo(0,0);ctx.lineWidth=m==='hook'?4:2.5;ctx.stroke()
    }else streak(dx,dy,m==='gun'||m==='beam'?6:3)}
    const n=m==='volley'?7:m==='missile'?4:m==='arrows'?5:3;
    for(let i=0;i<n;i++){const y=(i-(n-1)/2)*r*.18,spread=m==='volley'?i-(n-1)/2:0;
      line(-r*.43,y*.3,r*.5,y+spread*2,m==='gun'||m==='beam'?4:2.5);
      line(r*.5,y+spread*2,r*.34,y+spread*2-5,2);line(r*.5,y+spread*2,r*.34,y+spread*2+5,2)}
    if(m==='drain'||m==='grasp'){ring(r*.32,2);for(let i=0;i<3;i++)sparkle(Math.sin(spin+i*2)*r*.45,Math.cos(spin+i*2)*r*.45,3)}
  }else if(['quake','fissure','boulder','roots','totem','flesh'].includes(m)){
    const n=m==='roots'||m==='flesh'?6:5;
    for(let i=0;i<n;i++){const x=(i-(n-1)/2)*r*.33;
      ctx.beginPath();ctx.moveTo(x*.5,r*.58);ctx.lineTo(x+Math.sin(i*8+spin)*8,r*.17);ctx.lineTo(x+Math.sin(i*5+spin)*14,-r*(.1+i%2*.3));ctx.lineWidth=m==='boulder'?5:3;ctx.stroke()}
    if(m==='totem')poly(4,r*.38,Math.PI/4,4);
    if(m==='flesh'){ring(r*.48,4);ring(r*.3,2)}
  }else if(['whirl','tornado','wave','serpent','specter','souls','smoke','veil','leap'].includes(m)){
    const turns=m==='tornado'?3:m==='serpent'?2:1,n=28;
    ctx.beginPath();for(let i=0;i<=n;i++){let q=i/n,a=spin+q*turns*Math.PI*2,rr=r*(.12+q*.7);
      const x=Math.cos(a)*rr,y=Math.sin(a)*rr*(m==='wave'?.35:.65)-q*r*(m==='tornado'?.5:0);
      if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)}ctx.lineWidth=m==='wave'?5:3;ctx.stroke();
    if(['specter','souls','veil','smoke'].includes(m))for(let i=0;i<4;i++){let a=spin+i*Math.PI/2;arc(Math.cos(a)*r*.45,Math.sin(a)*r*.3,r*.22,a,a+1.6,2)}
  }else if(['flame','venom','meteor','frost','blizzard','lightning','stars','moon'].includes(m)){
    const n=large?10:6;
    for(let i=0;i<n;i++){let a=i*Math.PI*2/n+spin*.25,x=Math.cos(a)*r*.56,y=Math.sin(a)*r*.48;
      if(m==='lightning'){line(x-8,y-13,x+3,y-2,3);line(x+3,y-2,x-2,y+12,3)}
      else if(m==='moon'){arc(x,y,8,a,a+Math.PI*1.45,2.5)}
      else if(m==='stars')sparkle(x,y,5+i%3);
      else if(m==='frost'||m==='blizzard'){sparkle(x,y,6);line(x-4,y-4,x+4,y+4,1.5);line(x+4,y-4,x-4,y+4,1.5)}
      else{ctx.beginPath();ctx.moveTo(x,y+9);ctx.quadraticCurveTo(x-10,y-10,x+Math.sin(a*3)*7,y-21);ctx.lineWidth=3;ctx.stroke()}}
    if(m==='meteor')ring(r*.5,3);
    if(m==='moon'){arc(0,0,r*.55,-1.2,1.85,5);arc(-r*.18,0,r*.5,-1.2,1.85,3)}
  }else if(['aura','heal','shield','shell','matrix','scales','rune','clock','summon','gaze','curse','taunt','stun'].includes(m)){
    ring(r*.65,m==='shield'||m==='matrix'?4:2);ring(r*.35,1.5);
    if(m==='matrix'||m==='shield'||m==='scales'||m==='shell')poly(m==='scales'||m==='shell'?8:6,r*.65,spin*.13,2);
    if(m==='clock')for(let i=0;i<12;i++){let a=i*Math.PI/6;line(Math.cos(a)*r*.7,Math.sin(a)*r*.7,Math.cos(a)*r*.82,Math.sin(a)*r*.82,2)}
    if(m==='gaze'){ctx.beginPath();ctx.ellipse(0,0,r*.57,r*.27,0,0,Math.PI*2);ctx.lineWidth=3;ctx.stroke();ring(r*.16,3)}
    if(m==='summon')for(let i=-1;i<=1;i++){poly(4,r*.23,Math.PI/4+i*.2,2);sparkle(i*r*.45,-r*.4,4)}
    if(m==='rune'||m==='curse'||m==='taunt')for(let i=0;i<6;i++){let a=i*Math.PI/3+spin*.2;line(Math.cos(a)*r*.46,Math.sin(a)*r*.46,Math.cos(a+.23)*r*.64,Math.sin(a+.23)*r*.64,2)}
    if(m==='heal'||m==='aura')for(let i=0;i<4;i++){let a=i*Math.PI/2+spin*.4;sparkle(Math.cos(a)*r*.49,Math.sin(a)*r*.49,5)}
  }
  ctx.shadowBlur=0;ctx.globalAlpha=f*.65;ctx.fillStyle='#fff7df';ctx.beginPath();ctx.arc(0,0,large?5:3,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawUnitAura(ctx,u,time){
  if(u.hp<=0)return;
  const statuses=u.statuses||{},pulse=Math.sin(time*4+u.id)*.08;
  ctx.save();ctx.globalCompositeOperation='screen';ctx.lineWidth=2;
  if(u.skillMotion){const color=ELEMENTS[KITS[u.id][0]],phase=u.skillMotion.elapsed/u.skillMotion.duration;ctx.strokeStyle=color;ctx.globalAlpha=.58*(1-phase);ctx.beginPath();ctx.ellipse(0,-u.size*.42,u.size*(.3+phase*.24),u.size*(.42+phase*.2),0,0,Math.PI*2);ctx.stroke()}
  if(u.shield>0||statuses.guard||u.guard){ctx.strokeStyle='#a9e4f2';ctx.globalAlpha=.38+pulse;ctx.beginPath();ctx.ellipse(0,-u.size*.48,u.size*.37,u.size*.49,0,0,Math.PI*2);ctx.stroke()}
  if(statuses.buff||statuses.haste||statuses.rage||statuses.marksmanship){ctx.strokeStyle=statuses.marksmanship?'#d9dfaf':'#ead695';ctx.globalAlpha=.4+pulse;for(let i=0;i<3;i++){const a=time*1.4+i*Math.PI*2/3;ctx.beginPath();ctx.arc(Math.cos(a)*u.size*.3,-u.size*.5+Math.sin(a)*u.size*.22,2.5,0,Math.PI*2);ctx.stroke()}}
  if(statuses.burn||statuses.poison){ctx.strokeStyle=statuses.burn?'#f4a56e':'#b7ca79';ctx.globalAlpha=.42+pulse;for(let i=0;i<3;i++){let x=Math.sin(time*3+i*2.2)*u.size*.2,y=-u.size*(.2+(time*.24+i*.27)% .65);ctx.beginPath();ctx.moveTo(x,y+8);ctx.quadraticCurveTo(x-7,y-2,x+2,y-11);ctx.stroke()}}
  if(statuses.moonlight||statuses.shadowheal){ctx.strokeStyle=statuses.moonlight?'#d5e4f2':'#bd91dc';ctx.globalAlpha=.42+pulse;ctx.beginPath();ctx.arc(0,-u.size*.84,u.size*.15,-1.2,1.8);ctx.stroke()}
  if(statuses.bladeFury){ctx.strokeStyle='#a7e8d9';ctx.globalAlpha=.52+pulse;for(let i=0;i<3;i++){const a=time*5+i*Math.PI*2/3;ctx.beginPath();ctx.arc(0,-u.size*.43,u.size*.42,a,a+.8);ctx.stroke()}}
  if(statuses.healingWard){ctx.strokeStyle='#b9e7a4';ctx.globalAlpha=.55+pulse;const y=-u.size*.95;ctx.beginPath();ctx.moveTo(0,y-6);ctx.lineTo(0,y+6);ctx.moveTo(-6,y);ctx.lineTo(6,y);ctx.stroke()}
  if(statuses.stun){ctx.strokeStyle='#f6d889';ctx.globalAlpha=.7;for(let i=0;i<3;i++){const a=time*2+i*Math.PI*2/3,x=Math.cos(a)*u.size*.23,y=-u.size*.96+Math.sin(a)*5;ctx.beginPath();ctx.moveTo(x-3,y);ctx.lineTo(x+3,y);ctx.moveTo(x,y-3);ctx.lineTo(x,y+3);ctx.stroke()}}
  else if(statuses.silence){ctx.strokeStyle='#d2a9dd';ctx.globalAlpha=.6;ctx.beginPath();ctx.arc(0,-u.size*.94,8,0,Math.PI*2);ctx.moveTo(-6,-u.size*.94+6);ctx.lineTo(6,-u.size*.94-6);ctx.stroke()}
  else if(statuses.slow){ctx.strokeStyle='#9fdbe9';ctx.globalAlpha=.48+pulse;ctx.beginPath();ctx.ellipse(0,-4,u.size*.28,5,0,0,Math.PI*2);ctx.stroke()}
  if(statuses.curse||statuses.weak){ctx.strokeStyle='#b68dc7';ctx.globalAlpha=.4+pulse;ctx.beginPath();ctx.moveTo(-u.size*.22,-u.size*.8);ctx.lineTo(-u.size*.3,-u.size*.62);ctx.lineTo(-u.size*.17,-u.size*.55);ctx.moveTo(u.size*.22,-u.size*.8);ctx.lineTo(u.size*.3,-u.size*.62);ctx.lineTo(u.size*.17,-u.size*.55);ctx.stroke()}
  ctx.restore();
}
