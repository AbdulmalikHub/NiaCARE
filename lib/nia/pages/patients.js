// Source section extracted from the original NiaCARE HTML.
/* ============================================================
   PAGE: Patients
   ============================================================ */
Pages.patients = function(db, user){
  niaRenderShell('patients', user, db);
  niaRenderTopbar('Patients', `${niaScopedPatients(db).length} patients registered at ${db.facility.facility_name}.`);

  let search = '';
  let paymentFilter = 'all';

  function patientPlans(patientId){ return db.plans.filter(p => p.patient_id === patientId); }
  function patientValue(patientId){ return patientPlans(patientId).reduce((s,p)=>s+p.total_estimated_value,0); }
  function patientStatus(patientId){
    const plans = patientPlans(patientId);
    if (!plans.length) return 'No Plan';
    if (plans.some(p=>p.status==='Dropped Off')) return 'Dropped Off';
    if (plans.some(p=>p.status==='In Progress')) return 'In Progress';
    if (plans.some(p=>['Accepted','Shared'].includes(p.status))) return 'Active';
    if (plans.every(p=>p.status==='Completed')) return 'Completed';
    return 'Active';
  }

  function render(){
    const scopedPatients = niaScopedPatients(db);
    let rows = scopedPatients.filter(p => {
      const matchesSearch = !search || (p.first_name+' '+p.last_name+' '+p.patient_number+' '+p.phone_number).toLowerCase().includes(search.toLowerCase());
      const matchesPayment = paymentFilter === 'all' || p.payment_type.startsWith(paymentFilter);
      return matchesSearch && matchesPayment;
    });

    const html = `
      <div class="section-head">
        <div><h2>All Patients</h2><p>Demographic records and treatment journey snapshot.</p></div>
        <button class="btn btn-primary" id="add-patient-btn">${niaIcon('plus')}New Patient</button>
      </div>

      <div class="card mt-16">
        <div style="padding:16px 20px; display:flex; gap:12px; flex-wrap:wrap; align-items:center; border-bottom:1px solid var(--nia-line);">
          <div class="topbar-search" style="min-width:280px;">${niaIcon('search')}<input type="text" id="patient-search" placeholder="Search by name, number, or phone..." value="${search}" /></div>
          <div class="pill-tab" id="payment-filter">
            <button data-v="all" class="${paymentFilter==='all'?'active':''}">All</button>
            <button data-v="Cash" class="${paymentFilter==='Cash'?'active':''}">Cash</button>
            <button data-v="Insurance" class="${paymentFilter==='Insurance'?'active':''}">Insurance</button>
          </div>
          <div style="margin-left:auto; font-size:12.5px; color:var(--nia-ink-soft);">${rows.length} of ${scopedPatients.length} patients</div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Patient</th><th>Contact</th><th>Payment</th><th>Journey Status</th><th>Treatment Value</th><th>Registered</th><th></th></tr></thead>
            <tbody>
              ${rows.map(p => `
                <tr style="cursor:pointer;" class="row-to-patient" data-patient="${p.patient_id}">
                  <td>
                    <div class="flex-gap">
                      <div class="avatar-sm">${initials(p.first_name+' '+p.last_name)}</div>
                      <div>
                        <div class="cell-strong">${p.first_name} ${p.last_name}</div>
                        <div class="cell-sub">${p.patient_number}</div>
                      </div>
                    </div>
                  </td>
                  <td>${p.phone_number}<div class="cell-sub">${p.email}</div></td>
                  <td>${p.payment_type}</td>
                  <td><span class="badge ${niaBadgeClass(patientStatus(p.patient_id)==='No Plan'?'Draft':patientStatus(p.patient_id))}">${patientStatus(p.patient_id)}</span></td>
                  <td class="cell-strong">${fmtKES(patientValue(p.patient_id))}</td>
                  <td>${fmtDate(p.created_at)}</td>
                  <td class="text-right"><button class="btn btn-ghost btn-sm view-patient-btn" data-patient="${p.patient_id}">View</button></td>
                </tr>
              `).join('') || `<tr><td colspan="7"><div class="empty-state">${niaIcon('empty')}<h4>No patients found</h4><p>Try a different search or filter.</p></div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById('content').innerHTML = html;

    document.getElementById('patient-search').addEventListener('input', e => { search = e.target.value; render(); preserveFocus(); });
    document.querySelectorAll('#payment-filter button').forEach(btn => btn.addEventListener('click', () => { paymentFilter = btn.dataset.v; render(); }));
    document.getElementById('add-patient-btn').addEventListener('click', openAddModal);
    document.querySelectorAll('.row-to-patient').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.view-patient-btn')) return;
        go('patient-profile', { id: row.dataset.patient });
      });
    });
    document.querySelectorAll('.view-patient-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); go('patient-profile', { id: btn.dataset.patient }); });
    });
  }

  function preserveFocus(){
    const el = document.getElementById('patient-search');
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }

  function openAddModal(){
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h3>Register New Patient</h3><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-field"><label>First Name <span class="req">*</span></label><input type="text" id="np-first" /></div>
            <div class="form-field"><label>Last Name <span class="req">*</span></label><input type="text" id="np-last" /></div>
            <div class="form-field"><label>Phone Number <span class="req">*</span></label><input type="text" id="np-phone" placeholder="+254 7XX XXX XXX" /></div>
            <div class="form-field"><label>Email</label><input type="email" id="np-email" /></div>
            <div class="form-field"><label>Date of Birth</label><input type="date" id="np-dob" /></div>
            <div class="form-field"><label>Gender</label><select id="np-gender"><option>Female</option><option>Male</option></select></div>
            <div class="form-field full"><label>Payment Type</label><select id="np-payment"><option>Cash</option><option>Insurance — NHIF SHA</option><option>Insurance — AAR</option><option>Insurance — Jubilee</option></select></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-primary" id="save-patient">Register Patient</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('save-patient').addEventListener('click', () => {
      const first = document.getElementById('np-first').value.trim();
      const last = document.getElementById('np-last').value.trim();
      const phone = document.getElementById('np-phone').value.trim();
      if (!first || !last || !phone){ niaToast('Please fill in required fields.'); return; }
      const newId = uid('p');
      const num = 'NIA-P-' + (1000 + niaScopedPatients(db).length + 1);
      db.patients.push({
        patient_id:newId, facility_id:db.facility.facility_id, patient_number:num,
        first_name:first, last_name:last, phone_number:phone,
        email: document.getElementById('np-email').value.trim(),
        date_of_birth: document.getElementById('np-dob').value,
        gender: document.getElementById('np-gender').value,
        payment_type: document.getElementById('np-payment').value,
        created_at: todayISO(),
      });
      niaSaveDB(db);
      modal.remove();
      niaToast(`${first} ${last} registered successfully.`);
      render();
    });
  }

  render();
};


