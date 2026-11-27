import * as T from 'three';

export function makeSkyAndOcean(scene) {
const sunDir=new T.Vector3(-.38,.15,-1).normalize();const sky=new T.Mesh(new T.SphereGeometry(550,48,24),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{sunDir:{value:sunDir},time:{value:0}},vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vDir;uniform vec3 sunDir;uniform float time;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.04+vec2(3.1,1.7);a*=.5;}return s;}void main(){vec3 d=normalize(vDir);float h=max(0.,d.y);vec3 col=mix(vec3(.82,.43,.25),vec3(.125,.24,.44),smoothstep(0.,.68,h));col=mix(col,vec3(.68,.38,.42),exp(-abs(h-.17)*9.)*.45);float sd=max(0.,dot(d,sunDir));col+=vec3(1.,.42,.13)*pow(sd,16.)*.38;col+=vec3(1.,.72,.36)*pow(sd,180.)*.9;col=mix(col,vec3(1.,.89,.62)*1.8,smoothstep(.9992,.9997,sd));vec2 uv=d.xz/(max(.07,d.y)+.22)*3.;float c=fbm(uv+vec2(time*.004,0.));float cl=smoothstep(.48,.68,c)*smoothstep(.015,.12,d.y)*(1.-smoothstep(.48,.85,d.y));col=mix(col,mix(vec3(.29,.23,.37),vec3(.99,.62,.43),smoothstep(.46,.74,c)),cl*.72);col=mix(col,vec3(.51,.43,.47),(1.-smoothstep(-.21,.01,d.y)));gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`.replace(';#include',';\n#include')}));scene.add(sky);
const water = new T.Mesh(new T.PlaneGeometry(1450,1450), new T.ShaderMaterial({
  uniforms:{time:{value:0},sunDir:{value:sunDir}},
  vertexShader:`
    varying vec3 vWorld;
    void main(){
      vWorld=(modelMatrix*vec4(position,1.)).xyz;
      gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
    }
  `,
  fragmentShader:`
    varying vec3 vWorld;
    uniform float time;
    uniform vec3 sunDir;
    void main(){
      vec2 p=vWorld.xz;
      vec3 eye=normalize(cameraPosition-vWorld);
      float distance=length(cameraPosition-vWorld);
      float swell=.6*sin(dot(p,vec2(.076,.095))+time*.54)
        +.4*sin(dot(p,vec2(-.101,.058))-time*.32);
      vec2 warped=p+vec2(swell*1.05,swell*.78);
      float a=dot(warped,vec2(.38,.75))+time*.85;
      float b=dot(p,vec2(1.38,-.41))+time*1.01;
      float c=dot(p,vec2(.87,-1.26))-time*1.23;
      float d=dot(warped,vec2(.38,2.46))+time*1.41;
      float details=1.-smoothstep(90.,285.,distance);
      vec2 ripple=vec2(.049,.081)*cos(a)
        +vec2(.038,-.015)*cos(b)
        +details*(vec2(.026,-.050)*cos(c)+vec2(.013,.052)*cos(d));
      vec3 normal=normalize(vec3(ripple.x,1.,ripple.y));
      float fresnel=pow(1.-max(0.,dot(normal,eye)),4.8);
      vec3 color=mix(vec3(.018,.091,.113),vec3(.34,.27,.30),fresnel);
      float shimmer=max(0.,dot(reflect(-sunDir,normal),eye));
      color+=vec3(1.12,.55,.25)*(pow(shimmer,105.)*.82+pow(shimmer,28.)*.18);
      color+=vec3(.017,.029,.033)*(sin(a)*.54+.27*sin(b)+.14*sin(c)*details);
      color*=1.+swell*.095;

      float z=p.y,x=p.x;
      float center=sin(z*.047)*3.4;
      float edge=length(vec2((x-center)/33.,(z-28.)/78.))+
        .037*sin(z*.22+x*.12)+.018*sin(x*.36-z*.11);
      float shore=mix(.895,.939,1.-smoothstep(-25.,45.,z));
      float coast=1.-smoothstep(.005,.045,abs(edge-shore));
      float wave=sin(edge*490.-time*2.2+2.*sin(x*.52+z*.48));
      float foam=smoothstep(.58,.98,wave*.74+.26*sin(z*1.7+x*1.94+time*.65))*coast;
      color=mix(color,vec3(.054,.21,.18),coast*.46);
      color+=foam*vec3(.30,.38,.37);
      color=mix(color,vec3(.51,.43,.47),smoothstep(32.,490.,distance)*.93);
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `
}));
water.rotation.x=-Math.PI/2;
water.position.y=-10;
scene.add(water);
return (time,camera) => {
  sky.position.copy(camera.position);
  sky.material.uniforms.time.value=time;
  water.material.uniforms.time.value=time;
};
}
