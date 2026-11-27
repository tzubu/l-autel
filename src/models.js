import * as T from 'three';
import {ground, altarX, altarZ, pathX} from './terrain.js';

const v = () => new T.Vector3();

export function fitAsset(object, height, yaw) {
  object.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(object, true);
  const center = box.getCenter(v());
  object.position.sub(center.setY(box.min.y));
  const wrapper = new T.Group();
  wrapper.scale.setScalar(height / (box.max.y - box.min.y));
  wrapper.rotation.y = yaw;
  wrapper.add(object);
  return wrapper;
}

export function makeForest(scene, gltf, rnd) {
  gltf.scene.updateMatrixWorld(true);
  const variants = new Map();
  for (const child of gltf.scene.children) {
    const name = /^(.*)_LOD([12])$/.exec(child.name);
    if (!name) continue;
    const meshes = [];
    child.traverse(object => {
      if (!object.isMesh) return;
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      geometry.computeBoundingBox();
      const material = object.material;
      material.roughness = Math.max(material.roughness, .82);
      meshes.push({geometry, material, bark: /bark/i.test(material.name)});
    });
    const trunk = meshes.find(mesh => mesh.bark).geometry;
    const {min, max} = trunk.boundingBox;
    const positions = trunk.attributes.position;
    const root = v(), anchors=[];
    for (let i = 0; i < positions.count; i++) {
      if (positions.getY(i) <= min.y + (max.y - min.y) * .038) {
        const anchor=v().fromBufferAttribute(positions,i);
        root.add(anchor);
        anchors.push(anchor);
      }
    }
    root.divideScalar(Math.max(1,anchors.length));
    root.y = min.y;
    const height = Math.max(...meshes.map(mesh => mesh.geometry.boundingBox.max.y)) - root.y;
    for (const {geometry} of meshes) geometry.translate(-root.x, -root.y, -root.z);
    for(const anchor of anchors) anchor.sub(root);
    if (!variants.has(name[1])) variants.set(name[1], []);
    variants.get(name[1])[Number(name[2]) - 1] = {meshes,height,anchors};
  }
  const models = Array.from(variants.values());
  const trees = [], dummy = new T.Object3D(), tint = new T.Color();
  function plant(px,pz,distant) {
    const y=ground(px,pz);
    const low=Math.min(ground(px+.9,pz),ground(px-.9,pz),ground(px,pz+.9),ground(px,pz-.9));
    if(y<-.3 || y-low>.72 || rnd()<.15) return;
    const variant=Math.floor(rnd()*models.length);
    const height=(variant===2 ? 3.5 : 6.1)+rnd()*4.7;
    const lod=!distant && pz<25 && Math.abs(px)<13 ? 0 : 1;
    const angle=rnd()*Math.PI*2, c=Math.cos(angle), s=Math.sin(angle);
    const model=models[variant][lod], scale=height/model.height;
    let rootY=y-.11;
    for(const a of model.anchors){
      const footX=px+scale*(a.x*c+a.z*s), footZ=pz+scale*(-a.x*s+a.z*c);
      rootY=Math.min(rootY,ground(footX,footZ)-scale*a.y-.085);
    }
    if(y-rootY>1.4) return;
    trees.push({x:px,z:pz,y:rootY,scale,angle,variant,lod,radius:.16+height*.032,distant});
  }
  for (let z = -19; z < 92; z += 4.2) {
    for (let x = -30; x < 31; x += 3.8) {
      const px = x + (rnd() - .5) * 2.8, pz = z + (rnd() - .5) * 3.3;
      if (Math.abs(px - pathX(pz)) < 3.3 && pz < 55) continue;
      if (Math.hypot(px - altarX, pz - altarZ) < 9 ||
          (pz < -13 && Math.abs(px - altarX) < 12)) continue;
      plant(px,pz,false);
    }
  }
  for(let z=5;z<150;z+=17) {
    for(let x=-104;x<=104;x+=16) {
      const px=x+(rnd()-.5)*13, pz=z+(rnd()-.5)*14;
      if(Math.abs(px)<36 && pz<93) continue;
      plant(px,pz,true);
    }
  }
  for (let variant = 0; variant < models.length; variant++) {
    for (let lod = 0; lod < 2; lod++) {
      const model = models[variant][lod];
      const tiles = new Map();
      for (const tree of trees) {
        if (tree.variant!==variant || tree.lod!==lod) continue;
        const tileSize=tree.distant ? 50 : 20;
        const key = [Math.floor(tree.x/tileSize),Math.floor(tree.z/tileSize),tree.distant].join(',');
        if (!tiles.has(key)) tiles.set(key,[]);
        tiles.get(key).push(tree);
      }
      for (const group of tiles.values()) {
        for (const {geometry, material} of model.meshes) {
          const batch = new T.InstancedMesh(geometry, material, group.length);
          for (let i = 0; i < group.length; i++) {
            const tree = group[i];
            dummy.position.set(tree.x, tree.y, tree.z);
            dummy.rotation.y = tree.angle;
            dummy.scale.setScalar(tree.scale);
            dummy.updateMatrix();
            batch.setMatrixAt(i,dummy.matrix);
            tint.setScalar(.82 + (tree.angle % 1) * .18);
            batch.setColorAt(i,tint);
          }
          batch.computeBoundingSphere();
          batch.castShadow = !group[0].distant;
          batch.receiveShadow = true;
          scene.add(batch);
        }
      }
    }
  }
  return trees.filter(tree=>!tree.distant).map(({x,z,radius}) => ({x,z,radius}));
}

export function scatterStones(scene,gltf,rnd) {
  const variants=[], obstacles=[], dummy=new T.Object3D();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(node=>{
    if(!node.isMesh) return;
    const geometry=node.geometry.clone().applyMatrix4(node.matrixWorld);
    geometry.computeBoundingBox();
    const bounds=geometry.boundingBox;
    const center=bounds.getCenter(v()), size=bounds.getSize(v());
    const width=Math.max(size.x,size.z);
    geometry.translate(-center.x,-bounds.min.y,-center.z);
    geometry.scale(1/width,1/width,1/width);
    variants.push({geometry,material:node.material,height:size.y/width,placements:[]});
  });
  for(let i=0;i<100;i++){
    const nearPath=i<34;
    const z=nearPath ? -26+rnd()*56 : -43+rnd()*124;
    const side=rnd()<.5 ? -1 : 1;
    const x=nearPath ? pathX(z)+side*(2.43+rnd()*2.65) : (rnd()-.5)*66;
    const surface=ground(x,z);
    if(surface<-8.7 || Math.abs(x-pathX(z))<2.25 || Math.hypot(x-altarX,z-altarZ)<2.55) continue;
    const stone=variants[i%variants.length], scale=.24+rnd()**1.5*1.7;
    if(scale>.7 && Math.abs(x-pathX(z))<2.60+scale*.43) continue;
    const yaw=rnd()*Math.PI*2, radius=scale*.55;
    let low=surface, high=surface;
    for(let j=0;j<8;j++){
      const angle=yaw+j*Math.PI/4;
      const support=ground(x+Math.cos(angle)*radius,z+Math.sin(angle)*radius);
      low=Math.min(low,support);
      high=Math.max(high,support);
    }
    if(low<-8.7 || high-low>radius*.86) continue;
    const y=Math.min(surface-stone.height*scale*.22,low-stone.height*scale*.07);
    stone.placements.push({x,y,z,scale,yaw});
    if(scale>.7) obstacles.push({x,z,radius:scale*.40,top:y+stone.height*scale*.91});
  }
  for(const {geometry,material,placements} of variants){
    if(!placements.length) continue;
    const mesh=new T.InstancedMesh(geometry,material,placements.length);
    placements.forEach(({x,y,z,scale,yaw},i)=>{
      dummy.position.set(x,y,z);
      dummy.rotation.set(0,yaw,0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);
    });
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    scene.add(mesh);
  }
  return obstacles;
}
