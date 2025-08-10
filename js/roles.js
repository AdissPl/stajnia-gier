
window.RoleAdmin = ()=>{
  const box = document.createElement('div');
  box.className='panel';
  box.innerHTML = `
    <div class="big">Role (owner)</div>
    <div class="row">
      <input id="uid" placeholder="UID użytkownika" style="flex:1"/>
      <select id="role">
        <option>player</option><option>mod</option><option>admin</option><option>owner</option>
      </select>
      <button id="set" class="btn">Ustaw</button>
    </div>
    <div class="small">Wymaga wdrożonych Functions (callable: setRole).</div>
  `;
  box.querySelector('#set').onclick = async ()=>{
    const uid = box.querySelector('#uid').value.trim();
    const role = box.querySelector('#role').value;
    try{
      const res = await firebase.functions().httpsCallable('setRole')({uid, role});
      alert('OK');
    }catch(e){ alert('Błąd: '+e.message); }
  };
  return box;
};
