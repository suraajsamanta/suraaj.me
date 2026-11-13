import { randomBytes, randomInt } from 'node:crypto';
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const token=()=>randomBytes(24).toString('base64url');
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const bounded=(x,n)=>object(x)&&Buffer.byteLength(JSON.stringify(x))<=n;
const seat=(role,name)=>({role,name,id:token(),session:token(),peer:null,expires:0});
const maxIdle=6*60*60*1000;

export class PartyService {
  rooms=new Map(); peers=new Map();
  constructor({now=Date.now,maxPlayers=10,maxRooms=100}={}) {
    this.now=now;this.maxPlayers=maxPlayers;this.maxRooms=maxRooms;
  }
  connect(peer){this.peers.set(peer,{since:this.now(),count:0});}
  error(peer,code,message,fatal=false){peer.send({type:'error',code,message,fatal});if(fatal)peer.close();}
  seats(r){return [r.host,...r.players.values(),...(r.judge?[r.judge]:[])];}
  view(r){return {code:r.code,game:r.game,locked:r.locked,hostConnected:!!r.host.peer,judgeConnected:!!r.judge?.peer,players:[...r.players.values()].map(({id,name,peer})=>({id,name,connected:!!peer}))};}
  update(r){for(const s of this.seats(r))s.peer?.send({type:'room',room:this.view(r)});}
  attach(peer,r,s){
    if(s.peer&&s.peer!==peer){const old=s.peer;this.peers.delete(old);this.error(old,'session_replaced','Your seat moved to another tab.',true);}
    s.peer=peer;s.expires=0;Object.assign(this.peers.get(peer),{room:r,seat:s});
    peer.send({type:'welcome',room:this.view(r),role:s.role,playerId:s.id,session:s.session,...(s.role==='host'&&r.invite?{judgeInvite:r.invite}:{})});
    if(r.state&&s.role!=='host')peer.send({type:'state',payload:r.state});
    if(r.judgeState&&s.role==='judge')peer.send({type:'judge_state',payload:r.judgeState});
    this.update(r);
  }
  receive(peer,m){
    const c=this.peers.get(peer);if(!c)return;
    const now=this.now();
    if(now-c.since>=1000){c.since=now;c.count=0;}
    if(++c.count>50)return this.error(peer,'rate_limit','Too many messages. Reconnecting…',true);
    if(!object(m))return this.error(peer,'invalid','Invalid party message.');
    if(!c.room)return this.handshake(peer,m);
    const {room:r,seat:s}=c;
    if(this.rooms.get(r.code)!==r||s.peer!==peer)return;
    r.last=now;
    switch(m.type){
      case 'action':
        if(s.role==='host'||!bounded(m.payload,4096))return this.error(peer,'invalid_action','Invalid party action.');
        if(!r.host.peer)return this.error(peer,'host_offline','Host is reconnecting. Please try again.');
        r.host.peer.send({type:'action',playerId:s.id,role:s.role,payload:m.payload});break;
      case 'state':
      case 'judge_state':
        if(s.role!=='host')return this.error(peer,'forbidden','Only the host can publish state.');
        if(!bounded(m.payload,32768))return this.error(peer,'invalid_state','Invalid party state.');
        if(m.type==='state'){r.state=m.payload;for(const q of this.seats(r))if(q.role!=='host')q.peer?.send({type:'state',payload:m.payload});}
        else {r.judgeState=m.payload;r.judge?.peer?.send({type:'judge_state',payload:m.payload});}
        break;
      case 'lock':
        if(s.role!=='host'||typeof m.locked!=='boolean')return this.error(peer,'forbidden','Only the host can lock a room.');
        r.locked=m.locked;this.update(r);break;
      case 'leave':
        if(s.role==='host'){this.end(r);break;}
        this.peers.delete(peer);s.peer=null;
        if(s.role==='judge')r.judge=null;else r.players.delete(s.id);
        this.update(r);peer.close();break;
      default:return this.error(peer,'invalid','Invalid party message.');
    }
  }
  handshake(peer,m){
    if(m.type==='create'){
      if(!['simulator','jeopardy'].includes(m.game))return this.error(peer,'invalid_game','Unknown party game.',true);
      if(this.rooms.size>=this.maxRooms)return this.error(peer,'capacity','Too many open rooms. Try again soon.',true);
      let code;do{code=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');}while(this.rooms.has(code));
      const r={code,game:m.game,host:seat('host','Host'),players:new Map(),judge:null,locked:false,invite:m.game==='simulator'?token():null,state:null,judgeState:null,last:this.now()};
      this.rooms.set(code,r);this.attach(peer,r,r.host);return;
    }
    const r=typeof m.code==='string'&&this.rooms.get(m.code.trim().toUpperCase());
    if(!r||(m.game&&m.game!==r.game))return this.error(peer,'not_found','Room not found for this game.',true);
    if(m.type==='resume'){
      const s=typeof m.session==='string'&&this.seats(r).find(q=>q.session===m.session);
      if(!s||(s.expires&&s.expires<=this.now()))return this.error(peer,'invalid_session','This seat has expired. Join again.',true);
      this.attach(peer,r,s);return;
    }
    if(m.type==='judge'){
      if(!r.invite||m.invite!==r.invite||r.judge)return this.error(peer,'invalid_invite','Judge link is invalid or already in use.',true);
      r.judge=seat('judge','Judge');this.attach(peer,r,r.judge);return;
    }
    if(m.type!=='join')return this.error(peer,'invalid','Invalid party connection.',true);
    if(r.locked)return this.error(peer,'locked','This game has started. Join the next match.',true);
    if(r.players.size>=this.maxPlayers)return this.error(peer,'capacity','This room is full.',true);
    const name=typeof m.name==='string'?m.name.trim():'';
    if(!name||Array.from(name).length>64||/[\p{Cc}\p{Cf}]/u.test(name))return this.error(peer,'invalid_name','Enter a name of 1–64 characters.',true);
    const s=seat('player',name);r.players.set(s.id,s);this.attach(peer,r,s);
  }
  disconnect(peer){
    const c=this.peers.get(peer);this.peers.delete(peer);
    if(!c?.room||c.seat.peer!==peer||this.rooms.get(c.room.code)!==c.room)return;
    c.seat.peer=null;c.seat.expires=this.now()+(c.seat.role==='host'?120000:90000);this.update(c.room);
  }
  end(r){
    this.rooms.delete(r.code);
    for(const s of this.seats(r))if(s.peer){this.peers.delete(s.peer);s.peer.send({type:'room_closed'});s.peer.close();}
  }
  sweep(){
    const now=this.now();
    for(const r of this.rooms.values()){
      if((r.host.expires&&r.host.expires<=now)||now-r.last>maxIdle){this.end(r);continue;}
      let changed=false;
      if(r.judge?.expires&&r.judge.expires<=now){r.judge=null;changed=true;}
      for(const [id,s] of r.players)if(s.expires&&s.expires<=now){r.players.delete(id);changed=true;}
      if(changed)this.update(r);
    }
  }
}
