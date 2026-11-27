import * as T from 'three';

export function makePrayerPose(pouet, character) {
  const body=character.scene.getObjectByName('Pouet');
  const {skinIndex,skinWeight}=body.geometry.attributes;
  const arms=new Set(body.skeleton.bones.flatMap((bone,i)=>
    /Bone00[67]$/.test(bone.name) ? [i] : []));
  const influence=Array.from({length:skinWeight.count},(_,i)=>{
    let weight=0;
    for(let j=0;j<4;j++){
      if(arms.has(skinIndex.getComponent(i,j))) weight+=skinWeight.getComponent(i,j);
    }
    return weight;
  });
  const fullBody=body.geometry, originalIndices=fullBody.index;
  const visibleIndices=[];
  for(let i=0;i<originalIndices.count;i+=3){
    const a=originalIndices.getX(i),b=originalIndices.getX(i+1),c=originalIndices.getX(i+2);
    const weights=[influence[a],influence[b],influence[c]];
    if(Math.min(...weights)>.08 && (weights[0]+weights[1]+weights[2])/3>.38) {
      visibleIndices.push(a,b,c);
    }
  }
  const armView=fullBody.clone();
  armView.setIndex(visibleIndices);
  const bodyParts=[];
  character.scene.traverse(object=>{
    if(object.isMesh && object!==body) bodyParts.push(object);
  });

  const mixer=new T.AnimationMixer(character.scene);
  const clip=T.AnimationClip.findByName(character.animations,'Joindre');
  const action=mixer.clipAction(clip).play();
  action.paused=true;
  let inFirstPerson=false;
  const offset=new T.Vector3();
  const armVertices=Array.from(new Set(visibleIndices));

  function set(progress){
    action.time=clip.duration*Math.min(progress,.9999);
    mixer.update(0);
  }

  return {
    set,
    frameFrom(eye,look){
      set(1);
      pouet.updateMatrixWorld(true);
      const points=armVertices.map(i=>
        body.getVertexPosition(i,new T.Vector3()).applyMatrix4(body.matrixWorld));
      const front=Math.min(...points.map(point=>point.z));
      const tips=points.filter(point=>point.z<front+.105);
      const center=new T.Vector3();
      for(const tip of tips) center.add(tip);
      center.multiplyScalar(1/tips.length);
      const forward=look.clone().sub(eye).normalize();
      const right=forward.clone().cross(new T.Vector3(0,1,0)).normalize();
      const up=right.cross(forward);
      offset.copy(eye).addScaledVector(forward,.77).addScaledVector(up,-.30).sub(center);
      set(0);
    },
    firstPerson(active){
      if(active===inFirstPerson) return;
      for(const part of bodyParts) part.visible=!active;
      body.geometry=active ? armView : fullBody;
      body.frustumCulled=!active;
      pouet.position.addScaledVector(offset,active ? 1 : -1);
      inFirstPerson=active;
    }
  };
}
