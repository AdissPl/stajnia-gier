
window.Voice = ()=>{
  const box = document.createElement('div');
  box.className='panel';
  box.innerHTML = `
    <div class="big">Głos</div>
    <div class="row">
      <button id="joinV" class="btn">Dołącz</button>
      <button id="leaveV" class="btn secondary">Wyłącz</button>
    </div>
    <audio id="remote" autoplay controls style="width:100%"></audio>
  `;
  const remote = box.querySelector('#remote');
  SG.RTC.onAudio((stream)=>{ remote.srcObject = stream; });
  box.querySelector('#joinV').onclick = async ()=>{
    try{ await navigator.mediaDevices.getUserMedia({audio:true}); alert('Mikrofon OK'); }catch(e){ alert('Brak dostępu do mikrofonu'); }
  };
  box.querySelector('#leaveV').onclick = ()=>{
    const s = remote.srcObject; if (s){ s.getTracks().forEach(t=>t.stop()); remote.srcObject=null; }
  };
  return box;
};
