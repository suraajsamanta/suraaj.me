import type { Point } from './course';
import { ROAD_SIMD_BYTES } from './road-simd-bytes';

export type RoadProjection = { x: number; y: number; z: number; distance: number; segment: number; progress: number };
export type RoadQuery = (x: number, z: number) => RoadProjection;
let compiled: Promise<WebAssembly.Module | null> | undefined;
/** Lazy feature detection also handles CSP/disabled WASM without breaking driving. */
export function loadRoadSimd(): Promise<WebAssembly.Module | null> {
  return compiled ??= (async () => {
    try {
      if (typeof WebAssembly === 'undefined' || !WebAssembly.validate(ROAD_SIMD_BYTES)) return null;
      return await WebAssembly.compile(ROAD_SIMD_BYTES);
    } catch { return null; }
  })();
}

/** Same expanded spatial buckets as the scalar reference, two f64 segments per SIMD128 op.
 * Static data is copied once; each query crosses the WASM boundary once, not per segment.
 * Returns null on unsupported runtimes, invalid geometry or allocation failure.
 */
export async function createSimdRoadQuery(path: readonly Point[]): Promise<RoadQuery | null> {
  if (!path.length || path.some((p, i) => ![p.x,p.y,p.z].every(Number.isFinite) ||
    (p.x === path[(i+1)%path.length].x && p.z === path[(i+1)%path.length].z))) return null;
  const kernel = await loadRoadSimd();
  if (!kernel) return null;
  try {
    const segments = path.map((a,index) => {
      const b=path[(index+1)%path.length], dx=b.x-a.x, dz=b.z-a.z;
      return { a,index,dx,dz,dy:b.y-a.y,inv:1/(dx*dx+dz*dz) };
    });
    const cells = new Map<number,Map<number,number[]>>();
    for(const s of segments) for(let ix=Math.floor((s.a.x+Math.min(0,s.dx)-12)/16);ix<=Math.floor((s.a.x+Math.max(0,s.dx)+12)/16);ix++) {
      let col=cells.get(ix); if(!col) {col=new Map();cells.set(ix,col);}
      for(let iz=Math.floor((s.a.z+Math.min(0,s.dz)-12)/16);iz<=Math.floor((s.a.z+Math.max(0,s.dz)+12)/16);iz++) {
        const list=col.get(iz); if(list) list.push(s.index); else col.set(iz,[s.index]);
      }
    }
    const all=segments.map(s=>s.index), lists=[all,...[...cells.values()].flatMap(c=>[...c.values()])];
    const bytes=lists.reduce((sum,list)=>sum+Math.ceil(list.length/2)*80,0);
    const memory=new WebAssembly.Memory({initial:Math.max(1,Math.ceil(bytes/65536))});
    const data=new Float64Array(memory.buffer);
    const descriptors=new Map<number[],{ptr:number;count:number}>();
    let offset=0;
    for(const list of lists) {
      descriptors.set(list,{ptr:offset*8,count:Math.ceil(list.length/2)});
      for(let i=0;i<list.length;i+=2) {
        for(let lane=0;lane<2;lane++) {
          const s=segments[list[Math.min(i+lane,list.length-1)]];
          [s.a.x,s.a.z,s.dx,s.dz,s.inv].forEach((value,k)=>data[offset+k*2+lane]=value);
        }
        offset+=10;
      }
    }
    const instance=await WebAssembly.instantiate(kernel,{env:{memory}});
    const nearest=instance.exports.nearest as (ptr:number,count:number,x:number,z:number)=>number;
    const search=(list:number[],x:number,z:number):RoadProjection=> {
      const d=descriptors.get(list)!;
      const lane=nearest(d.ptr,d.count,x,z);
      const s=segments[list[Math.min(lane,list.length-1)]];
      const t=Math.max(0,Math.min(1,((x-s.a.x)*s.dx+(z-s.a.z)*s.dz)*s.inv));
      const px=s.a.x+s.dx*t,pz=s.a.z+s.dz*t;
      return {x:px,y:s.a.y+s.dy*t,z:pz,distance:Math.sqrt((x-px)**2+(z-pz)**2),segment:s.index,progress:(s.index+t)%path.length};
    };
    return (x,z)=> {
      const local=cells.get(Math.floor(x/16))?.get(Math.floor(z/16));
      const result=search(local??all,x,z);
      return local && result.distance>=12 ? search(all,x,z) : result;
    };
  } catch { return null; }
}
