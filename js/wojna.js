
(function(){
  const db = SG.fb.db;
  const roomId = SG.roomIdFromUrl();
  const roomRef = db.collection('rooms').doc(roomId);
  const stateRef = roomRef.collection('state').doc('wojna');
  const leaderboard = db.collection('leaderboard_wojna');

  const p1Name = document.getElementById('p1Name');
  const p2Name = document.getElementById('p2Name');
  const p1Count = document.getElementById('p1Count');
  const p2Count = document.getElementById('p2Count');
  const pile1 = document.getElementById('pile1');
  const pile2 = document.getElementById('pile2');
  const statusEl = document.getElementById('status');
  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  const btnReset = document.getElementById('btnReset');
  const roomIdLabel = document.getElementById('roomIdLabel');
  const roleBadge = document.getElementById('roleBadge');

  roomIdLabel.textContent = roomId ? roomId.slice(0,6) : 'brak';

  let isHost = false;
  let interval = null;

  // Subscribe room to resolve host and players
  roomRef.onSnapshot(async (doc)=>{
    const r = doc.data();
    if (!r) return;
    isHost = (SG.currentUser && r.host === SG.currentUser.uid);
    roleBadge.textContent = isHost ? 'Host' : 'Player';
    roleBadge.className = 'role ' + (isHost ? 'admin' : 'player');

    // names
    const uids = Object.keys(r.seats||{});
    const [u1,u2] = uids.slice(0,2);
    p1Name.textContent = await SG.getDisplayName(u1||'') || 'Gracz 1';
    p2Name.textContent = await SG.getDisplayName(u2||'') || 'Gracz 2';
    btnStart.disabled = !isHost;
    btnPause.disabled = !isHost;
    btnReset.disabled = !isHost;
  });

  // Render helpers
  function renderState(s){
    p1Count.textContent = s.p1.length;
    p2Count.textContent = s.p2.length;
    pile1.innerHTML=''; pile2.innerHTML='';
    for (const c of s.pile1.slice(-3)) pile1.appendChild(SG.cardEl(c));
    for (const c of s.pile2.slice(-3)) pile2.appendChild(SG.cardEl(c));
    statusEl.textContent = s.status || '';
  }

  // State machine for host
  async function initGame(){
    const deck = SG.shuffle(SG.buildDeck52());
    const p1 = deck.slice(0,26);
    const p2 = deck.slice(26);
    const s = {p1, p2, pile1:[], pile2:[], war:false, paused:false, status:'Start'};
    await stateRef.set(s);
    await roomRef.update({status:'ongoing'});
  }

  function compareCards(a,b){
    return SG.rankValue(a.r) - SG.rankValue(b.r);
  }

  async function step(){
    const snap = await stateRef.get();
    if (!snap.exists) return;
    const s = snap.data();
    if (s.paused) return;

    // check end
    if (s.p1.length===0 || s.p2.length===0){
      const winner = s.p1.length>0 ? 'p1' : 'p2';
      await endGame(winner);
      return;
    }

    // draw cards
    const c1 = s.p1.shift();
    const c2 = s.p2.shift();
    s.pile1.push(c1);
    s.pile2.push(c2);

    const cmp = compareCards(c1,c2);
    if (cmp>0){
      // p1 wins this battle
      const won = [...s.pile1, ...s.pile2];
      s.p1.push(...won);
      s.pile1 = []; s.pile2 = [];
      s.status = `P1 wygrywa lewę (${c1.r}${c1.s} > ${c2.r}${c2.s})`;
      s.war = false;
    }else if (cmp<0){
      const won = [...s.pile1, ...s.pile2];
      s.p2.push(...won);
      s.pile1 = []; s.pile2 = [];
      s.status = `P2 wygrywa lewę (${c2.r}${c2.s} > ${c1.r}${c1.s})`;
      s.war = false;
    }else{
      // war: need to put one face-down card each if possible
      s.status = `WOJNA! (${c1.r})`;
      s.war = true;
      for (let i=0;i<1;i++){
        if (s.p1.length>0) s.pile1.push(s.p1.shift());
        if (s.p2.length>0) s.pile2.push(s.p2.shift());
      }
    }
    await stateRef.set(s);
  }

  async function endGame(winnerKey){
    const s = (await stateRef.get()).data();
    const uids = Object.keys((await roomRef.get()).data().seats||{});
    const [u1,u2] = uids.slice(0,2);
    const winnerUid = winnerKey==='p1' ? u1 : u2;
    await stateRef.update({status: (winnerKey==='p1'?'P1':'P2') + ' wygrywa grę!', paused:true});
    // leaderboard increment
    if (winnerUid){
      await leaderboard.doc(winnerUid).set({wins: firebase.firestore.FieldValue.increment(1)}, {merge:true});
    }
    await roomRef.update({status:'waiting'});
    clearInterval(interval); interval=null;
  }

  // Host controls
  btnStart.onclick = async ()=>{
    if (!isHost) return;
    await initGame();
    if (interval) clearInterval(interval);
    interval = setInterval(step, 900);
  };
  btnPause.onclick = async ()=>{
    if (!isHost) return;
    await stateRef.set({paused:true}, {merge:true});
    if (interval){ clearInterval(interval); interval=null; }
  };
  btnReset.onclick = async ()=>{
    if (!isHost) return;
    await initGame();
  };

  // Everyone listens to state
  stateRef.onSnapshot(snap=>{
    if (!snap.exists) return;
    renderState(snap.data());
  });
})();

  // mount chat
  const chatMount = document.getElementById('chatMount');
  if (chatMount && roomId){ chatMount.appendChild(Chat(roomId)); }


  // RTC integration (optional)
  let rtcHub=null, rtcPeer=null;
  SG.RTC.onMessage(async (msg, from)=>{
    if (isHost){
      if (msg.type==='req:step'){ await step(); }
      if (msg.type==='req:init'){ await initGame(); }
      if (msg.type==='req:pause'){ await stateRef.set({paused:true},{merge:true}); }
    } else {
      if (msg.type==='state:update'){
        // peers can optimistically render, Firestore remains source of truth
        if (msg.state){ renderState(msg.state); }
      }
    }
  });
  roomRef.onSnapshot(async (doc)=>{
    const r = doc.data();
    if (!r) return;
    if (r.host === SG.currentUser?.uid){
      // host
      rtcHub = await SG.RTC.createHostHub(roomId);
    }else{
      rtcPeer = await SG.RTC.joinAsPeer(roomId);
    }
  });

  async function pushStateRTC(s){
    if (rtcHub){ rtcHub.sendAll({type:'state:update', state: s}); }
  }

  // after every state set, also try push over RTC
  const _set = stateRef.set.bind(stateRef);
  stateRef.set = async function(s, opts){
    const res = await _set(s, opts);
    try{ await pushStateRTC((await stateRef.get()).data()); }catch(e){}
    return res;
  }

  // Mount admin panel
  (function(){ const mount = document.getElementById('adminMount'); const rid = SG.roomIdFromUrl(); if (mount && rid) mount.appendChild(AdminPanel(rid)); })();

  // Voice mount
  (function(){ const m = document.getElementById('voiceMount'); if (m) m.appendChild(Voice()); })();
