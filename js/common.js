
window.SG = window.SG || {};

SG.suits = ['♣','♦','♥','♠'];
SG.ranks = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
SG.rankValue = (r)=>{
  const order = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
  return order[r] || 0;
};
SG.buildDeck52 = ()=>{
  const d = [];
  for (const s of SG.suits){
    for (const r of SG.ranks){
      d.push({r,s});
    }
  }
  return d;
};
SG.shuffle = (arr)=>{
  for (let i = arr.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
};
SG.cardEl = (c)=>{
  const el = document.createElement('div');
  el.className = 'card-ui'+(c.s==='♦' || c.s==='♥' ? ' red':'');
  el.innerHTML = `<div>${c.r}</div><div class="suit">${c.s}</div>`;
  return el;
};
SG.qs = (sel)=>document.querySelector(sel);
SG.params = new URLSearchParams(location.search);
SG.gameFromUrl = ()=> SG.params.get('game') || 'wojna';
SG.roomIdFromUrl = ()=> SG.params.get('room') || null;

// Firebase helpers
SG.fb = {
  app: null,
  auth: null,
  db: null,
  init(){
    const conf = window.FB_CONF;
    this.app = firebase.initializeApp(conf);
    this.auth = firebase.auth();
    this.db = firebase.firestore();
    return this;
  }
};
SG.currentUser = null;
SG.displayName = null;

SG.formatRole = (role)=>{
  const m = {owner:'Owner', admin:'Admin', mod:'Moderator', player:'Player'};
  return m[role]||'Player';
};

SG.getRoleDoc = async (uid)=>{
  const db = SG.fb.db;
  const doc = await db.collection('roles').doc(uid).get();
  if (doc.exists) return doc.data();
  return {role:'player'};
};

SG.ensureProfile = async (uid, displayName)=>{
  const db = SG.fb.db;
  const ref = db.collection('profiles').doc(uid);
  await ref.set({ displayName: displayName||'Gracz', updated: firebase.firestore.FieldValue.serverTimestamp() }, {merge:true});
};

SG.saveDisplayName = async ()=>{
  const inp = document.getElementById('displayName');
  if (!SG.currentUser) return alert('Zaloguj się.');
  const name = (inp.value||'Gracz').slice(0,24);
  await SG.fb.db.collection('profiles').doc(SG.currentUser.uid).set({displayName:name},{merge:true});
  alert('Zapisano.');
};

SG.getDisplayName = async (uid)=>{
  const d = await SG.fb.db.collection('profiles').doc(uid).get();
  return d.exists && d.data().displayName || 'Gracz';
};

SG.exitRoom = ()=>{
  const back = 'lobby.html?game='+ (SG.params.get('game')||'wojna');
  location.href = back;
};

window.DebugHUD = (label='HUD')=>{
  const box = document.createElement('div');
  box.style.cssText='position:fixed;right:10px;bottom:10px;background:var(--panel);border:1px solid var(--border);padding:8px;z-index:9999;font-size:12px;color:var(--muted)';
  box.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><div style="font-weight:bold;color:var(--text)">${label}</div><button id="hudBtn" class="btn ghost">Ping</button></div><div id="hudBody" class="small"></div>`;
  const body = box.querySelector('#hudBody');
  function render(extra){ body.innerHTML = (extra||'') + `<div>UID: ${SG.currentUser?.uid?.slice(0,6)||'–'}</div>`; }
  box.querySelector('#hudBtn').onclick = async ()=>{
    const t = performance.now();
    await SG.fb.db.collection('_ping').doc('x').get().catch(()=>{});
    const ms = (performance.now()-t).toFixed(0);
    render(`<div>Firestore ping: ${ms} ms</div>`);
  };
  render();
  document.body.appendChild(box);
  return box;
};
document.addEventListener('keydown', (e)=>{ if (e.key==='`'){ window.__hud = window.__hud || DebugHUD('Debug'); else { if (window.__hud){ window.__hud.remove(); window.__hud=null; } } }});
