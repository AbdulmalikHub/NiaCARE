// Source section extracted from the original NiaCARE HTML.
/* ============================================================
   PAGE: Team & Roles
   ============================================================ */
Pages.team = function(db, user){
  if (!['admin','owner'].includes(user.role)){
    go('dashboard');
    return;
  }
  niaRenderShell('team', user, db);
  const scopedUsers = niaScopedUsers(db);
  niaRenderTopbar('Team & Roles', `${scopedUsers.length} staff members at ${db.facility.facility_name}.`);

  function render(){
    const html = `
      <div class="section-head">
        <div><h2>Staff Members</h2><p>Manage roles and access across the seven user types.</p></div>
        <button class="btn btn-primary" id="add-user-btn">${niaIcon('plus')}Add Staff Member</button>
      </div>

      <div class="card mt-16">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              ${scopedUsers.map(u => `
                <tr>
                  <td><div class="flex-gap"><div class="avatar-sm">${initials(u.full_name)}</div><span class="cell-strong">${u.full_name}</span></div></td>
                  <td>${u.email}</td>
                  <td>
                    <select class="role-select" data-user="${u.user_id}" ${u.user_id===user.user_id?'disabled':''} style="width:auto;">
                      ${NIA_ROLES.map(r=>`<option value="${r.id}" ${u.role===r.id?'selected':''}>${r.label}</option>`).join('')}
                    </select>
                  </td>
                  <td><span class="badge ${u.active_status?'badge-accepted':'badge-cancelled'}">${u.active_status?'Active':'Inactive'}</span></td>
                  <td>${fmtDate(u.created_at)}</td>
                  <td class="text-right">${u.user_id===user.user_id?'<span class="form-hint">You</span>':`<button class="btn btn-ghost btn-sm toggle-active" data-user="${u.user_id}">${u.active_status?'Deactivate':'Activate'}</button>`}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="section-head mt-24"><div><h2>Role Reference</h2><p>What each role can see and do in NiaCARE.</p></div></div>
      <div class="stat-grid">
        ${[
          {r:'Dentist', d:'Creates treatment plans, explains options, updates clinical progress.'},
          {r:'Dental Assistant', d:'Coordinates sessions, monitors root canal and braces cases.'},
          {r:'Front Office', d:'Schedules appointments, runs follow-ups, recovers inactive patients.'},
          {r:'Claims Officer', d:'Tracks insurance approvals and payment authorization.'},
          {r:'Facility Administrator', d:'Monitors operations, team performance, journey completion.'},
          {r:'Facility Owner', d:'Strategic oversight of revenue, completion, and retention.'},
          {r:'Super Admin', d:'Platform-wide access across all facilities.'},
        ].map(x => `<div class="card card-pad"><h4 style="font-size:14px; margin-bottom:6px;">${x.r}</h4><p style="font-size:12.5px; color:var(--nia-ink-soft); margin:0;">${x.d}</p></div>`).join('')}
      </div>
    `;
    document.getElementById('content').innerHTML = html;

    document.getElementById('add-user-btn').addEventListener('click', openAddModal);
    document.querySelectorAll('.role-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const u = db.users.find(x=>x.user_id===sel.dataset.user);
        u.role = sel.value;
        niaSaveDB(db);
        niaToast(`${u.full_name}'s role updated to ${niaRoleLabel(u.role)}.`);
        render();
      });
    });
    document.querySelectorAll('.toggle-active').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = db.users.find(x=>x.user_id===btn.dataset.user);
        u.active_status = !u.active_status;
        niaSaveDB(db);
        niaToast(`${u.full_name} ${u.active_status?'activated':'deactivated'}.`);
        render();
      });
    });
  }

  function openAddModal(){
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h3>Add Staff Member</h3><button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">✕</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-field full"><label>Full Name <span class="req">*</span></label><input type="text" id="nu-name" /></div>
            <div class="form-field full"><label>Email <span class="req">*</span></label><input type="email" id="nu-email" /></div>
            <div class="form-field full"><label>Role</label><select id="nu-role">${NIA_ROLES.map(r=>`<option value="${r.id}">${r.label}</option>`).join('')}</select></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-primary" id="save-user">Add Staff Member</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('save-user').addEventListener('click', () => {
      const name = document.getElementById('nu-name').value.trim();
      const email = document.getElementById('nu-email').value.trim();
      if (!name || !email){ niaToast('Please complete all required fields.'); return; }
      db.users.push({ user_id: uid('u'), facility_id: db.facility.facility_id, full_name: name, email, role: document.getElementById('nu-role').value, active_status: true, created_at: todayISO() });
      niaSaveDB(db);
      modal.remove();
      niaToast(`${name} added to the team.`);
      render();
    });
  }

  render();
};


