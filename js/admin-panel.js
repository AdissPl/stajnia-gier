
window.AdminPanel = (roomId)=>{
  const db = SG.fb.db;
  const box = document.createElement('div');
  box.className='panel';
  box.innerHTML = `
    <div class="big">Panel admina (pokój)</div>
    <div id="players" class="list" style="margin-top:8px"></div>
    <div class="row" style="margin-top:8px">
      <button id="togglePub" class="btn ghost">Publiczny/Prywatny</button>
    </div>
  `;
  const playersList = box.querySelector('#players');
  async function render(){
    const snap = await db.collection('rooms').doc(roomId).get();
    const r = snap.data()||{};
    const seats = r.seats||{};
    playersList.innerHTML='';
    for (const [u,val] of Object.entries(seats)){
      const name = (await db.collection('profiles').doc(u).get()).data()?.displayName || u.slice(0,6);
      const item = document.createElement('div'); item.className='item';
      item.innerHTML = `<div>${name} <span class="small">(${u.slice(0,6)})</span></div>
        <div class="row">
          <button class="btn ghost" data-uid="${u}" data-act="transfer">Host</button>
          <button class="btn danger" data-uid="${u}" data-act="kick">Wyrzuć</button>
        </div>`;
      playersList.appendChild(item);
    }
  }
  playersList.onclick = async (e)=>{
    const b = e.target.closest('button'); if (!b) return;
    const uid = b.getAttribute('data-uid'); const act = b.getAttribute('data-act');
    const ref = db.collection('rooms').doc(roomId);
    const snap = await ref.get(); const r = snap.data();
    if (r.host !== SG.currentUser?.uid){ alert('Tylko host.'); return; }
    if (act==='transfer'){ await ref.update({host: uid}); }
    if (act==='kick'){ const seats=r.seats||{}; delete seats[uid]; await ref.update({seats}); }
    await db.collection('audit').add({ts: firebase.firestore.FieldValue.serverTimestamp(), type:'admin:'+act, room:roomId, user: SG.currentUser.uid, target: uid});
    render();
  };
  box.querySelector('#togglePub').onclick = async ()=>{
    const ref = db.collection('rooms').doc(roomId); const r=(await ref.get()).data();
    if (r.host !== SG.currentUser?.uid){ alert('Tylko host.'); return; }
    await ref.update({public: !r.public});
    await db.collection('audit').add({ts: firebase.firestore.FieldValue.serverTimestamp(), type:'admin:togglePublic', room:roomId, user: SG.currentUser.uid});
    render();
  };
  render();
  return box;
};
