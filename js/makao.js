
(function(){
  const db = SG.fb.db;
  const roomId = SG.roomIdFromUrl();
  const roomRef = db.collection('rooms').doc(roomId);
  const stateRef = roomRef.collection('state').doc('makao');
  const leaderboard = db.collection('leaderboard_makao');

  // UI
  const root = document.querySelector('main') || document.body;
  const table = document.createElement('div');
  table.className='table';
  table.innerHTML = `
    <div class="center"><div class="big">Makao</div></div>
    <div class="center small">Pokój: <span id="rid"></span> • Tura: <span id="turn"></span> • Kierunek: <span id="dir"></span></div>
    <div class="center"><div class="pile" id="discard"></div></div>
    <div class="center small" id="status"></div>
    <div class="panel">
      <div class="row wrap">
        <button class="btn" id="btnDraw">Dobierz</button>
        <button class="btn ghost" id="btnMakao">Makao!</button>
        <label>Żądaj wartości (Walet):</label>
        <select id="askValue">
          <option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option>
        </select>
        <label>Żądaj koloru (As):</label>
        <select id="askColor"><option>♣</option><option>♦</option><option>♥</option><option>♠</option></select>
      </div>
    </div>
    <div class="panel" id="handPanel"><div class="big">Twoja ręka</div><div id="hand" class="stack"></div></div>
  `;
  root.appendChild(table);
  const rid = document.getElementById('rid');
  const turnEl = document.getElementById('turn');
  const dirEl = document.getElementById('dir');
  const discard = document.getElementById('discard');
  const hand = document.getElementById('hand');
  const statusEl = document.getElementById('status');
  const btnDraw = document.getElementById('btnDraw');
  const btnMakao = document.getElementById('btnMakao');
  const askValue = document.getElementById('askValue');
  const askColor = document.getElementById('askColor');

  rid.textContent = roomId?.slice(0,6) || '—';

  let isHost=false, uid=null, players=[], idx=0, options={makaoPenalty:5, makaoJoker:false};

  roomRef.onSnapshot(async (doc)=>{
    const r = doc.data()||{};
    uid = SG.currentUser?.uid || null;
    isHost = r.host===uid;
    options = Object.assign({makaoPenalty:5, makaoJoker:false}, r.options||{});
    players = Object.keys(r.seats||{});
    idx = players.indexOf(uid);
  });

  function isRed(s){return s==='♦'||s==='♥';}
  function canPlay(card, s){
    const isJoker = options.makaoJoker && card.r==='JOKER';
    const top = s.discard[s.discard.length-1];
    if (isJoker) return true;
    // queen universal
    if (card.r==='Q') return true;
    // request by Jack (value)
    if (s.request?.type==='value'){
      return card.r===s.request.value || card.r==='J';
    }
    // color request by Ace
    if (s.request?.type==='color'){
      return card.s===s.request.color || card.r==='A';
    }
    // regular match by suit or rank
    if (!top) return true;
    if (card.r===top.r || card.s===top.s) return true;
    // functional kings can be played on same suit request
    return false;
  }

  function nextIndex(s, from){
    const dir = s.dir===1?1:-1;
    let i = (from + dir + s.players.length) % s.players.length;
    return i;
  }

  async function initGame(){
    let all = SG.shuffle(SG.buildDeck52());
    if (options.makaoJoker){ all.push({r:'JOKER',s:'*'}); all.push({r:'JOKER',s:'*'}); SG.shuffle(all);}
    const playersLocal = players.slice(0, Math.max(3, Math.min(6, players.length||3)));
    const hands = {};
    for (const p of playersLocal) hands[p]=[];
    // deal 5 each
    for (let k=0; k<5; k++){
      for (const p of playersLocal) hands[p].push(all.shift());
    }
    // initial non-functional top
    let first = all.shift();
    const func = (c)=> ['2','3','4','J','Q','K','A'].includes(c.r) && !(c.r==='K' && (c.s==='♣' || c.s==='♦'));
    while (func(first)) { all.push(first); SG.shuffle(all); first = all.shift(); }
    const s = {
      players: playersLocal,
      turn: 0,
      dir: 1, // 1=clockwise, -1=counter
      stock: all,
      discard: [first],
      hands,
      pending: 0,
      request: null, // {type:'value', value:'5'} or {type:'color', color:'♥'}
      makao: {}, // uid->bool (declared)
      status: 'Start'
    };
    await stateRef.set(s);
    await roomRef.update({status:'ongoing'});
  }

  function render(s){
    dirEl.textContent = s.dir===1?'→':'←';
    turnEl.textContent = `${s.turn+1}/${s.players.length}`;
    discard.innerHTML='';
    const top3 = s.discard.slice(-3);
    for (const c of top3) discard.appendChild(SG.cardEl(c));
    statusEl.textContent = s.status || '';
    // hand
    const cards = s.hands[uid]||[];
    hand.innerHTML='';
    cards.forEach((c,i)=>{
      const el = SG.cardEl(c);
      el.style.cursor='pointer';
      if (!canPlay(c,s)) el.style.opacity = .45;
      el.onclick = async ()=>{
        if (s.players[s.turn]!==uid) return;
        if (!canPlay(c,s)) return;
        await playCard(i, c, s);
      };
      hand.appendChild(el);
    });
    btnDraw.disabled = s.players[s.turn]!==uid;
    btnMakao.disabled = !(s.hands[uid] && s.hands[uid].length===1);
  }

  async function drawCard(){
    const snap = await stateRef.get(); let s = snap.data();
    if (s.players[s.turn]!==uid) return;
    // apply pending penalty if exists
    const drawN = Math.max(1, s.pending||0);
    for (let i=0;i<drawN;i++){
      if (s.stock.length===0){
        // reshuffle from discard except top
        const keep = s.discard.pop();
        s.stock = SG.shuffle(s.discard);
        s.discard = [keep];
      }
      s.hands[uid].push(s.stock.shift());
    }
    s.pending = 0;
    s.request = null;
    s.status = `Gracz ${s.turn+1} dobiera ${drawN}`;
    s.turn = nextIndex(s, s.turn);
    await stateRef.set(s);
  }

  function applyFunctionalEffects(card, s){
    const extraKings = options.makaoExtraKings;
    // functional effects stack
    if (card.r==='2') s.pending += 2;
    if (card.r==='3') s.pending += 3;
    if (card.r==='4') { s.turn = nextIndex(s, s.turn); s.status='Pauza -> następny pominięty'; }
    if (card.r==='J') { s.request = {type:'value', value: askValue.value}; s.status=`Walet: żądanie ${s.request.value}`; }
    if (card.r==='A') { s.request = {type:'color', color: askColor.value}; s.status=`As: zmiana koloru na ${s.request.color}`; }
    if (card.r==='K' && card.s==='♥') s.pending += 5; // next player
    if (extraKings && card.r==='K' && (card.s==='♦' || card.s==='♣')) s.pending += 5;
    if (card.r==='K' && card.s==='♠') {
      // penalty to previous player; give previous player +5 now by moving turn back and apply
      const prev = (s.turn - s.dir + s.players.length) % s.players.length;
      s.status = 'Król ♠: kara 5 dla poprzednika';
      // store in s._retro? Simpler: apply as generic pending but immediately push to previous by adding temp flag
      s._retro = {index:prev, amount:5};
    }
  }

  async function playCard(cardIndex, card, s){
    // must satisfy rules: match suit/rank or Q, or fulfill request; defense against penalty: allow 2/3 or same-color bitny king
    const me = uid;
    // remove from hand
    s.hands[me].splice(cardIndex,1);
    s.discard.push(card);

    // verify makao: if player had 2 cards and did not press Makao, give penalty now
    if ((s.hands[me].length===1) && !s.makao[me]){
      // ok, allowed; but if finishes turn to 0 cards without makao -> penalty 5
    }
    if (s.hands[me].length===0){
      if (!s.makao[me]){
        // penalty (configurable), cancel winning
        s.status='Zapomniałeś powiedzieć Makao! +5 karnych';
        for (let i=0;i< (options.makaoPenalty||5); i++){
          if (s.stock.length===0){
            const keep = s.discard.pop();
            s.stock = SG.shuffle(s.discard);
            s.discard=[keep];
          }
          s.hands[me].push(s.stock.shift());
        }
      } else {
        // win
        await leaderboard.doc(me).set({wins: firebase.firestore.FieldValue.increment(1)}, {merge:true});
        s.status='Wygrana!';
        await stateRef.set(s);
        await roomRef.update({status:'waiting'});
        return;
      }
    }

    // reset makao flag if more than 1
    if (s.hands[me].length!==1) s.makao[me]=false;

    applyFunctionalEffects(card, s);

    // retro penalty for K♠
    if (s._retro){
      const p = s._retro.index;
      for (let i=0;i<s._retro.amount;i++){
        if (s.stock.length===0){
          const keep = s.discard.pop();
          s.stock = SG.shuffle(s.discard);
          s.discard=[keep];
        }
        const pid = s.players[p];
        s.hands[pid].push(s.stock.shift());
      }
      delete s._retro;
    }

    // advance turn (unless 4 already advanced one)
    s.turn = nextIndex(s, s.turn);
    await stateRef.set(s);
  }

  btnDraw.onclick = drawCard;
  btnMakao.onclick = async ()=>{
    const snap = await stateRef.get(); let s = snap.data();
    s.makao[uid]=true;
    s.status='Makao!';
    await stateRef.set(s);
  };

  // Host controls: init when host presses R
  document.addEventListener('keydown', async (e)=>{
    if (!isHost) return;
    if (e.key.toLowerCase()==='r'){
      await initGame();
    }
  });

  // Render on state
  stateRef.onSnapshot(snap=>{
    if (!snap.exists) return;
    render(snap.data());
  });

  // Mount chat
  const chatMount = document.createElement('div'); chatMount.id='chatMount'; document.body.appendChild(chatMount);
  if (roomId){ chatMount.appendChild(Chat(roomId)); }
})();

  // Mount admin panel
  (function(){ const mount = document.getElementById('adminMount'); const rid = SG.roomIdFromUrl(); if (mount && rid) mount.appendChild(AdminPanel(rid)); })();

  // Voice mount
  (function(){ const m = document.getElementById('voiceMount'); if (m) m.appendChild(Voice()); })();
