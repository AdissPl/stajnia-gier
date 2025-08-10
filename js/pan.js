
(function(){
  const db = SG.fb.db;
  const roomId = SG.roomIdFromUrl();
  const roomRef = db.collection('rooms').doc(roomId);
  const stateRef = roomRef.collection('state').doc('pan');
  const leaderboard = db.collection('leaderboard_pan');

  const root = document.querySelector('main') || document.body;
  const wrap = document.createElement('div');
  wrap.className='table';
  wrap.innerHTML = `
    <div class="center"><div class="big">Pan (President)</div></div>
    <div class="center small">Pokój: <span id="rid"></span> • Tura: <span id="turn"></span></div>
    <div class="center"><div id="topPile" class="pile"></div></div>
    <div class="center small" id="status"></div>
    <div class="panel"><div class="big">Twoja ręka</div><div id="hand" class="stack"></div>
      <div class="row"><button id="btnPass" class="btn secondary">Pas (weź kary)</button></div>
    </div>
  `;
  root.appendChild(wrap);
  document.getElementById('rid').textContent = (roomId||'').slice(0,6);

  let uid = null, players=[], isHost=false;
  const order = ['9','10','J','Q','K','A'];
  const value = (r)=> order.indexOf(r);

  function buildDeck24(){
    const d=[];
    for (const s of SG.suits){
      for (const r of order){
        d.push({r,s});
      }
    }
    return d;
  }

  roomRef.onSnapshot(doc=>{
    const r = doc.data()||{};
    uid = SG.currentUser?.uid||null;
    isHost = r.host===uid;
    players = Object.keys(r.seats||{}).slice(0,4);
  });

  async function initGame(){
    const deck = SG.shuffle(buildDeck24());
    const hands = {};
    for (const p of players) hands[p]=[];
    let i=0; while (deck.length){ hands[players[i%players.length]].push(deck.shift()); i++; }
    // who has 9♥ starts, pile starts at that
    let turn = 0;
    for (let k=0;k<players.length;k++){
      const p=players[k];
      if (hands[p].some(c=>c.r==='9' && c.s==='♥')){ turn=k; break; }
    }
    const s = { players, hands, pile: [{r:'9',s:'♥'}], top:{r:'9',s:'♥'}, turn, status:'Start'};
    // remove 9♥ from that player's hand
    const startP = players[turn];
    const idx = s.hands[startP].findIndex(c=>c.r==='9' && c.s==='♥');
    if (idx>=0) s.hands[startP].splice(idx,1);
    await stateRef.set(s);
    await roomRef.update({status:'ongoing'});
  }

  function canPlay(card, s){
    return value(card.r) >= value(s.top.r);
  }

  async function play(i){
    const snap = await stateRef.get(); const s = snap.data();
    if (s.players[s.turn]!==uid) return;
    const card = s.hands[uid][i];
    if (!canPlay(card, s)) return;
    s.hands[uid].splice(i,1);
    s.pile.push(card);
    s.top = card;
    s.status = `Zagrano ${card.r}${card.s}`;
    // win condition - hand empty -> rank 1
    if (s.hands[uid].length===0){
      await leaderboard.doc(uid).set({wins: firebase.firestore.FieldValue.increment(1)}, {merge:true});
      s.status = 'Wyszedłeś z kart — wygrana rundy';
      await stateRef.set(s);
      await roomRef.update({status:'waiting'});
      return;
    }
    s.turn = (s.turn+1)%s.players.length;
    await stateRef.set(s);
  }

  async function pass(){
    const snap = await stateRef.get(); const s = snap.data();
    if (s.players[s.turn]!==uid) return;
    // kara: jeśli na stosie <=3 kart, weź wszystkie poza 9♥; inaczej weź 3 z wierzchu
    if (s.pile.length<=3){
      const taken = s.pile.filter(c=> !(c.r==='9' && c.s==='♥'));
      s.pile = s.pile.filter(c=> (c.r==='9' && c.s==='♥'));
      s.hands[uid].push(...taken);
    } else {
      const taken = s.pile.splice(-3);
      s.hands[uid].push(...taken);
    }
    s.status = 'Pas — pobierasz kary';
    s.turn = (s.turn+1)%s.players.length;
    await stateRef.set(s);
  }

  function render(s){
    document.getElementById('turn').textContent = `${s.turn+1}/${s.players.length}`;
    const pile = document.getElementById('topPile'); pile.innerHTML=''; pile.appendChild(SG.cardEl(s.top));
    document.getElementById('status').textContent = s.status||'';
    const my = s.hands[uid]||[]; const hand = document.getElementById('hand'); hand.innerHTML='';
    my.forEach((c,i)=>{
      const el = SG.cardEl(c);
      if (!canPlay(c,s)) el.style.opacity=.45;
      el.onclick = ()=> play(i);
      hand.appendChild(el);
    });
    document.getElementById('btnPass').disabled = s.players[s.turn]!==uid;
  }

  // Host hotkey
  document.addEventListener('keydown', async (e)=>{ if (isHost && e.key.toLowerCase()==='r'){ await initGame(); } });

  stateRef.onSnapshot(snap=>{ if (snap.exists) render(snap.data()); });

  // Chat
  const chatMount = document.createElement('div'); document.body.appendChild(chatMount);
  if (roomId){ chatMount.appendChild(Chat(roomId)); }
})();

  // Mount admin panel
  (function(){ const mount = document.getElementById('adminMount'); const rid = SG.roomIdFromUrl(); if (mount && rid) mount.appendChild(AdminPanel(rid)); })();

  // Voice mount
  (function(){ const m = document.getElementById('voiceMount'); if (m) m.appendChild(Voice()); })();


  // Hierarchies across rounds
  const Titles = ['Prezydent','Premier','Sekretarz','Pan'];
  const stateRef = SG.fb.db.collection('rooms').doc(SG.roomIdFromUrl()).collection('state').doc('pan');

  async function newRound(){
    const snap = await stateRef.get(); let s = snap.data();
    // determine titles based on finish order from last round (we track exits array)
    if (!s || !s.players) return;
    if (!s.total) s.total = {};
    // assign titles by exitOrder
    const order = (s.exitOrder||[]).concat(s.players.filter(p=> !(s.exitOrder||[]).includes(p)));
    s.titles = {};
    for (let i=0;i<order.length;i++){
      s.titles[order[i]] = Titles[i] || 'Pan';
    }
    // exchange cards: President gets best from Pan, gives worst
    const pres = order[0], pan = order[order.length-1];
    if (pres && pan && s.hands && s.hands[pres] && s.hands[pan]){
      // assume hands filled from initGame(); pick best/worst by rank
      const rankv = {'9':1,'10':2,'J':3,'Q':4,'K':5,'A':6};
      s.hands[pres].sort((a,b)=> rankv[a.r]-rankv[b.r]); // ascending
      s.hands[pan].sort((a,b)=> rankv[b.r]-rankv[a.r]); // descending
      const worstFromPres = s.hands[pres].shift();
      const bestFromPan = s.hands[pan].shift();
      if (worstFromPres && bestFromPan){
        s.hands[pres].push(bestFromPan);
        s.hands[pan].push(worstFromPres);
        s.status = 'Wymiana kart między Prezydentem a Panem wykonana.';
      }
    }
    s.exitOrder = [];
    await stateRef.set(s);
  }

  function rankValue(r){ return ({'9':1,'10':2,'J':3,'Q':4,'K':5,'A':6})[r]||0; }

  async function settleRoundAndTitle(s, winnerUid){
    s.exitOrder = s.exitOrder||[];
    if (!s.exitOrder.includes(winnerUid)) s.exitOrder.push(winnerUid);
    const left = Object.values(s.hands).reduce((a,b)=>a+b.length,0);
    if (left===0){
      // assign titles
      const order = s.exitOrder.concat(s.players.filter(p=> !s.exitOrder.includes(p)));
      const titlesMap = {};
      const Titles = ['Prezydent','Premier','Sekretarz','Pan'];
      order.forEach((u,i)=> titlesMap[u]=Titles[i] || 'Pan');
      s.titles = titlesMap;
      s.status = 'Zamknięto rundę. Nadano tytuły.';
    }
    return s;
  }

  async function exchangeForNextRound(){
    const snap = await stateRef.get(); let s = snap.data();
    if (!s || !s.titles) return;
    const order = s.players.slice();
    const byTitle = (t)=> Object.entries(s.titles).find(([u,v])=>v===t)?.[0];
    const pres = byTitle('Prezydent'), panU = byTitle('Pan'), prem = byTitle('Premier'), sek = byTitle('Sekretarz');
    if (!(pres && panU)) return;
    function sortAsc(h){ h.sort((a,b)=> rankValue(a.r)-rankValue(b.r)); }
    function sortDesc(h){ h.sort((a,b)=> rankValue(b.r)-rankValue(a.r)); }
    const give = (from,to,count)=>{
      for (let i=0;i<count;i++){
        sortAsc(s.hands[from]); const worst = s.hands[from].shift(); if (!worst) break;
        sortDesc(s.hands[to]); const best = s.hands[to].shift(); if (!best) break;
        s.hands[from].push(best); s.hands[to].push(worst);
      }
    };
    const pcount = s.players.length;
    if (pcount===4){
      give(pres, panU, 2); // two exchanges
      if (prem && sek){ give(prem, sek, 1); }
    } else {
      give(pres, panU, 1);
    }
    s.status = 'Wykonano wymiany kart wg tytułów.';
    s.exitOrder = [];
    await stateRef.set(s);
  }
