// Source section extracted from the original NiaCARE HTML.
/* ============================================================
   PAGE: Treatment Plans
   ============================================================ */
Pages.plans = function(db, user, params){
  niaRenderShell('plans', user, db);
  niaRenderTopbar('Treatment Plans', `${niaScopedPlans(db).length} treatment plans across ${db.facility.facility_name}.`);

  const presetPatient = params.new || null;

  let statusFilter = 'all';
  let search = '';
  const STATUSES = ['Draft','Shared','Accepted','Rejected','In Progress','Completed','Dropped Off'];

  function render(){
    const scopedPlans = niaScopedPlans(db);
    let rows = scopedPlans.filter(p => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const name = niaPatientName(db, p.patient_id).toLowerCase();
      const matchesSearch = !search || name.includes(search.toLowerCase()) || p.plan_number.toLowerCase().includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    }).sort((a,b)=>b.treatment_plan_date.localeCompare(a.treatment_plan_date));

    const html = `
      <div class="section-head">
        <div><h2>All Treatment Plans</h2><p>Master treatment records and their lifecycle status.</p></div>
        <button class="btn btn-primary" id="add-plan-btn">${niaIcon('plus')}New Treatment Plan</button>
      </div>

      <div class="card mt-16">
        <div style="padding:16px 20px; display:flex; gap:12px; flex-wrap:wrap; align-items:center; border-bottom:1px solid var(--nia-line);">
          <div class="topbar-search" style="min-width:260px;">${niaIcon('search')}<input type="text" id="plan-search" placeholder="Search patient or plan number..." value="${search}" /></div>
          <select id="status-filter" style="width:auto; min-width:160px;">
            <option value="all">All Statuses</option>
            ${STATUSES.map(s=>`<option value="${s}" ${statusFilter===s?'selected':''}>${s}</option>`).join('')}
          </select>
          <div style="margin-left:auto; font-size:12.5px; color:var(--nia-ink-soft);">${rows.length} of ${scopedPlans.length} plans</div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Plan</th><th>Patient</th><th>Dentist</th><th>Date</th><th>Value</th><th>Status</th><th>Shared?</th><th></th></tr></thead>
            <tbody>
              ${rows.map(p => `
                <tr>
                  <td><span class="cell-strong">${p.plan_number}</span></td>
                  <td><a href="#" class="link-patient" data-patient="${p.patient_id}" style="color:var(--nia-primary); font-weight:600;">${niaPatientName(db,p.patient_id)}</a></td>
                  <td>${niaUserName(db,p.dentist_id)}</td>
                  <td>${fmtDate(p.treatment_plan_date)}</td>
                  <td class="cell-strong">${fmtKES(p.total_estimated_value)}</td>
                  <td>
                    <select class="status-select" data-plan="${p.treatment_plan_id}" style="font-size:11.5px; padding:4px 8px; width:auto; border-radius:99px; font-weight:700; text-transform:uppercase; letter-spacing:0.03em;">
                      ${STATUSES.map(s=>`<option value="${s}" ${p.status===s?'selected':''}>${s}</option>`).join('')}
                    </select>
                  </td>
                  <td>${p.treatment_plan_shared ? `<span class="form-hint">${p.sharing_method}</span>` : `<span class="form-hint">Not shared</span>`}</td>
                  <td class="text-right"><button class="btn btn-ghost btn-sm open-patient-btn" data-patient="${p.patient_id}">Open</button></td>
                </tr>
              `).join('') || `<tr><td colspan="8"><div class="empty-state">${niaIcon('empty')}<h4>No treatment plans found</h4><p>Try a different filter or search.</p></div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById('content').innerHTML = html;

    document.getElementById('plan-search').addEventListener('input', e => { search = e.target.value; render(); const el=document.getElementById('plan-search'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
    document.getElementById('status-filter').addEventListener('change', e => { statusFilter = e.target.value; render(); });
    document.getElementById('add-plan-btn').addEventListener('click', openAddModal);
    document.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const plan = db.plans.find(p => p.treatment_plan_id === sel.dataset.plan);
        plan.status = sel.value;
        niaSaveDB(db);
        niaToast(`${plan.plan_number} marked as ${sel.value}.`);
        render();
      });
    });
    document.querySelectorAll('.link-patient, .open-patient-btn').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); go('patient-profile', { id: el.dataset.patient }); });
    });
  }

  function openAddModal(){
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    const facilityPatients = niaScopedPatients(db);
    const dentists = niaScopedUsers(db).filter(u=>u.role==='dentist');
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h3>New Treatment Plan</h3><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-field full"><label>Patient <span class="req">*</span></label>
              <select id="tp-patient">
                ${facilityPatients.map(p=>`<option value="${p.patient_id}" ${presetPatient===p.patient_id?'selected':''}>${p.first_name} ${p.last_name} (${p.patient_number})</option>`).join('')}
              </select>
            </div>
            <div class="form-field"><label>Dentist <span class="req">*</span></label>
              <select id="tp-dentist">${dentists.map(d=>`<option value="${d.user_id}">${d.full_name}</option>`).join('')}</select>
            </div>
            <div class="form-field"><label>Plan Date</label><input type="date" id="tp-date" value="${todayISO()}" /></div>
            <div class="form-field"><label>Estimated Value (KES)</label><input type="number" id="tp-value" placeholder="e.g. 45000" /></div>
            <div class="form-field"><label>Payment Mode</label><select id="tp-payment"><option>Cash</option><option>Insurance</option></select></div>
            <div class="form-field full"><label>Procedure Name</label><input type="text" id="tp-proc" placeholder="e.g. Crown Tooth 26" /></div>
            <div class="form-field full"><label>Notes</label><textarea id="tp-notes" placeholder="Clinical notes..."></textarea></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-primary" id="save-plan">Create Plan</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('save-plan').addEventListener('click', () => {
      const patientId = document.getElementById('tp-patient').value;
      const dentistId = document.getElementById('tp-dentist').value;
      const value = Number(document.getElementById('tp-value').value) || 0;
      if (!patientId || !value){ niaToast('Please select a patient and enter an estimated value.'); return; }
      const planId = uid('tp');
      const planNumber = 'NIA-TP-' + new Date().getFullYear() + '-' + Math.floor(100+Math.random()*899);
      db.plans.push({
        treatment_plan_id: planId, facility_id: db.facility.facility_id, patient_id: patientId, dentist_id: dentistId,
        plan_number: planNumber, treatment_plan_date: document.getElementById('tp-date').value || todayISO(),
        total_estimated_value: value, status: 'Draft', treatment_plan_shared: false, sharing_method: null, shared_date: null,
        notes: document.getElementById('tp-notes').value, created_at: todayISO(),
      });
      const procName = document.getElementById('tp-proc').value.trim();
      if (procName){
        db.procedures.push({
          procedure_id: uid('pr'), treatment_plan_id: planId, procedure_name: procName, tooth_number: null,
          estimated_cost: value, priority: 'Medium', status: 'Planned', next_session_date: null, notes: '', created_at: todayISO(),
        });
      }
      niaSaveDB(db);
      modal.remove();
      niaToast(`Treatment plan ${planNumber} created.`);
      render();
    });
  }

  render();
  if (presetPatient) openAddModal();
};


