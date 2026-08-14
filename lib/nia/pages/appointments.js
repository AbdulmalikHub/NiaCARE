// Source section extracted from the original NiaCARE HTML.
/* ============================================================
   PAGE: Appointments
   ============================================================ */
Pages.appointments = function(db, user){
  niaRenderShell('appointments', user, db);
  niaRenderTopbar('Appointments', `${niaScopedAppointments(db).filter(a=>a.status==='Scheduled').length} upcoming appointments.`);

  let viewFilter = 'upcoming';
  const STATUSES = ['Scheduled','Completed','No Show','Cancelled'];

  function render(){
    let rows = niaScopedAppointments(db);
    const today = todayISO();
    if (viewFilter === 'upcoming') rows = rows.filter(a => a.status === 'Scheduled');
    if (viewFilter === 'today') rows = rows.filter(a => a.appointment_date === today);
    if (viewFilter === 'past') rows = rows.filter(a => a.status !== 'Scheduled');
    rows.sort((a,b) => (a.appointment_date+a.appointment_time).localeCompare(b.appointment_date+b.appointment_time));

    const grouped = {};
    rows.forEach(a => { (grouped[a.appointment_date] = grouped[a.appointment_date] || []).push(a); });

    const html = `
      <div class="section-head">
        <div><h2>Appointment Schedule</h2><p>Manage treatment sessions, no-shows, and provider assignments.</p></div>
        <button class="btn btn-primary" id="add-appt-btn">${niaIcon('plus')}New Appointment</button>
      </div>

      <div class="pill-tab mt-16" id="view-filter">
        <button data-v="upcoming" class="${viewFilter==='upcoming'?'active':''}">Upcoming</button>
        <button data-v="today" class="${viewFilter==='today'?'active':''}">Today</button>
        <button data-v="past" class="${viewFilter==='past'?'active':''}">Past & Closed</button>
      </div>

      <div class="mt-16" style="display:flex; flex-direction:column; gap:16px;">
        ${Object.keys(grouped).length ? Object.keys(grouped).map(date => `
          <div class="card">
            <div class="card-header"><h3>${fmtDate(date)}${date===today?' <span class="badge badge-gold" style="margin-left:8px;">Today</span>':''}</h3><div class="hint">${grouped[date].length} appointment${grouped[date].length>1?'s':''}</div></div>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Time</th><th>Patient</th><th>Procedure</th><th>Provider</th><th>Status</th><th>Notes</th></tr></thead>
                <tbody>
                  ${grouped[date].map(a => {
                    const proc = db.procedures.find(p=>p.procedure_id===a.procedure_id);
                    return `<tr>
                      <td class="cell-strong">${a.appointment_time}</td>
                      <td><a href="#" class="link-patient" data-patient="${a.patient_id}" style="color:var(--nia-primary); font-weight:600;">${niaPatientName(db,a.patient_id)}</a></td>
                      <td>${proc?proc.procedure_name:'Consultation'}</td>
                      <td>${niaUserName(db,a.provider_id)}</td>
                      <td>
                        <select class="appt-status" data-appt="${a.appointment_id}" style="font-size:11.5px; padding:4px 8px; width:auto; border-radius:99px; font-weight:700; text-transform:uppercase;">
                          ${STATUSES.map(s=>`<option value="${s}" ${a.status===s?'selected':''}>${s}</option>`).join('')}
                        </select>
                      </td>
                      <td class="cell-sub">${a.notes||'—'}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `).join('') : `<div class="card"><div class="empty-state">${niaIcon('empty')}<h4>No appointments in this view</h4><p>Switch tabs or schedule a new appointment.</p></div></div>`}
      </div>
    `;
    document.getElementById('content').innerHTML = html;

    document.querySelectorAll('#view-filter button').forEach(btn => btn.addEventListener('click', () => { viewFilter = btn.dataset.v; render(); }));
    document.getElementById('add-appt-btn').addEventListener('click', openAddModal);
    document.querySelectorAll('.link-patient').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); go('patient-profile', { id: el.dataset.patient }); });
    });
    document.querySelectorAll('.appt-status').forEach(sel => {
      sel.addEventListener('change', () => {
        const appt = db.appointments.find(a => a.appointment_id === sel.dataset.appt);
        const prevStatus = appt.status;
        appt.status = sel.value;
        if (sel.value === 'No Show' && prevStatus !== 'No Show'){
          const frontOfficeStaff = niaScopedUsers(db).find(u=>u.role==='front_office');
          db.followUps.push({
            follow_up_id: uid('fu'), facility_id: db.facility.facility_id, patient_id: appt.patient_id,
            treatment_plan_id: appt.treatment_plan_id, conducted_by: frontOfficeStaff ? frontOfficeStaff.user_id : user.user_id,
            follow_up_date: todayISO(), outcome: 'Not Reached', next_follow_up_date: todayISO(2),
            notes: 'Auto-created: patient missed appointment.', created_at: todayISO(),
          });
          niaToast(`No-show recorded. Follow-up task created automatically.`);
        } else {
          niaToast(`Appointment marked as ${sel.value}.`);
        }
        niaSaveDB(db);
        render();
      });
    });
  }

  function openAddModal(){
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    const facilityPatients = niaScopedPatients(db);
    const providers = niaScopedUsers(db).filter(u=>['dentist','assistant'].includes(u.role));
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h3>Schedule New Appointment</h3><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-field full"><label>Patient <span class="req">*</span></label>
              <select id="ap-patient">${facilityPatients.map(p=>`<option value="${p.patient_id}">${p.first_name} ${p.last_name} (${p.patient_number})</option>`).join('')}</select>
            </div>
            <div class="form-field"><label>Provider</label><select id="ap-provider">${providers.map(p=>`<option value="${p.user_id}">${p.full_name}</option>`).join('')}</select></div>
            <div class="form-field"><label>Procedure</label>
              <select id="ap-procedure"><option value="">— Consultation —</option></select>
            </div>
            <div class="form-field"><label>Date <span class="req">*</span></label><input type="date" id="ap-date" value="${todayISO(1)}" /></div>
            <div class="form-field"><label>Time <span class="req">*</span></label><input type="time" id="ap-time" value="09:00" /></div>
            <div class="form-field full"><label>Notes</label><textarea id="ap-notes"></textarea></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-primary" id="save-appt">Schedule Appointment</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    function refreshProcedures(){
      const pid = document.getElementById('ap-patient').value;
      const plans = db.plans.filter(p=>p.patient_id===pid).map(p=>p.treatment_plan_id);
      const procs = db.procedures.filter(pr => plans.includes(pr.treatment_plan_id) && pr.status !== 'Completed');
      document.getElementById('ap-procedure').innerHTML = `<option value="">— Consultation —</option>` + procs.map(pr=>`<option value="${pr.procedure_id}">${pr.procedure_name}</option>`).join('');
    }
    document.getElementById('ap-patient').addEventListener('change', refreshProcedures);
    refreshProcedures();

    document.getElementById('save-appt').addEventListener('click', () => {
      const patientId = document.getElementById('ap-patient').value;
      const date = document.getElementById('ap-date').value;
      const time = document.getElementById('ap-time').value;
      if (!patientId || !date || !time){ niaToast('Please complete all required fields.'); return; }
      const procId = document.getElementById('ap-procedure').value || null;
      const proc = procId ? db.procedures.find(p=>p.procedure_id===procId) : null;
      db.appointments.push({
        appointment_id: uid('ap'), facility_id: db.facility.facility_id, patient_id: patientId,
        treatment_plan_id: proc ? proc.treatment_plan_id : null, procedure_id: procId,
        provider_id: document.getElementById('ap-provider').value, appointment_date: date, appointment_time: time,
        status: 'Scheduled', notes: document.getElementById('ap-notes').value, created_at: todayISO(),
      });
      if (proc){ proc.status = 'Scheduled'; proc.next_session_date = date; }
      niaSaveDB(db);
      modal.remove();
      niaToast('Appointment scheduled.');
      render();
    });
  }

  render();
};


