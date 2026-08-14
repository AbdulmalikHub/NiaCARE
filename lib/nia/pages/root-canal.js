// Source section extracted from the original NiaCARE HTML.
/* ============================================================
   PAGE: Root Canal Tracker
   ============================================================ */
Pages.rootcanal = function(db, user){
  niaRenderShell('rootcanal', user, db);
  niaRenderTopbar('Root Canal Tracker', `${niaScopedRootCanalCases(db).filter(c=>c.status==='Active').length} active multi-session root canal cases.`);

  const today = todayISO();

  function render(){
    const cases = niaScopedRootCanalCases(db).slice().sort((a,b)=>(a.next_session_date||'').localeCompare(b.next_session_date||''));
    const scopedSessions = niaScopedRootCanalSessions(db);

    const html = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Active Cases</div><div class="stat-value">${cases.filter(c=>c.status==='Active').length}</div></div>
        <div class="stat-card"><div class="stat-label">Completed Cases</div><div class="stat-value">${cases.filter(c=>c.status==='Completed').length}</div></div>
        <div class="stat-card"><div class="stat-label">Sessions Overdue</div><div class="stat-value">${cases.filter(c=>c.status==='Active' && c.next_session_date < today).length}</div></div>
        <div class="stat-card"><div class="stat-label">Total Sessions Logged</div><div class="stat-value">${scopedSessions.length}</div></div>
      </div>

      <div class="section-head mt-24"><div><h2>Root Canal Cases</h2><p>Multi-visit endodontic treatments by tooth and session.</p></div></div>

      <div style="display:flex; flex-direction:column; gap:16px;">
        ${cases.map(c => {
          const sessions = scopedSessions.filter(s=>s.root_canal_case_id===c.root_canal_case_id).sort((a,b)=>a.session_number-b.session_number);
          const overdue = c.status === 'Active' && c.next_session_date < today;
          const pct = Math.round((c.current_session / c.planned_sessions) * 100);
          return `
          <div class="card">
            <div class="card-header">
              <div>
                <h3>${niaPatientName(db,c.patient_id)} — Tooth ${c.tooth_number}</h3>
                <div class="hint">Session ${c.current_session} of ${c.planned_sessions} ${overdue ? '· <span style="color:var(--nia-danger); font-weight:600;">Overdue</span>' : ''}</div>
              </div>
              <span class="badge ${niaBadgeClass(c.status)}">${c.status}</span>
            </div>
            <div class="card-pad">
              <div class="progress-track"><div class="progress-fill ${overdue?'':''}" style="width:${pct}%; ${overdue?'background:linear-gradient(90deg, var(--nia-danger), #d65a6c);':''}"></div></div>
              <div class="flex-between mt-8">
                <span class="form-hint">Next session: ${c.next_session_date?fmtDate(c.next_session_date):'—'}</span>
                ${c.status==='Active' ? `<button class="btn btn-gold btn-sm log-session" data-case="${c.root_canal_case_id}">${niaIcon('plus')}Log Session</button>` : ''}
              </div>
              ${sessions.length ? `
                <div class="table-wrap mt-16">
                  <table class="table">
                    <thead><tr><th>Session</th><th>Date</th><th>Provider</th><th>Procedure Done</th><th>Next Session</th></tr></thead>
                    <tbody>
                      ${sessions.map(s => `<tr><td class="cell-strong">#${s.session_number}</td><td>${fmtDate(s.session_date)}</td><td>${niaUserName(db,s.provider_id)}</td><td>${s.procedure_done}</td><td>${s.next_session_date?fmtDate(s.next_session_date):'—'}</td></tr>`).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
            </div>
          </div>`;
        }).join('') || `<div class="card"><div class="empty-state">${niaIcon('empty')}<h4>No root canal cases</h4></div></div>`}
      </div>
    `;
    document.getElementById('content').innerHTML = html;

    document.querySelectorAll('.log-session').forEach(btn => btn.addEventListener('click', () => openSessionModal(btn.dataset.case)));
  }

  function openSessionModal(caseId){
    const c = db.rootCanalCases.find(x=>x.root_canal_case_id===caseId);
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    const dentists = niaScopedUsers(db).filter(u=>u.role==='dentist');
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h3>Log Root Canal Session</h3><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-field"><label>Provider</label><select id="rc-provider">${dentists.map(d=>`<option value="${d.user_id}">${d.full_name}</option>`).join('')}</select></div>
            <div class="form-field"><label>Session Date</label><input type="date" id="rc-date" value="${todayISO()}" /></div>
            <div class="form-field full"><label>Procedure Done</label><input type="text" id="rc-proc" placeholder="e.g. Canal obturation" /></div>
            <div class="form-field"><label>Next Session Date</label><input type="date" id="rc-next" value="${todayISO(14)}" /></div>
            <div class="form-field"><label>Mark Case Completed?</label><select id="rc-complete"><option value="no">No, more sessions needed</option><option value="yes">Yes, this was the final session</option></select></div>
            <div class="form-field full"><label>Notes</label><textarea id="rc-notes"></textarea></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-primary" id="save-session">Save Session</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('save-session').addEventListener('click', () => {
      const nextSessionNum = c.current_session + 1;
      const isFinal = document.getElementById('rc-complete').value === 'yes';
      db.rootCanalSessions.push({
        root_canal_session_id: uid('rcs'), root_canal_case_id: caseId, provider_id: document.getElementById('rc-provider').value,
        session_number: c.current_session, session_date: document.getElementById('rc-date').value,
        procedure_done: document.getElementById('rc-proc').value, next_session_date: isFinal ? null : document.getElementById('rc-next').value,
        notes: document.getElementById('rc-notes').value, created_at: todayISO(),
      });
      if (isFinal){
        c.status = 'Completed';
        c.next_session_date = null;
      } else {
        c.current_session = nextSessionNum;
        c.next_session_date = document.getElementById('rc-next').value;
      }
      niaSaveDB(db);
      modal.remove();
      niaToast(isFinal ? 'Root canal case marked completed.' : 'Session logged.');
      render();
    });
  }

  render();
};


