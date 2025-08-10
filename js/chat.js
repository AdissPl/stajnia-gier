
window.Chat = (roomId)=>{
  const db = SG.fb.db;
  const box = document.createElement('div');
  box.className='panel';
  box.innerHTML = `
    <div class="big">Czat</div>
    <div id="chatList" class="list" style="max-height:240px;overflow:auto;margin-top:8px"></div>
    <div class="row" style="margin-top:8px">
      <input id="chatMsg" placeholder="Napisz wiadomość..." style="flex:1"/>
      <button id="chatSend" class="btn">Wyślij</button>
    </div>
  `;
  const list = box.querySelector('#chatList');
  const input = box.querySelector('#chatMsg');
  const btn = box.querySelector('#chatSend');

  btn.onclick = async ()=>{
    if (!SG.currentUser) return;
    const text = input.value.trim(); if (!text) return;
    const name = (await SG.fb.db.collection('profiles').doc(SG.currentUser.uid).get()).data()?.displayName || 'Gracz';
    await db.collection('rooms').doc(roomId).collection('messages').add({
      uid: SG.currentUser.uid, name, text, ts: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value='';
  };

  db.collection('rooms').doc(roomId).collection('messages').orderBy('ts','desc').limit(50).onSnapshot(snap=>{
    list.innerHTML='';
    snap.forEach(d=>{
      const m = d.data();
      const div = document.createElement('div');
      div.className='item';
      div.innerHTML = `<div class="small"><strong>${m.name||'?'}</strong>: ${m.text||''}</div>`;
      list.appendChild(div);
    });
  });

  return box;
};
