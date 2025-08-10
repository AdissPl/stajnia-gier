
window.SG = window.SG || {};
(function(){
  const ICE = [{urls:'stun:stun.l.google.com:19302'}];

  
  let localStream=null;
  async function ensureMic(){
    if (!localStream){
      try{ localStream = await navigator.mediaDevices.getUserMedia({audio:true}); }
      catch(e){ console.warn('Mic denied', e); }
    }
    return localStream;
  }

  function roomRTCRef(roomId){

    return SG.fb.db.collection('rooms').doc(roomId).collection('rtc');
  }

  async function createHostHub(roomId){
    const db = SG.fb.db;
    const rtcCol = roomRTCRef(roomId);
    // Clean old offers/answers
    // Host creates a listener for "peers" subcollection requests
    const peersRef = rtcCol.doc('host').collection('peers');
    // on new peer doc with type:'offer', create answer
    peersRef.onSnapshot(async (snap)=>{
      for (const doc of snap.docs){
        const d = doc.data(); if (d._completed) continue;
        if (d.type==='offer' && d.sdp){
          const pc = new RTCPeerConnection({iceServers: ICE});
    // Peer will send mic to host as well
    const ls = await ensureMic();
    if (ls){ ls.getAudioTracks().forEach(t=> pc.addTrack(t, ls)); }
    pc.ontrack = (ev)=>{ SG.RTC._onAudio && SG.RTC._onAudio(ev.streams[0], 'host'); };

          const dc = pc.createDataChannel('state');
          // add audio track from host (if any)
          const ls = await ensureMic();
          if (ls){ ls.getAudioTracks().forEach(t=> pc.addTrack(t, ls)); }
          pc.ontrack = (ev)=>{
            SG.RTC._onAudio && SG.RTC._onAudio(ev.streams[0], doc.id);
          };

          dc.onopen = ()=> console.log('DC open (host->peer)', doc.id);
          dc.onmessage = (ev)=> SG.RTC._onMessage && SG.RTC._onMessage(JSON.parse(ev.data), doc.id);
          pc.onicecandidate = async (e)=>{
            if (e.candidate){
              await doc.ref.collection('hostCandidates').add(e.candidate.toJSON());
            }
          };
          await pc.setRemoteDescription(new RTCSessionDescription(d));
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          await doc.ref.update({_completed:true, answer: {type: ans.type, sdp: ans.sdp}});
          // listen for peer candidates
          doc.ref.collection('peerCandidates').onSnapshot(async (cs)=>{
            for (const c of cs.docs){
              try{ await pc.addIceCandidate(new RTCIceCandidate(c.data())); }catch(e){}
            }
          });
          SG.RTC._hostPeers = SG.RTC._hostPeers || {};
          SG.RTC._hostPeers[doc.id] = {pc, dc};
        }
      }
    });
    return {
      sendAll(msg){
        const peers = SG.RTC._hostPeers || {};
        for (const k in peers){
          const ch = peers[k].dc;
          if (ch && ch.readyState==='open'){ ch.send(JSON.stringify(msg)); }
        }
      }
    };
  }

  async function joinAsPeer(roomId){
    const rtcCol = roomRTCRef(roomId);
    const peersRef = rtcCol.doc('host').collection('peers');
    const peerDoc = await peersRef.add({ts: firebase.firestore.FieldValue.serverTimestamp()});
    const pc = new RTCPeerConnection({iceServers: ICE});
    // Peer will send mic to host as well
    const ls = await ensureMic();
    if (ls){ ls.getAudioTracks().forEach(t=> pc.addTrack(t, ls)); }
    pc.ontrack = (ev)=>{ SG.RTC._onAudio && SG.RTC._onAudio(ev.streams[0], 'host'); };

    pc.ondatachannel = (e)=>{
      const ch = e.channel;
      ch.onmessage = (ev)=> SG.RTC._onMessage && SG.RTC._onMessage(JSON.parse(ev.data), 'host');
      SG.RTC._dc = ch;
    };
    pc.onicecandidate = async (e)=>{
      if (e.candidate){
        await peerDoc.collection('peerCandidates').add(e.candidate.toJSON());
      }
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await peerDoc.set({type: offer.type, sdp: offer.sdp});
    // wait for answer
    peerDoc.onSnapshot(async (doc)=>{
      const d=doc.data(); if (d && d.answer && !pc.currentRemoteDescription){
        await pc.setRemoteDescription(new RTCSessionDescription(d.answer));
      }
    });
    // host candidates
    peerDoc.collection('hostCandidates').onSnapshot(async (cs)=>{
      for (const c of cs.docs){
        try{ await pc.addIceCandidate(new RTCIceCandidate(c.data())); }catch(e){}
      }
    });

    return {
      send(msg){
        if (SG.RTC._dc && SG.RTC._dc.readyState==='open'){
          SG.RTC._dc.send(JSON.stringify(msg));
        }
      }
    };
  }

  SG.RTC = { _onAudio:null,
    _onMessage: null,
    onMessage(fn){ this._onMessage = fn; },
    createHostHub,
    joinAsPeer
  };
})();
