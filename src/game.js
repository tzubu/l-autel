import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ground, seaLevel, altarX, altarZ, pathX, makeTerrain, makeMeadow} from './terrain.js';
import {makeForest, fitAsset, scatterStones} from './models.js';
import {makeAltarEffects,contactShadow} from './effects.js';
import {makeSkyAndOcean} from './sky.js';
import {makePrayerPose} from './prayer-pose.js';
import pinsUrl from './assets/pins.glb';
import altarUrl from './assets/autel.glb';
import pouetUrl from './assets/pouet.glb';
import rocksUrl from './assets/mossy-rocks.glb';
import grassColorUrl from './assets/grass_ground_diff_1k.jpg';
import grassNormalUrl from './assets/grass_ground_nor_gl_1k.jpg';
import meadowColorUrl from './assets/Grass004_1K-JPG_Color.jpg';
import poem from './assets/poeme.txt';

const $ = id => document.getElementById(id);
const v = (x,y,z) => new T.Vector3(x,y,z);
const {clamp, lerp, smootherstep} = T.MathUtils;
const smooth = x => smootherstep(x,0,1);
const walkHeight=1.68, seatedHeight=1.19, playerRadius=.26;

function loadError(message){
  $('start').hidden=true;
  $('load-progress').hidden=true;
  $('load-message').textContent=message;
}

function createRenderer(){
  try {
    return new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  } catch(error) {
    loadError('Le jeu a besoin d’un navigateur compatible WebGL.');
    throw error;
  }
}

const scene=new T.Scene();
const camera=new T.PerspectiveCamera(62,innerWidth/innerHeight,.045,620);
const renderer=createRenderer();
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.03;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate=false;
$('game').append(renderer.domElement);
scene.add(camera);
scene.fog=new T.FogExp2(0xb0a3aa,.008);
scene.add(new T.HemisphereLight(0xffdfbe,0x797b69,1.74));
const sun=new T.DirectionalLight(0xffbf90,2.36);
sun.position.set(-37,34,-49);
sun.target.position.set(0,1,12);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-51,right:51,top:48,bottom:-54,near:1,far:148});
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias=-.00009;
sun.shadow.normalBias=.095;
scene.add(sun,sun.target);
const rim=new T.DirectionalLight(0xc5d5ff,.58);
rim.position.set(18,25,36);
scene.add(rim);

let seed=42167;
function rnd() {
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  return seed/4294967296;
}
const updateSky=makeSkyAndOcean(scene);
const wind={value:0};
const position=v(pathX(23),ground(pathX(23),23),23);
const move=v(), up=v(0,1,0);
const keys=new Set();
let yaw=0,pitch=0,vy=0,grounded=true,state='loading';
let prayerZ, altarBox, pouet, prayerPose, updateEffects, updateMeadow, phaseStart=0;
let pouetShadow;
const obstacles=[];
const seatEye=v(), tableLook=v(), introEye=v(), introLook=v(), sideEye=v(), sideLook=v(), skyLook=v();
const highEye=v(), orbitTarget=v(), viewDirection=v(), skyDirection=v();
const rearDistance=2.63, highDistance=3.65, highAngle=-1.32;
let sideAngle, sideDistance;
const look=v();

function updateWalkCamera() {
  camera.position.set(position.x,position.y+walkHeight,position.z);
  camera.rotation.set(pitch,yaw,0,'YXZ');
}

function canApproach() {
  return grounded && Math.hypot(position.x-altarX,position.z-prayerZ)<1.65;
}

function openPrayer() {
  if (state!=='walk' || !canApproach()) return;
  state='sitting';
  keys.clear();
  $('cross').hidden=true;
  $('prompt').hidden=true;
  introEye.copy(camera.position);
  camera.getWorldDirection(introLook).multiplyScalar(3).add(camera.position);
  prayerPose.set(0);
  prayerPose.firstPerson(true);
  pouet.visible=true;
  phaseStart=performance.now();
  if(document.pointerLockElement) document.exitPointerLock?.();
}

function closePrayer() {
  if (state!=='writing' && state!=='sitting') return;
  $('prayer').hidden=true;
  $('cross').hidden=false;
  prayerPose.firstPerson(false);
  prayerPose.set(0);
  showPouet(false);
  state='walk';
  updateWalkCamera();
}

function capturePointer(){
  const lock=renderer.domElement.requestPointerLock?.();
  lock?.catch?.(()=>{});
}

function beginWalk(){
  state='walk';
  $('intro').hidden=true;
  $('cross').hidden=false;
}

$('start').addEventListener('click',()=>{
  if(state!=='ready') return;
  capturePointer();
  beginWalk();
});
$('prompt').addEventListener('click',openPrayer);
$('form').addEventListener('submit',event=>{
  event.preventDefault();
  if(state!=='writing') return;
  $('prayer').hidden=true;
  $('words').value='';
  camera.position.copy(seatEye);
  camera.lookAt(tableLook);
  state='releasing';
  phaseStart=performance.now();
});

function endFilm() {
  state='message';
  showPouet(false);
  $('message').hidden=false;
  setTimeout(()=>{
    $('black').style.opacity=1;
    setTimeout(()=>{
      $('message').hidden=true;
      $('ending').hidden=false;
      requestAnimationFrame(()=>$('poem').style.opacity=1);
      state='end';
    },2600);
  },4200);
}

function showPouet(visible){
  pouet.visible=pouetShadow.visible=visible;
}

const controlKeys={KeyW:'forward',KeyZ:'forward',ArrowUp:'forward',
  KeyA:'left',KeyQ:'left',ArrowLeft:'left',KeyS:'back',ArrowDown:'back',
  KeyD:'right',ArrowRight:'right',Space:'jump'};
window.addEventListener('keydown',event=>{
  if(event.code==='Escape') closePrayer();
  if(state!=='walk') return;
  if(event.code==='KeyE' && !event.repeat) {
    event.preventDefault();
    openPrayer();
  }
  if(!controlKeys[event.code]) return;
  event.preventDefault();
  keys.add(event.code);
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>keys.clear());
document.addEventListener('pointerlockchange',()=>{
  if(!document.pointerLockElement) keys.clear();
});
renderer.domElement.addEventListener('click',()=>{
  if(state!=='walk') return;
  if(canApproach() && document.pointerLockElement===renderer.domElement) {
    openPrayer();
    return;
  }
  capturePointer();
});
document.addEventListener('mousemove',event=>{
  if(state!=='walk' || document.pointerLockElement!==renderer.domElement) return;
  yaw-=event.movementX*.0022;
  pitch=clamp(pitch-event.movementY*.0022,-1.40,1.40);
});
window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

function canStep(x,z) {
  const halfWidth=2.74 + .51*(1-smooth((z-altarZ-1)/4.8));
  if(z<altarZ-1.65 || z>26.4 || Math.abs(x-pathX(z))>halfWidth-playerRadius) return false;
  const h=ground(x,z);
  if(h<seaLevel-.43) return false;
  const low=ground(position.x,position.z);
  if(grounded && h-low > .025 + Math.hypot(x-position.x,z-position.z)*.94) return false;
  if(!grounded && h>position.y+.045 && h-low>.045) return false;
  const dx=x-clamp(x,altarBox.min.x,altarBox.max.x);
  const dz=z-clamp(z,altarBox.min.z,altarBox.max.z);
  if(dx*dx+dz*dz<playerRadius**2 && position.y<altarBox.max.y) return false;
  for(const object of obstacles) {
    if(object.top!==undefined && position.y>=object.top) continue;
    const r=playerRadius+object.radius;
    if((x-object.x)**2+(z-object.z)**2<r*r) return false;
  }
  return true;
}

const held = (...codes) => codes.some(code=>keys.has(code));
function floorUnderPlayer(){
  let top=ground(position.x,position.z);
  for(const object of obstacles){
    if(object.top===undefined || object.top>position.y+.035) continue;
    const radius=object.radius+playerRadius*.38;
    if((position.x-object.x)**2+(position.z-object.z)**2<radius*radius){
      top=Math.max(top,object.top);
    }
  }
  return top;
}

function walking(dt) {
  const forward=Number(held('KeyZ','KeyW','ArrowUp'));
  const back=Number(held('KeyS','ArrowDown'));
  const right=Number(held('KeyD','ArrowRight'));
  const left=Number(held('KeyQ','KeyA','ArrowLeft'));
  move.set(right-left,0,back-forward);
  const pace=T.MathUtils.lerp(2.35,4.8,smooth((position.y-seaLevel+.25)/1.65));
  move.normalize().applyAxisAngle(up,yaw).multiplyScalar(pace*dt);
  const steps=Math.max(1,Math.ceil(move.length()/.09));
  for(let i=0;i<steps;i++){
    const x=position.x+move.x/steps,z=position.z+move.z/steps;
    if(canStep(x,z)) {
      position.x=x;
      position.z=z;
    } else {
      if(move.x && canStep(x,position.z)) position.x=x;
      if(move.z && canStep(position.x,z)) position.z=z;
    }
  }
  const surface=floorUnderPlayer();
  if(grounded && position.y-surface<.22) position.y=surface;
  if(grounded && keys.delete('Space')){
    vy=4.25;
    grounded=false;
  }
  vy-=13.8*dt;
  position.y+=vy*dt;
  grounded=position.y<=surface;
  if(grounded){
    position.y=surface;
    vy=0;
  }
  $('prompt').hidden=!canApproach();
  updateWalkCamera();
}

function film(now) {
  const elapsed=(now-phaseStart)/1000;
  if(elapsed<1.9) {
    const q=smooth(elapsed/1.9);
    showPouet(q>.37);
    camera.position.copy(seatEye).lerp(sideEye,q);
    look.copy(tableLook).lerp(sideLook,q);
  } else if(elapsed<8.85) {
    const q=smooth((elapsed-1.9)/6.95);
    showPouet(true);
    const angle=lerp(sideAngle,highAngle,q);
    const dip=smooth(q/.44), climb=smooth((q-.44)/.56);
    const distance=lerp(lerp(sideDistance,rearDistance,dip),highDistance,climb);
    const y=lerp(lerp(sideEye.y,orbitTarget.y-.17,dip),highEye.y,climb);
    camera.position.set(altarX+Math.sin(angle)*distance,y,
      prayerZ+Math.cos(angle)*distance);
    look.copy(sideLook).lerp(orbitTarget,dip).lerp(sideLook,climb);
    const tilt=smooth((q-.77)/.23);
    viewDirection.subVectors(look,camera.position).normalize();
    skyDirection.subVectors(skyLook,camera.position).normalize();
    look.copy(camera.position).add(viewDirection.lerp(skyDirection,tilt));
  } else if(elapsed<10.65) {
    const q=smooth((elapsed-8.85)/1.8);
    camera.position.copy(highEye).lerp(seatEye,q);
    viewDirection.subVectors(skyLook,camera.position).normalize();
    skyDirection.subVectors(tableLook,camera.position).normalize();
    look.copy(camera.position).add(viewDirection.lerp(skyDirection,q));
    showPouet(q<.44);
  } else {
    endFilm();
    return;
  }
  camera.lookAt(look);
}

function loadAssets(){
  const gltf=new GLTFLoader(), textures=new T.TextureLoader();
  const models=[pinsUrl,altarUrl,pouetUrl,rocksUrl];
  const maps=[grassColorUrl,grassNormalUrl,meadowColorUrl];
  const progress=$('load-progress');
  const fractions=Array(models.length+maps.length).fill(0);
  function report(index,fraction){
    fractions[index]=Math.max(fractions[index],fraction);
    const done=fractions.reduce((sum,value)=>sum+value,0);
    progress.value=Math.round(3+92*done/fractions.length);
  }
  progress.value=3;
  return Promise.all([
    ...models.map(async (url,index)=>{
      const asset=await gltf.loadAsync(url,event=>{
        if(event.total>0) report(index,Math.min(.90,.90*event.loaded/event.total));
      });
      report(index,1);
      return asset;
    }),
    ...maps.map(async (url,index)=>{
      const texture=await textures.loadAsync(url);
      report(models.length+index,1);
      return texture;
    })
  ]);
}

async function init() {
  updateWalkCamera();
  try {
    const [pines, shrine, character, rocks, color, normal, meadow]=await loadAssets();
    $('load-message').textContent='Préparation du paysage…';
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    $('poem').textContent=poem;
    for(const tex of [color,normal,meadow]){
      tex.wrapS=tex.wrapT=T.RepeatWrapping;
      tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    }
    color.colorSpace=meadow.colorSpace=T.SRGBColorSpace;
    makeTerrain(scene,color,normal,meadow);
    updateMeadow=makeMeadow(scene,rnd,wind);
    obstacles.push(...makeForest(scene,pines,rnd),...scatterStones(scene,rocks,rnd));

    const altar=fitAsset(shrine.scene,1.27,-Math.PI/2);
    const altarY=ground(altarX,altarZ);
    altar.position.set(altarX,altarY-.025,altarZ);
    altar.traverse(object=>{
      if(!object.isMesh) return;
      object.castShadow=true;
      object.receiveShadow=true;
    });
    scene.add(altar);
    altar.updateMatrixWorld(true);
    altarBox=new T.Box3().setFromObject(altar.getObjectByName('Table'),true);
    const table=altar.getObjectByName('Table');
    table.material.roughness=Math.max(.77,table.material.roughness);
    contactShadow(scene,ground,altarX,altarZ,2.50,1.45,.60);
    prayerZ=altarBox.max.z+.89;
    const seatY=ground(altarX,prayerZ);
    seatEye.set(altarX,seatY+seatedHeight,prayerZ+.12);
    tableLook.set(altarX,altarBox.max.y+.23,altarZ);
    sideEye.set(altarX+3.12,altarY+1.49,altarZ+.25);
    sideLook.set(altarX,altarY+.86,(altarZ+prayerZ)*.5);
    sideAngle=Math.atan2(sideEye.x-altarX,sideEye.z-prayerZ);
    sideDistance=Math.hypot(sideEye.x-altarX,sideEye.z-prayerZ);
    highEye.set(altarX+Math.sin(highAngle)*highDistance,seatY+3.45,
      prayerZ+Math.cos(highAngle)*highDistance);
    orbitTarget.set(altarX,seatY+.79,(altarZ+prayerZ)*.5);
    skyLook.set(-35,altarY+60,-125);

    pouet=fitAsset(character.scene,1.51,Math.PI/2);
    pouet.position.set(altarX,seatY,prayerZ+.02);
    scene.add(pouet);
    prayerPose=makePrayerPose(pouet,character);
    prayerPose.set(0);
    pouet.updateMatrixWorld(true);
    const pose=new T.Box3().setFromObject(pouet,true);
    pouet.position.y+=seatY-pose.min.y;
    pouet.updateMatrixWorld(true);
    prayerPose.frameFrom(seatEye,tableLook);
    pouetShadow=contactShadow(scene,ground,altarX,prayerZ,.89,.82,.65);
    showPouet(false);

    updateEffects=makeAltarEffects(scene,altar,altarX,altarZ,altarY);
    renderer.shadowMap.needsUpdate=true;
    updateEffects(performance.now()/1000,camera);
    updateMeadow(camera);
    renderer.render(scene,camera);
    state='ready';
    $('load-progress').value=100;
    $('loading').hidden=true;
    $('start').disabled=false;
  } catch(error) {
    console.error(error);
    loadError('Le paysage n’a pas pu se charger. Recharge la page pour réessayer.');
  }
}

let previous=performance.now(), accumulator=0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt=Math.min(.25,(now-previous)/1000),time=now/1000;
  previous=now;
  wind.value=time;
  if(state==='walk'){
    accumulator+=dt;
    while(accumulator>=1/60){
      walking(1/60);
      accumulator-=1/60;
    }
  } else if(state==='sitting'){
    const elapsed=now-phaseStart;
    const sit=smooth(elapsed/720);
    camera.position.copy(introEye).lerp(seatEye,sit);
    camera.lookAt(look.copy(introLook).lerp(tableLook,sit));
    prayerPose.set(smooth((elapsed-510)/900));
    if(elapsed>=2150){
      state='writing';
      $('prayer').hidden=false;
      $('words').focus();
    }
  } else if(state==='releasing'){
    const elapsed=now-phaseStart;
    prayerPose.set(1-smooth(elapsed/700));
    if(elapsed>=700){
      prayerPose.firstPerson(false);
      showPouet(false);
      state='movie';
      phaseStart=now;
    }
  } else if(state==='movie') film(now);
  if(updateEffects) updateEffects(time,camera);
  if(updateMeadow) updateMeadow(camera);
  updateSky(time,camera);
  if(state!=='end' && state!=='loading' && state!=='ready') renderer.render(scene,camera);
}
requestAnimationFrame(frame);
init();
