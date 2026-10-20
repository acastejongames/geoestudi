/* Salas P2P amb PeerJS: el creador de la sala coordina les rondes. */
(() => {
  const modeGrid = document.querySelector('#modes');
  const modeCard = document.createElement('article');
  modeCard.className = 'card mode room-card';
  modeCard.dataset.mode = 'multiplayer';
  modeCard.style.setProperty('--accent', '#8dca91');
  modeCard.innerHTML = '<div class="mode-icon">♟</div><h3>Sales multijugador</h3><p>Crea una sala amb codi. Omple buits, test, cert o fals i paraules llampec.</p>';
  modeGrid.append(modeCard);
  modeGrid.addEventListener('click', event => {
    const card = event.target.closest('[data-mode="multiplayer"]');
    if (!card) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showEntry();
  }, true);

  let peer = null, host = false, myId = '', myName = '', code = '';
  let connections = new Map(), room = null, roundTimer = null, ticking = null;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const shuffle = xs => [...xs].sort(() => Math.random() - .5);
  function panel(title, subtitle, body) {
    open(title, subtitle, `<div class="room-panel">${body}</div>`);
  }
  function showEntry() {
    if (!window.Peer) { panel('Sales multijugador','No s’ha pogut carregar la connexió de les sales.', '<p class="room-feed">Comprova la connexió a internet i torna-ho a provar.</p>'); return; }
    panel('Sales multijugador','Juga amb companys des dels seus dispositius. El creador comparteix el codi de la sala.',
      '<label>El teu nom<input id="room-name" maxlength="18" autocomplete="nickname" placeholder="Ex.: Laia"></label>'+
      '<button class="primary" id="create-room">＋ Crea una sala</button>'+
      '<label>O introdueix el codi de la sala<input id="join-code" maxlength="6" autocomplete="off" placeholder="ABC123" style="text-transform:uppercase"></label>'+
      '<button class="secondary" id="join-room">Entra a una sala →</button><div class="room-feed" id="room-error" aria-live="polite"></div>'+
      '<p class="tiny">Necessiteu internet. Les respostes i les puntuacions es comparteixen durant la partida.</p>');
    document.querySelector('#create-room').onclick = createRoom;
    document.querySelector('#join-room').onclick = joinRoom;
  }
  function setError(message) { const el = document.querySelector('#room-error'); if (el) el.textContent = message; }
  function makePeer(id) {
    return new Promise((resolve, reject) => {
      peer = id ? new Peer(id) : new Peer();
      peer.on('open', resolve);
      peer.on('error', err => {
        const messages = {'unavailable-id':'Aquest codi ja està en ús. Torna a crear la sala.','peer-unavailable':'No trobem aquesta sala. Revisa el codi i prova-ho de nou.','network':'S’ha perdut la connexió de xarxa.','server-error':'El servei de sales no respon ara mateix.'};
        const msg = messages[err.type] || 'No s’ha pogut connectar a la sala.';
        setError(msg);
        if (!myId) { peer?.destroy(); peer = null; reject(err); }
      });
      peer.on('disconnected', () => setError('Connexió interrompuda. Torna a provar d’entrar.'));
    });
  }
  async function createRoom() {
    myName = document.querySelector('#room-name').value.trim();
    if (!myName) { setError('Escriu el teu nom abans de crear la sala.'); return; }
    if (!window.Peer) return setError('El servei de sales no s’ha carregat.');
    const btn = document.querySelector('#create-room'); btn.disabled = true; setError('Creant la sala…');
    host = true;
    for (let attempt=0; attempt<4; attempt++) {
      code = Math.random().toString(36).slice(2,8).toUpperCase();
      try { await makePeer('geo-' + code); break; }
      catch { if (attempt===3) { host=false; return; } }
    }
    myId = peer.id;
    room = {phase:'lobby',players:{[myId]:{id:myId,name:myName,score:0,answered:false,host:true}},round:0,rounds:[]};
    peer.on('connection', conn => {
      connections.set(conn.peer, conn);
      conn.on('data', msg => onHostMessage(conn, msg));
      conn.on('close', () => { delete room.players[conn.peer]; connections.delete(conn.peer); broadcast(); renderRoom(); });
    });
    renderRoom();
  }
  async function joinRoom() {
    myName = document.querySelector('#room-name').value.trim();
    code = document.querySelector('#join-code').value.trim().toUpperCase();
    if (!myName) return setError('Escriu el teu nom abans d’entrar.');
    if (!/^[A-Z0-9]{6}$/.test(code)) return setError('El codi ha de tenir sis lletres o números.');
    if (!window.Peer) return setError('El servei de sales no s’ha carregat.');
    document.querySelector('#join-room').disabled = true; setError('Connectant amb la sala…');
    host = false;
    try {
      await makePeer(); myId = peer.id;
      const conn = peer.connect('geo-' + code, {reliable:true});
      connections.set('host', conn);
      conn.on('open', () => conn.send({type:'hello',name:myName}));
      conn.on('data', msg => onGuestMessage(msg));
      conn.on('close', () => { if (room) { room.phase='closed'; renderRoom(); } });
      setTimeout(() => { if (!room) { setError('No hem pogut trobar la sala. Confirma el codi i que continuï oberta.'); document.querySelector('#join-room')?.removeAttribute('disabled'); } }, 9000);
    } catch { document.querySelector('#join-room')?.removeAttribute('disabled'); }
  }
  function roundsDeck() {
    const cards = shuffle(allCards());
    const qs = shuffle(topics.flatMap(t => t.quiz));
    const deck = [];
    for (let i=0; i<8; i++) {
      const kind = ['blank','choice','truth','lightning'][i%4];
      if (kind==='blank' || kind==='lightning') {
        const c=cards[i%cards.length];
        deck.push({kind,prompt:c.definition,answer:c.term,seconds:kind==='blank'?25:12});
      } else if(kind==='choice') {
        const [prompt,options,answer]=qs[i%qs.length];
        deck.push({kind,prompt,options:shuffle(options),answer,seconds:18});
      } else {
        const [prompt,options,answer]=qs[i%qs.length];
        const isTrue=Math.random()>.35;
        const statement=isTrue?answer:options.find(x=>x!==answer);
        deck.push({kind,prompt:`${prompt} → ${statement}`,answer:isTrue?'cert':'fals',seconds:15});
      }
    }
    return deck;
  }
  function publicRoom() {
    if (!room) return null;
    return {phase:room.phase,players:Object.values(room.players).map(p=>({id:p.id,name:p.name,score:p.score,answered:p.answered,host:p.host})),round:room.round,rounds:room.rounds.length,current:room.rounds[room.round]||null,endsAt:room.endsAt||null,submitted:Object.values(room.players).filter(p=>p.answered).length};
  }
  function broadcast() { const data={type:'state',room:publicRoom()}; for(const c of connections.values()) if(c.open)c.send(data); }
  function onHostMessage(conn,msg) {
    if(msg?.type==='hello') {
      if(Object.keys(room.players).length>=12){conn.send({type:'error',message:'La sala és plena (màxim 12 jugadors).'});conn.close();return;}
      room.players[conn.peer]={id:conn.peer,name:String(msg.name||'Jugador').slice(0,18),score:0,answered:false,host:false};
      broadcast(); renderRoom();
    } else if(msg?.type==='answer') acceptAnswer(conn.peer,msg.answer);
    else if(msg?.type==='leave') { delete room.players[conn.peer];connections.delete(conn.peer);broadcast();renderRoom(); }
  }
  function onGuestMessage(msg) {
    if(msg?.type==='error'){setError(msg.message);return;}
    if(msg?.type==='state'){room=msg.room;renderRoom();}
  }
  function startGame() {
    room.rounds=roundsDeck();room.round=0;room.phase='playing';
    for(const p of Object.values(room.players)){p.score=0;p.answered=false;}
    beginRound();
  }
  function beginRound() {
    if(room.round>=room.rounds.length){room.phase='finished';room.endsAt=null;clearTimeout(roundTimer);broadcast();renderRoom();return;}
    room.phase='playing';room.endsAt=Date.now()+room.rounds[room.round].seconds*1000;
    for(const p of Object.values(room.players))p.answered=false;
    clearTimeout(roundTimer);roundTimer=setTimeout(endRound,room.rounds[room.round].seconds*1000);
    broadcast();renderRoom();
  }
  function acceptAnswer(playerId,answer) {
    if(!host||room.phase!=='playing')return;
    const player=room.players[playerId];if(!player||player.answered)return;
    player.answered=true;player.answer=String(answer).slice(0,100);
    const question=room.rounds[room.round];
    const correct=clean(player.answer)===clean(question.answer);
    player.correct=correct;
    if(correct){const timeLeft=Math.max(0,room.endsAt-Date.now());player.score+=10+Math.ceil(timeLeft/1000);}
    broadcast();renderRoom();
    if(Object.values(room.players).every(p=>p.answered))endRound();
  }
  function endRound() {
    if(!host||room.phase!=='playing')return;
    clearTimeout(roundTimer);room.phase='reveal';room.endsAt=null;broadcast();renderRoom();
  }
  function submit(answer) {
    if(!room||room.phase!=='playing')return;
    if(host)acceptAnswer(myId,answer);
    else {const c=connections.get('host');if(c?.open)c.send({type:'answer',answer});}
    document.querySelectorAll('.room-input,.room-answer,.room-submit').forEach(el=>el.disabled=true);
  }
  function renderRoom() {
    if(!room)return;
    if(room.phase==='closed'){panel('Sala tancada','La connexió amb la persona que ha creat la sala s’ha acabat.','<button class="primary" id="room-exit">Torna a les sales</button>');document.querySelector('#room-exit').onclick=cleanup;return;}
    const codeLabel=code?`<div class="room-code">${esc(code)}</div>`:'';
    const players=room.players||{};
    const list=Object.values(players).sort((a,b)=>b.score-a.score).map(p=>`<div class="room-player"><span>${p.host?'♛ ':''}${esc(p.name)}${p.id===myId?' (tu)':''}</span><strong>${p.score} pts</strong></div>`).join('');
    if(room.phase==='lobby') {
      panel('Sala d’espera',host?'Comparteix el codi amb els teus companys.':'T’has unit a la sala.',`${codeLabel}<div class="room-actions">${host?'<button class="secondary" id="copy-code">Copia el codi</button>':''}</div><span class="room-tag">${Object.keys(players).length}/12 jugadors</span><div class="room-players">${list}</div>${host?'<button class="primary" id="start-game" '+(Object.keys(players).length<2?'disabled':'')+'>Comença la partida →</button>':'<div class="room-feed">Espera que qui ha creat la sala comenci la partida…</div>'}<button class="quiet" id="leave-room">Surt de la sala</button>`);
      document.querySelector('#copy-code')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(code);toast('Codi copiat')}catch{toast('Comparteix el codi '+code)}});
      document.querySelector('#start-game')?.addEventListener('click',startGame);
      document.querySelector('#leave-room').onclick=cleanup;return;
    }
    const current=room.current; const reveal=room.phase==='reveal'||room.phase==='finished';
    const localPlayer=Object.values(players).find(p=>p.id===myId);
    const alreadyAnswered=!!localPlayer?.answered;
    if(room.phase==='finished') {
      const winners=Object.values(players).sort((a,b)=>b.score-a.score);
      panel('Partida acabada','Classificació final',`<div class="room-players">${winners.map((p,i)=>`<div class="room-player"><span>${['🥇','🥈','🥉'][i]||'·'} ${esc(p.name)}</span><strong>${p.score} pts</strong></div>`).join('')}</div>${host?'<button class="primary" id="again-game">Juga una altra partida</button>':''}<button class="quiet" id="leave-room">Surt de la sala</button>`);
      document.querySelector('#again-game')?.addEventListener('click',startGame);document.querySelector('#leave-room').onclick=cleanup;return;
    }
    const labels={blank:'OMPLE ELS BUITS',choice:'TRIA LA RESPOSTA',truth:'CERT O FALS',lightning:'PARAULA LLAMPEC'};
    const answerArea=reveal?`<div class="room-tag">Resposta: ${esc(current.answer)}</div>`:alreadyAnswered?'<div class="room-tag">Resposta enviada ✓</div>':answerMarkup(current);
    const timer=reveal?'Ronda completada':`<span class="room-timer" id="room-timer">…</span>`;
    panel(`Ronda ${room.round+1} de ${room.rounds}`,`${labels[current.kind]} · ${timer}`,`<div class="room-question">${esc(current.prompt)}${current.kind==='blank'?'<br><strong style="color:var(--green)">→ ____________________</strong>':''}</div>${answerArea}<div class="room-feed" id="room-feed">${reveal?'':`${room.submitted||0}/${Object.keys(players).length} respostes rebudes`}</div><div class="room-players">${list}</div>${reveal&&host?'<button class="primary" id="next-round">Següent ronda →</button>':''}${!reveal?'<button class="quiet" id="leave-room">Surt de la partida</button>':''}`);
    if(!reveal){wireAnswers(current);if(ticking)clearInterval(ticking);ticking=setInterval(()=>{const el=document.querySelector('#room-timer');if(!el){clearInterval(ticking);return;}const sec=Math.max(0,Math.ceil((room.endsAt-Date.now())/1000));el.textContent=`${sec}s`;if(host){const feed=document.querySelector('#room-feed');if(feed)feed.textContent=`${Object.values(room.players).filter(p=>p.answered).length}/${Object.keys(room.players).length} respostes rebudes`; }},250);document.querySelector('#leave-room').onclick=cleanup;}
    document.querySelector('#next-round')?.addEventListener('click',()=>{room.round++;beginRound();});
  }
  function answerMarkup(q) {
    if(q.kind==='choice')return `<div>${q.options.map(o=>`<button class="room-answer" data-answer="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
    if(q.kind==='truth')return '<div class="room-actions"><button class="room-answer" data-answer="cert">És cert</button><button class="room-answer" data-answer="fals">És fals</button></div>';
    return '<div class="room-actions"><input class="room-input" id="typed-answer" maxlength="50" placeholder="Escriu el concepte…"><button class="primary room-submit" id="send-answer">Envia</button></div>';
  }
  function wireAnswers(q) {
    document.querySelectorAll('[data-answer]').forEach(b=>b.addEventListener('click',()=>submit(b.dataset.answer)));
    document.querySelector('#send-answer')?.addEventListener('click',()=>{const value=document.querySelector('#typed-answer').value.trim();if(value)submit(value);});
    document.querySelector('#typed-answer')?.addEventListener('keydown',e=>{if(e.key==='Enter')document.querySelector('#send-answer').click()});
  }
  function cleanup() {
    clearTimeout(roundTimer);clearInterval(ticking);
    if(!host){const c=connections.get('host');if(c?.open)c.send({type:'leave'});}
    peer?.destroy();peer=null;host=false;myId='';room=null;connections.clear();render();showEntry();
  }
})();

