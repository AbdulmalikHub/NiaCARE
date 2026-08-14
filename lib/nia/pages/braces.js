// Source section extracted from the original NiaCARE HTML.
/* ============================================================
   PAGE: Braces Tracker
   ============================================================ */
Pages.braces = function(db, user){
  niaRenderShell('braces', user, db);
  niaRenderTopbar('Braces Tracker', `${niaScopedBracesCases(db).filter(c=>c.status==='Active').length} active orthodontic cases.`);

  const today = todayISO();

  function render(){
    const cases = niaScopedBracesCases(db).slice().sort((a,b)=>(a.next_review_date||'').localeCompare(b.next_review_date||''));
    const scopedVisits = niaScopedBracesVisits(db);

    const html = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-label">Active Cases</div><div class="stat-value">${cases.filter(c=>c.status==='Active').length}</div></div>
        <div class="stat-card"><div class="stat-label">Completed Cases</div><div class="stat-value">${cases.filter(c=>c.status==='Completed').length}</div></div>
        <div class="stat-card"><div class="stat-label">Reviews Overdue</div><div class="stat-value">${cases.filter(c=>c.status==='Active' && c.next_review_date < today).length}</div></div>
        <div class="stat-card"><div class="stat-label">Total Visits Logged</div><div class="stat-value">${scopedVisits.length}</div></div>
      </div>

      <div class="section-head mt-24"><div><h2>Orthodontic Cases</h2><p>Treatment stage and monthly review compliance.</p></div></div>

      <div style="display:flex; flex-direction:column; gap:16px;">
        ${cases.map(c => {
          const visits = scopedVisits.filter(v=>v.braces_case_id===c.braces_case_id).sort((a,b)=>a.visit_date.localeCompare(b.visit_date));
          const overdue = c.status === 'Active' && c.next_review_date < today;
          const monthsIn = Math.max(0, Math.round(daysBetween(c.treatment_start_date, today) / 30));
          const pct = Math.min(100, Math.round((monthsIn / c.expected_duration_months) * 100));
          return `
          <div class="card">
            <div class="card-header">
              <div>
                <h3>${niaPatientName(db,c.patient_id)}</h3>
                <div class="hint">${c.current_stage} ${overdue ? '· <span style="color:var(--nia-danger); font-weight:600;">Review overdue</span>' : ''}</div>
              </div>
              <span class="badge ${niaBadgeClass(c.status)}">${c.status}</span>
            </div>
            <div class="card-pad">
              <div class="progress-track"><div class="progress-fill gold" style="width:${pct}%; ${overdue?'background:linear-gradient(90deg, var(--nia-danger), #d65a6c);':''}"></div></div>
              <div class="flex-between mt-8">
                <span class="form-hint">Month ${monthsIn} of ${c.expected_duration_months} · Next review: ${c.next_review_date?fmtDate(c.next_review_date):'—'}</span>
                ${c.status==='Active' ? `<button class="btn btn-gold btn-sm log-visit" data-case="${c.braces_case_id}">${niaIcon('plus')}Log Review Visit</button>` : ''}
              </div>
              ${visits.length ? `
                <div class="table-wrap mt-16">
                  <table class="table">
                    <thead><tr><th>Date</th><th>Provider</th><th>Adjustment Performed</th><th>Next Review</th></tr></thead>
                    <tbody>
                      ${visits.map(v => `<tr><td class="cell-strong">${fmtDate(v.visit_date)}</td><td>${niaUserName(db,v.provider_id)}</td><td>${v.adjustment_performed}</td><td>${v.next_review_date?fmtDate(v.next_review_date):'—'}</td></tr>`).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}
            </div>
          </div>`;
        }).join('') || `<div class="card"><div class="empty-state">${niaIcon('empty')}<h4>No braces cases</h4></div></div>`}
      </div>
    `;
    document.getElementById('content').innerHTML = html;

    document.querySelectorAll('.log-visit').forEach(btn => btn.addEventListener('click', () => openVisitModal(btn.dataset.case)));
  }

  function openVisitModal(caseId){
    const c = db.bracesCases.find(x=>x.braces_case_id===caseId);
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    const dentists = niaScopedUsers(db).filter(u=>u.role==='dentist');
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h3>Log Braces Review Visit</h3><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-field"><label>Provider</label><select id="bv-provider">${dentists.map(d=>`<option value="${d.user_id}">${d.full_name}</option>`).join('')}</select></div>
            <div class="form-field"><label>Visit Date</label><input type="date" id="bv-date" value="${todayISO()}" /></div>
            <div class="form-field full"><label>Adjustment Performed</label><input type="text" id="bv-adj" placeholder="e.g. Archwire tension adjustment" /></div>
            <div class="form-field full"><label>Current Stage</label><input type="text" id="bv-stage" value="${c.current_stage}" /></div>
            <div class="form-field"><label>Next Review Date</label><input type="date" id="bv-next" value="${todayISO(30)}" /></div>
            <div class="form-field"><label>Mark Treatment Completed?</label><select id="bv-complete"><option value="no">No, continue treatment</option><option value="yes">Yes, braces removed</option></select></div>
            <div class="form-field full"><label>Notes</label><textarea id="bv-notes"></textarea></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-primary" id="save-visit">Save Visit</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('save-visit').addEventListener('click', () => {
      const isFinal = document.getElementById('bv-complete').value === 'yes';
      db.bracesVisits.push({
        braces_visit_id: uid('bv'), braces_case_id: caseId, provider_id: document.getElementById('bv-provider').value,
        visit_date: document.getElementById('bv-date').value, adjustment_performed: document.getElementById('bv-adj').value,
        next_review_date: isFinal ? null : document.getElementById('bv-next').value,
        notes: document.getElementById('bv-notes').value, created_at: todayISO(),
      });
      c.current_stage = document.getElementById('bv-stage').value;
      if (isFinal){ c.status = 'Completed'; c.next_review_date = null; }
      else { c.next_review_date = document.getElementById('bv-next').value; }
      niaSaveDB(db);
      modal.remove();
      niaToast(isFinal ? 'Braces case marked completed.' : 'Review visit logged.');
      render();
    });
  }

  render();
};


