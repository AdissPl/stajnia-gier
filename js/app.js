
window.SG = window.SG || {};
(function(){
  SG.fb.init();

  const userLabel = document.getElementById('userLabel');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');

  const updateHeader = async (user)=>{
    if (user){
      SG.currentUser = user;
      const name = (await SG.fb.db.collection('profiles').doc(user.uid).get()).data()?.displayName || user.email || 'Gracz';
      userLabel && (userLabel.textContent = `${name} (${user.uid.slice(0,6)})`);
      btnLogin && btnLogin.classList.add('hidden');
      btnLogout && btnLogout.classList.remove('hidden');
      // owner highlight
      if (window.FB_CONF.OWNER_UID && user.uid === window.FB_CONF.OWNER_UID){
        userLabel && (userLabel.innerHTML += ' • <span class="role owner">Owner</span>');
      }
    } else {
      SG.currentUser = null;
      userLabel && (userLabel.textContent = 'Niezalogowany');
      btnLogin && btnLogin.classList.remove('hidden');
      btnLogout && btnLogout.classList.add('hidden');
    }
  };

  SG.fb.auth.onAuthStateChanged(async (u)=>{
    await updateHeader(u);
  });

  btnLogin && (btnLogin.onclick = async ()=>{
    // proste anonimowe logowanie lub prompt e-mail
    try{
      const res = await SG.fb.auth.signInAnonymously();
      await SG.ensureProfile(res.user.uid, 'Gracz');
    }catch(e){
      alert('Logowanie nie powiodło się: '+e.message);
    }
  });

  btnLogout && (btnLogout.onclick = ()=> SG.fb.auth.signOut());

  // index: set game badges etc.
  const gameName = document.getElementById('gameName');
  if (gameName){
    const g = (new URLSearchParams(location.search)).get('game') || '';
    const map = {wojna:'Wojna', makao:'Makao', pan:'Pan', tysiak:'Tysiąc', tysiac:'Tysiąc'};
    gameName.textContent = map[g] || g;
  }
})();
