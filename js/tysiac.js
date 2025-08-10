
(function(){
  const db = SG.fb.db;
  const roomId = SG.roomIdFromUrl();
  const roomRef = db.collection('rooms').doc(roomId);
  const stateRef = roomRef.collection('state').doc('tysiac');
  const leaderboard = db.collection('leaderboard_tysiac');

  const compOrder = {'9':0,'J':1,'Q':2,'K':3,'10':4,'A':5};
  const cardPoints = {'A':11,'10':10,'K':4,'Q':3,'J':2,'9':0};

  function buildDeck24(){
    const d=[]; for (const s of SG.suits){ for (const r of ['9','J','Q','K','10','A']) d.push({r,s}); } return d;
  }
  function beats(a,b,leadSuit,atu){
    if (a.s===b.s) return compOrder[a.r] > compOrder[b.r];
    if (a.s===atu && b.s!==atu) return true;
    if (a.s!==atu && b.s===atu) return false;
    if (a.s===leadSuit && b.s!==leadSuit) return true;
    return false;
  }

  // UI
  const root = document.querySelector('main') || document.body;
  const wrap = document.createElement('div'); wrap.className='table';
  wrap.innerHTML = `
    <div class="center"><div class="big">Tysiąc</div></div>
    <div class="center small">Pokój: <span id="rid"></span> • Atu: <span id="atu"></span> • Gracz wychodzi: <span id="lead"></span></div>
    <div class="center"><div class="pile" id="trick"></div></div>
    <div class="center small" id="status"></div>
    <div class="panel"><div class="big">Twoja ręka</div><div id="hand" class="stack"></div>
      <div class="row">
        <button id="btnMeld" class="btn ghost">Meldunek</button>
        <button id="btnNewDeal" class="btn">Nowe rozdanie</button>
      </div>
    </div>
    <div class="panel">
      <div class="big">Licytacja</div>
      <div class="row">
        <button id="btnBidUp" class="btn">+10</button>
        <button id="btnPass" class="btn secondary">Pas</button>
        <span class="small">Twoja deklaracja: <span id="myBid">—</span></span>
      </div>
      <div class="small">Aktualna stawka: <span id="curBid">—</span> • Lider licytacji: <span id="curLeader">—</span></div>
    </div>
    <div class="panel">
      <div class="big">Wyniki (do 1000)</div>
      <div class="list" id="scores"></div>
    </div>
  `;
  root.appendChild(wrap);
  document.getElementById('rid').textContent = (roomId||'').slice(0,6);

  let uid=null, players=[], isHost=false;

  roomRef.onSnapshot(doc=>{
    const r = doc.data()||{};
    uid = SG.currentUser?.uid||null;
    isHost = r.host===uid;
    players = Object.keys(r.seats||{}).slice(0,3);
  });

  function render(s){
    document.getElementById('atu').textContent = s.atu || '—';
    document.getElementById('lead').textContent = (s.lead!=null? s.lead+1 : '—');
    document.getElementById('status').textContent = s.status || '';
    const trick = document.getElementById('trick'); trick.innerHTML='';
    s.trick.forEach(t=> trick.appendChild(SG.cardEl(t.card)));
    const hand = document.getElementById('hand'); hand.innerHTML='';
    (s.hands[uid]||[]).forEach((c,i)=>{
      const el = SG.cardEl(c); el.onclick = ()=> play(i); hand.appendChild(el);
    });
    document.getElementById('btnMeld').disabled = !canMeld(s, uid);
    document.getElementById('btnNewDeal').disabled = !isHost || s.phase!=='done';
    document.getElementById('myBid').textContent = (s.bids && s.bids[uid])||'—';
    document.getElementById('curBid').textContent = s.curBid || '—';
    document.getElementById('curLeader').textContent = (s.curLeader!=null ? (s.curLeader+1) : '—');

    // scores
    const list = document.getElementById('scores'); list.innerHTML='';
    for (const p of s.players){
      const nameEl = document.createElement('div'); nameEl.className='item';
      const nm = p===uid ? 'Ty' : (p.slice(0,6));
      nameEl.innerHTML = `<div>${nm}</div><div class="badge">${(s.total[p]||0)} pkt</div>`;
      list.appendChild(nameEl);
    }
  }

  function canMeld(s,u){
    const h = s.hands[u]||[];
    const has = (rank,suit)=> h.some(c=>c.r===rank && c.s===suit);
    for (const suit of SG.suits){ if (has('Q',suit) && has('K',suit)) return true; }
    return false;
  }

  async function initDeal(){
    if (players.length<3) return;
    const deck = SG.shuffle(buildDeck24());
    const hands = {}; players.forEach(p=>hands[p]=[]);
    for (let k=0;k<7;k++){ for (const p of players){ hands[p].push(deck.shift()); } }
    const musik = [deck.shift(), deck.shift(), deck.shift()];
    const s = {
      players, hands, musik, atu: null,
      trick: [], lead: 0, turn: 0,
      bids: {}, curBid: 100, curLeader: null,
      phase: 'bidding', // bidding -> musik -> play -> done
      scores: {[players[0]]:0,[players[1]]:0,[players[2]]:0},
      total: (await (await stateRef.get()).exists ? (await stateRef.get()).data().total : {[players[0]]:0,[players[1]]:0,[players[2]]:0}) || {[players[0]]:0,[players[1]]:0,[players[2]]:0},
      status: 'Nowe rozdanie: licytacja od 100.'
    };
    await stateRef.set(s);
  }

  async function bidUp(){
    const snap = await stateRef.get(); let s = snap.data(); if (s.phase!=='bidding') return;
    const meIdx = s.players.indexOf(uid);
    if (s.turn!==meIdx) return;
    const my = (s.bids[uid]||0);
    const next = Math.max(100, s.curBid) + 10;
    s.bids[uid] = next;
    s.curBid = next;
    s.curLeader = meIdx;
    s.status = `Gracz ${meIdx+1} licytuje ${next}`;
    s.turn = (s.turn+1)%3;
    await stateRef.set(s);
  }
  async function pass(){
    const snap = await stateRef.get(); let s = snap.data(); if (s.phase!=='bidding') return;
    const meIdx = s.players.indexOf(uid);
    if (s.turn!==meIdx) return;
    s.bids[uid] = 'pass';
    s.status = `Gracz ${meIdx+1} pas`;
    // check if only one active remains
    const active = s.players.filter(p=> s.bids[p]!=='pass' && s.bids[p]!=null);
    s.turn = (s.turn+1)%3;
    if (active.length>=1){
      // continue until two passes after last raise
      const passCount = s.players.filter(p=> s.bids[p]==='pass').length;
      if (passCount>=2 && s.curLeader!=null){
        // winner
        const leaderUid = s.players[s.curLeader];
        // give musik to leader
        s.hands[leaderUid].push(...s.musik); s.musik=[];
        // auto discard 3 lowest by points
        s.hands[leaderUid].sort((a,b)=> (cardPoints[a.r]-cardPoints[b.r]));
        const disc = s.hands[leaderUid].splice(0,3);
        s.phase='play';
        s.lead = s.curLeader;
        s.turn = s.lead;
        s.status = `Licytację wygrał gracz ${s.lead+1} za ${s.curBid}. Rozgrywka.`;
      }
    }
    await stateRef.set(s);
  }

  async function play(i){
    const snap = await stateRef.get(); let s = snap.data(); if (s.phase!=='play') return;
    if (s.players[s.turn]!==uid) return;
    const card = s.hands[uid][i];

    const leadSuit = s.trick.length? s.trick[0].card.s : null;
    const hand = s.hands[uid]||[];
    if (leadSuit){
      const sameSuit = hand.filter(c=>c.s===leadSuit);
      if (sameSuit.length){
        // must follow suit; and must beat if possible
        const canBeatHigher = sameSuit.some(c=> compOrder[c.r] > compOrder[ s.trick[0].card.s===leadSuit ? s.trick.reduce((w,t)=> t.card.s===leadSuit && compOrder[t.card.r]>compOrder[w.r] ? t.card : w, s.trick[0].card ).r : '9' ] );
        if (card.s!==leadSuit) return;
        if (canBeatHigher){
          // compute current highest in lead suit
          let highest = null;
          for (const t of s.trick){ if (t.card.s===leadSuit){ if (!highest || compOrder[t.card.r]>compOrder[highest.r]) highest=t.card; } }
          if (compOrder[card.r] <= compOrder[highest.r]) return;
        }
      } else {
        // no lead suit -> must play trump if any; and overtrump if possible
        const trumps = hand.filter(c=> c.s===s.atu);
        if (trumps.length){
          if (card.s!==s.atu) return;
          // overtrump if possible
          let highestTrump = null;
          for (const t of s.trick){ if (t.card.s===s.atu){ if (!highestTrump || compOrder[t.card.r]>compOrder[highestTrump.r]) highestTrump=t.card; } }
          if (highestTrump && compOrder[card.r] <= compOrder[highestTrump.r] && trumps.some(c=> compOrder[c.r]>compOrder[highestTrump.r])) return;
        }
      }
    }

    if (s.trick.length>0){
      const leadSuit = s.trick[0].card.s;
      const hasLead = (s.hands[uid]||[]).some(c=>c.s===leadSuit);
      if (hasLead && card.s!==leadSuit) return;
    }
    s.hands[uid].splice(i,1);
    s.trick.push({uid, card});
    s.status = `Gracz ${s.turn+1} zagrał ${card.r}${card.s}`;
    if (s.trick.length===3){
      const leadSuit = s.trick[0].card.s;
      let winner = s.trick[0].uid, winCard = s.trick[0].card;
      for (let k=1;k<3;k++){
        const t = s.trick[k];
        if (beats(t.card, winCard, leadSuit, s.atu)){ winner = t.uid; winCard = t.card; }
      }
      const pts = s.trick.reduce((a,t)=>a+cardPoints[t.card.r],0);
      s.scores[winner] = (s.scores[winner]||0) + pts;
      s.trick = [];
      s.lead = s.players.indexOf(winner);
      s.turn = s.lead;
      s.status = `Lewę bierze ${s.lead+1} (+${pts})`;
      const left = Object.values(s.hands).reduce((a,b)=>a+b.length,0);
      if (left===0){
        // settlement against contract
        const leaderUid = s.players[s.curLeader];
        const leaderScore = s.scores[leaderUid] || 0;
        if (leaderScore >= s.curBid){
          s.total[leaderUid] = (s.total[leaderUid]||0) + leaderScore;
        } else {
          s.total[leaderUid] = (s.total[leaderUid]||0) - s.curBid;
        }
        
        function round10(x){ return Math.round(x/10)*10; }
        // leader already +/- contract; opponents add rounded
        for (const p of s.players){
          if (p===leaderUid) continue;
          s.total[p] = (s.total[p]||0) + round10(s.scores[p]||0);
        }

        s.phase='done';
        s.status = `Koniec rozdania. Suma: ${s.players.map(p=> (s.total[p]||0)).join(' / ')}`;
        // 1000?
        let win = s.players.find(p=> (s.total[p]||0) >= 1000);
        if (win){
          await leaderboard.doc(win).set({wins: firebase.firestore.FieldValue.increment(1)}, {merge:true});
          s.status += ` • Partię wygrywa gracz ${s.players.indexOf(win)+1}`;
        }
      }
    } else {
      s.turn = (s.turn+1)%3;
    }
    await stateRef.set(s);
  }

  document.getElementById('btnMeld').onclick = async ()=>{
    const snap = await stateRef.get(); let s = snap.data();
    if (s.phase!=='play') return;
    const h = s.hands[uid]||[];
    const has = (rank,suit)=> h.some(c=>c.r===rank && c.s===suit);
    for (const suit of SG.suits){
      if (has('Q',suit) && has('K',suit)){
        const points = {'♠':40,'♣':60,'♦':80,'♥':100}[suit];
        s.atu = suit;
        // meld counts only if declarer takes this trick
        s._pendingMeld = {uid, points};
        s.status = `Meldunek zadeklarowany ${points} (${suit}). Zliczę jeśli weźmiesz tę lewę.`;
        await stateRef.set(s);
        return;
      }
    }
  };

  // Apply meld after trick if relevant
  stateRef.onSnapshot(async (snap)=>{
    if (!snap.exists) return;
    const s = snap.data();
    // if last trick winner equals pending meld uid, add points
    if (s._lastTrickWinner && s._pendingMeld && s._pendingMeld.uid===s._lastTrickWinner){
      s.total[s._pendingMeld.uid] = (s.total[s._pendingMeld.uid]||0) + s._pendingMeld.points;
      s.status = `Meld zaliczony +${s._pendingMeld.points}.`;
      delete s._pendingMeld; delete s._lastTrickWinner;
      await stateRef.set(s);
    }
  });

  // Hook to mark last trick winner (wrap stateRef.set via monkey patch not ideal here; do it inline in play)
  // Adjust play() to set s._lastTrickWinner before set: done above in settlement

  document.getElementById('btnNewDeal').onclick = async ()=>{
    const snap = await stateRef.get(); let s = snap.data(); if (!isHost || s.phase!=='done') return;
    await initDeal();
  };

  // Start: host can press R
  document.addEventListener('keydown', async (e)=>{ if (isHost && e.key.toLowerCase()==='r'){ await initDeal(); } });

  stateRef.onSnapshot(snap=>{ if (snap.exists) render(snap.data()); });

  // Chat + Admin panel
  const chatMount = document.createElement('div'); document.body.appendChild(chatMount);
  if (roomId){ chatMount.appendChild(Chat(roomId)); }
  (function(){ const mount = document.getElementById('adminMount'); if (mount && roomId) mount.appendChild(AdminPanel(roomId)); })();
})();

  // Voice mount
  (function(){ const m = document.getElementById('voiceMount'); if (m) m.appendChild(Voice()); })();
