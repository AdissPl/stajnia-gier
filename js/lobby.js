
(function(){
  const db = SG.fb.db;
  const params = new URLSearchParams(location.search);
  const game = params.get('game') || 'wojna';
  const roomsList = document.getElementById('roomsList');
  const filter = document.getElementById('filterStatus');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnCreate = document.getElementById('btnCreate');

  const gamePage = (g)=> ({
    'wojna':'game-wojna.html',
    'makao':'game-makao.html',
    'pan':'game-pan.html',
    'tysiac':'game-tysiac.html'
  }[g] || 'game-wojna.html');

  async function loadRooms(){
    roomsList.innerHTML = '';
    let q = db.collection('rooms').where('game','==',game);
    const f = filter.value;
    if (f==='waiting') q = q.where('status','==','waiting');
    if (f==='ongoing') q = q.where('status','==','ongoing');
    const snap = await q.orderBy('created','desc').limit(30).get();
    if (snap.empty){
      roomsList.innerHTML = '<div class="small">Brak pokoi. Utwórz nowy.</div>';
      return;
    }
    snap.forEach(doc=>{
      const r = doc.data();
      const div = document.createElement('div');
      div.className='item';
      const seatsTaken = Object.keys(r.seats||{}).length;
      div.innerHTML = `
        <div>
          <div><strong>${r.name || 'Pokój'}</strong> <span class="small">#${doc.id.slice(0,6)}</span></div>
          <div class="small">${r.public ? 'Publiczny' : 'Prywatny'} • status: ${r.status} • graczy: ${seatsTaken}/${r.maxSeats}</div>
        </div>
        <div class="row">
          <button class="btn" data-id="${doc.id}">Dołącz</button>
          ${r.public ? '' : '<span class="badge">kłódka</span>'}
          ${SG.currentUser && r.host===SG.currentUser.uid ? `
            <button class='btn ghost' onclick="(${adminAction.toString()}), adminAction('${doc.id}', 'togglePublic')">Pub/Pryv</button>
          `:''}
        </div>`;
      div.querySelector('button').onclick = ()=> joinRoom(doc.id, r);
      roomsList.appendChild(div);
    });
  }

  async function joinRoom(roomId, room){
    // banlist check
    const rdoc = await db.collection('rooms').doc(roomId).get();
    const rdata = rdoc.data()||{};
    const banned = (rdata.banlist||[]);
    if (SG.currentUser && banned.includes(SG.currentUser.uid)) { alert('Dostęp zablokowany przez hosta.'); return; }

    const uid = SG.currentUser?.uid;
    if (!uid){ alert('Zaloguj się.'); return; }
    const ref = db.collection('rooms').doc(roomId);
    await db.runTransaction(async (tx)=>{
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error('Pokój nie istnieje.');
      const data = snap.data();
      const seats = data.seats || {};
      if (!seats[uid]) seats[uid] = {joined: firebase.firestore.FieldValue.serverTimestamp()};
      tx.update(ref, {seats});
    });
    location.href = `${gamePage(game)}?game=${game}&room=${roomId}`;
  }

  btnRefresh.onclick = loadRooms;
  btnCreate.onclick = async ()=>{
    const uid = SG.currentUser?.uid;
    if (!uid){ alert('Zaloguj się.'); return; }
    const name = document.getElementById('roomName').value.trim();
    const vis = document.getElementById('roomVisibility').value==='public';
    const maxSeats = parseInt(document.getElementById('roomSeats').value||'2',10);
    const doc = await db.collection('rooms').add({
      game, name: name||null, public: vis, host: uid, status:'waiting',
      maxSeats: Math.max(2, Math.min(6, maxSeats)),
      seats: {[uid]: {joined: firebase.firestore.FieldValue.serverTimestamp()}},
      options: Object.assign({ makaoPenalty:5, makaoJoker:false }, opts||{}),
      banlist: [],
      created: firebase.firestore.FieldValue.serverTimestamp()
    });
    location.href = `${gamePage(game)}?game=${game}&room=${doc.id}`;
  };

  
  // Minimal admin actions inside lobby listing (for rooms where user is host)
  async function adminAction(roomId, action, targetUid){
    const ref = db.collection('rooms').doc(roomId);
    const snap = await ref.get();
    if (!snap.exists) return;
    const r = snap.data();
    if (r.host !== SG.currentUser?.uid) { alert('Tylko host.'); return; }
    if (action==='togglePublic'){
      await ref.update({public: !r.public});
      await db.collection('audit').add({ts: firebase.firestore.FieldValue.serverTimestamp(), type:'admin:togglePublic', room:roomId, user: SG.currentUser.uid, details:{public:!r.public}});
    } else if (action==='transferHost' && targetUid){
      await ref.update({host: targetUid});
      await db.collection('audit').add({ts: firebase.firestore.FieldValue.serverTimestamp(), type:'admin:transferHost', room:roomId, user: SG.currentUser.uid, details:{to:targetUid}});
    } else if (action==='kick' && targetUid){
      const seats = r.seats || {};
      delete seats[targetUid];
      await ref.update({seats});
      await db.collection('audit').add({ts: firebase.firestore.FieldValue.serverTimestamp(), type:'admin:kick', room:roomId, user: SG.currentUser.uid, details:{target:targetUid}});
    }
    await loadRooms();
  }

  loadRooms();
})();

  // Wizard navigation
  (function(){
    const w1=document.getElementById('w1'), w2=document.getElementById('w2'), w3=document.getElementById('w3'); if (!w1) return;
    const step=document.getElementById('wizardStep');
    function show(s){ step.textContent=s; w1.style.display=s==1?'':'none'; w2.style.display=s==2?'':'none'; w3.style.display=s==3?'':'none'; }
    document.getElementById('wNext1').onclick=()=>show(2);
    document.getElementById('wNext2').onclick=()=>show(3);
    document.getElementById('wBack1').onclick=()=>show(1);
    document.getElementById('wBack2').onclick=()=>show(2);
    document.getElementById('wCreate').onclick=async ()=>{
      const game = document.getElementById('wGame').value;
      const name = document.getElementById('wName').value;
      const vis = document.getElementById('wPublic').value==='true';
      const maxSeats = parseInt(document.getElementById('wSeats').value||'4',10);
      const opts = {
        makaoPenalty: parseInt(document.getElementById('wMakaoPenalty').value||'5',10),
        makaoJoker: document.getElementById('wMakaoJoker').value==='on',
        makaoExtraKings: document.getElementById('wMakaoExtraKings').value==='on'
      };
      await createRoom(game, name, vis, maxSeats, opts);
    };
  })();
