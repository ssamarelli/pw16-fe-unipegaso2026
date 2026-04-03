let allUsers = [];
let isEditMode = false;
let currentFiscalCode = null;
let currentRole = null;

async function loadAndRenderUsers() {
    showLoading('usersList', 'Loading users...');
    try {
        allUsers = await api.users.getAll();
        renderUsersList();
    } catch (err) {
        console.error('Failed to load users:', err);
        showError('usersList', 'Failed to load users from the server.');
    }
}

function renderUsersList() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const roleFilter = document.getElementById('roleFilter').value;
    const list = document.getElementById('usersList');

    const filtered = allUsers.filter(u => {
        const matchesSearch = `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm);
        const matchesRole = roleFilter === 'all' || u.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    if (filtered.length === 0) {
        list.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-400">No users found.</td></tr>`;
        return;
    }

    const roleLabels = { DOCTOR: 'Doctor', PATIENT: 'Patient' };

    list.innerHTML = filtered.map(u => `
        <tr style="cursor:pointer;" onclick="openUserModal('${u.fiscalCode}')">
            <td><span class="${u.role === 'DOCTOR' ? 'badge-doctor' : 'badge-patient'}">${roleLabels[u.role] || u.role}</span></td>
            <td style="font-weight:600;color:#1e293b;">${u.firstName} ${u.lastName}</td>
            <td style="font-family:monospace;font-size:0.82rem;color:#64748b;">${u.fiscalCode}</td>
            <td>${u.email}</td>
            <td>${u.phoneNumber || ''}</td>
        </tr>
    `).join('');
}

async function openUserModal(fiscalCode) {
    const summary = allUsers.find(x => x.fiscalCode === fiscalCode);
    if (!summary) return;

    isEditMode = true;
    currentFiscalCode = fiscalCode;
    currentRole = summary.role;
    let u = summary;

    if (summary.role === 'DOCTOR') {
        try { u = await api.doctor.get(fiscalCode); } catch (e) { /* fallback to summary */ }
    } else {
        try { u = await api.patient.get(fiscalCode); } catch (e) { /* fallback to summary */ }
    }

    document.getElementById('userRole').value = u.role;
    document.getElementById('userFiscalCode').value = u.fiscalCode;
    document.getElementById('userFirstName').value = u.firstName || '';
    document.getElementById('userLastName').value = u.lastName || '';
    document.getElementById('userEmail').value = u.email || '';
    document.getElementById('userPhone').value = u.phoneNumber || '';
    document.getElementById('userBirthplace').value = u.birthplace || '';
    document.getElementById('userBirthDate').value = toHtmlDate(u.dob || '');
    document.getElementById('userAddress').value = u.address || '';

    if (u.role === 'DOCTOR') {
        document.getElementById('doctorFields').classList.remove('hidden');
        document.getElementById('userSpecialization').value = u.specialization || '';
        document.getElementById('userMedicalLicenseNumber').value = u.medicalLicenseNumber || '';
    } else {
        document.getElementById('doctorFields').classList.add('hidden');
        document.getElementById('userSpecialization').value = '';
        document.getElementById('userMedicalLicenseNumber').value = '';
    }

    document.getElementById('userModalTitle').textContent = (u.role === 'DOCTOR' ? 'Dr. ' : '') + u.firstName + ' ' + u.lastName;
    document.getElementById('userEditBtn').classList.remove('hidden');

    setupTabs(currentRole, fiscalCode, u);
    disableUserEdit();
    switchTab('personalInfo');
    openModal('userModal');
}

function setupTabs(role, fiscalCode, userData = null) {
    const container = document.getElementById('userTabsContainer');
    let tabsHtml = `<button class="patient-tab px-4 py-2" onclick="switchTab('personalInfo')" data-tab="personalInfo">Personal Info</button>`;

    if (role === 'PATIENT') {
        tabsHtml += `
            <button class="patient-tab px-4 py-2" onclick="switchTab('clinicalHistory')" data-tab="clinicalHistory">Clinical History</button>
            <button class="patient-tab px-4 py-2" onclick="switchTab('patientAppointments')" data-tab="patientAppointments">Appointments</button>`;
        container.innerHTML = tabsHtml;
        loadClinicalHistory(fiscalCode, userData);
        loadPatientAppointments(fiscalCode);
    } else {
        tabsHtml += `
            <button class="patient-tab px-4 py-2" onclick="switchTab('doctorAppointments')" data-tab="doctorAppointments">Appointments</button>
            <button class="patient-tab px-4 py-2" onclick="switchTab('doctorPatients')" data-tab="doctorPatients">Patients</button>`;
        container.innerHTML = tabsHtml;
        loadDoctorData(fiscalCode);
    }
}

async function loadDoctorData(fiscalCode) {
    const appContainer = document.getElementById('doctorAppointmentsList');
    const patContainer = document.getElementById('doctorPatientsList');
    appContainer.innerHTML = `<p class="text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Loading...</p>`;
    patContainer.innerHTML = `<p class="text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Loading...</p>`;

    try {
        const appointments = await api.doctor.getAppointments(fiscalCode);
        appContainer.innerHTML = (appointments && appointments.length)
            ? appointments.map(a => {
                const patient = allUsers.find(u => u.fiscalCode === a.patientFiscalCode);
                const patientLabel = patient ? `${patient.firstName} ${patient.lastName}` : (a.patientFiscalCode || '');
                const statusColors = { CONFIRMED: '#16a34a', COMPLETED: '#2563eb', CANCELLED: '#dc2626' };
                const statusColor = statusColors[a.appointmentStatus] || '#94a3b8';
                return `
                <div class="info-card" style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;">
                    <div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="font-weight:700;color:#3b82f6;font-size:0.8rem;">#${a.appointmentId}</span>
                            <span style="font-size:0.72rem;font-weight:600;color:${statusColor};background:${statusColor}18;padding:1px 8px;border-radius:999px;text-transform:uppercase;">${a.appointmentStatus || ''}</span>
                        </div>
                        <div style="font-weight:600;color:#1e293b;font-size:0.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${patientLabel}</div>
                        <div style="color:#94a3b8;font-size:0.78rem;">${a.appointmentDate} · ${a.appointmentTime} · <span style="text-transform:capitalize;">${(a.appointmentType || '').toLowerCase().replace('_', ' ')}</span></div>
                    </div>
                    <button onclick="openAptEditModal(${JSON.stringify(a).replace(/"/g, '&quot;')})"
                        style="flex-shrink:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:none;background:#eff6ff;color:#3b82f6;border-radius:10px;cursor:pointer;transition:all 0.2s;"
                        title="Edit appointment">
                        <i class="fas fa-edit" style="font-size:0.8rem;"></i>
                    </button>
                </div>`;
            }).join('')
            : '<p style="color:#94a3b8;font-size:0.875rem;">No appointments found.</p>';
    } catch (err) {
        console.error('Failed to load doctor appointments:', err);
        appContainer.innerHTML = `<p class="text-red-500">Failed to communicate with the server.</p>`;
    }

    try {
        const patients = await api.doctor.getPatients(fiscalCode);
        patContainer.innerHTML = (patients && patients.length)
            ? patients.map(p => `
                <div class="info-card" style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:600;color:#1e293b;">${p.firstName} ${p.lastName}</span>
                    <span style="color:#94a3b8;font-size:0.82rem;">${p.phoneNumber || ''}</span>
                </div>`).join('')
            : '<p style="color:#94a3b8;font-size:0.875rem;">No patients found.</p>';
    } catch (err) {
        console.error('Failed to load doctor patients:', err);
        patContainer.innerHTML = `<p class="text-red-500">Failed to communicate with the server.</p>`;
    }
}

async function loadPatientAppointments(fiscalCode) {
    const container = document.getElementById('patientAppointmentsList');
    container.innerHTML = `<p class="text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Loading...</p>`;

    try {
        const appointments = await api.patient.getAppointments(fiscalCode);
        container.innerHTML = (appointments && appointments.length)
            ? appointments.map(a => {
                const doctor = allUsers.find(u => u.fiscalCode === a.doctorFiscalCode);
                const doctorLabel = doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : (a.doctorFiscalCode || '');
                const statusColors = { CONFIRMED: '#16a34a', COMPLETED: '#2563eb', CANCELLED: '#dc2626' };
                const statusColor = statusColors[a.appointmentStatus] || '#94a3b8';
                return `
                <div class="info-card" style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;">
                    <div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="font-weight:700;color:#3b82f6;font-size:0.8rem;">#${a.appointmentId}</span>
                            <span style="font-size:0.72rem;font-weight:600;color:${statusColor};background:${statusColor}18;padding:1px 8px;border-radius:999px;text-transform:uppercase;">${a.appointmentStatus || ''}</span>
                        </div>
                        <div style="font-weight:600;color:#1e293b;font-size:0.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${doctorLabel}</div>
                        <div style="color:#94a3b8;font-size:0.78rem;">${a.appointmentDate} · ${a.appointmentTime} · <span style="text-transform:capitalize;">${(a.appointmentType || '').toLowerCase().replace('_', ' ')}</span></div>
                    </div>
                </div>`;
            }).join('')
            : '<p style="color:#94a3b8;font-size:0.875rem;">No appointments found.</p>';
    } catch (err) {
        console.error('Failed to load patient appointments:', err);
        container.innerHTML = `<p class="text-red-500">Failed to communicate with the server.</p>`;
    }
}

function openAptEditModal(apt) {
    document.getElementById('aptEditId').value = apt.appointmentId;
    document.getElementById('aptEditPatientFc').value = apt.patientFiscalCode || '';
    document.getElementById('aptEditDoctorFc').value = apt.doctorFiscalCode || '';
    document.getElementById('aptEditDate').value = toHtmlDate(apt.appointmentDate || '');
    document.getElementById('aptEditTime').value = apt.appointmentTime || '';
    document.getElementById('aptEditType').value = apt.appointmentType || 'CONSULTATION';
    document.getElementById('aptEditStatus').value = apt.appointmentStatus || 'CONFIRMED';
    document.getElementById('aptEditModalTitle').textContent = `Edit Appointment #${apt.appointmentId}`;

    const patient = allUsers.find(u => u.fiscalCode === apt.patientFiscalCode);
    const doctor = allUsers.find(u => u.fiscalCode === apt.doctorFiscalCode);
    document.getElementById('aptEditPatientName').value = patient ? `${patient.firstName} ${patient.lastName}` : (apt.patientFiscalCode || '');
    document.getElementById('aptEditDoctorName').value = doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : (apt.doctorFiscalCode || '');

    openModal('aptEditModal');
}

document.getElementById('aptEditSaveBtn').onclick = async () => {
    const id = document.getElementById('aptEditId').value;
    const patientFiscalCode = document.getElementById('aptEditPatientFc').value;
    const doctorFiscalCode = document.getElementById('aptEditDoctorFc').value;
    const type = document.getElementById('aptEditType').value;
    const status = document.getElementById('aptEditStatus').value;
    const body = {
        appointmentDate: toBackendDate(document.getElementById('aptEditDate').value),
        appointmentTime: document.getElementById('aptEditTime').value
    };

    try {
        await api.appointments.update(id, body, type, status, doctorFiscalCode, patientFiscalCode);
        closeModal('aptEditModal');
        showToast('Appointment updated successfully');
        const userFc = currentFiscalCode || document.getElementById('userFiscalCode').value;
        const userRole = currentRole || document.getElementById('userRole').value;
        if (userFc && userRole === 'DOCTOR') await loadDoctorData(userFc);
        if (userFc && userRole === 'PATIENT') await loadPatientAppointments(userFc);
    } catch (err) {
        console.error('Failed to update appointment:', err);
        showToast('Failed to communicate with the server.', 'error');
    }
};

function loadClinicalHistory(fiscalCode, userData = null) {
    document.getElementById('historyDiagnosis').value = userData?.diagnosis || '';
    document.getElementById('historyTreatments').value = userData?.treatments || '';
    document.getElementById('historyAllergies').value = userData?.allergies || '';
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('.patient-tab').forEach(t => t.classList.remove('active'));
    const content = document.getElementById(tabId);
    if (content) content.classList.remove('hidden');
    const tab = document.querySelector(`[data-tab="${tabId}"]`);
    if (tab) tab.classList.add('active');
}

function startRegistration(role) {
    closeModal('roleModal');
    document.getElementById('userForm').reset();
    document.getElementById('userRole').value = role;
    document.getElementById('userModalTitle').textContent = 'Register ' + (role === 'DOCTOR' ? 'Doctor' : 'Patient');
    isEditMode = false;
    currentFiscalCode = null;
    currentRole = role;

    document.getElementById('historyDiagnosis').value = '';
    document.getElementById('historyTreatments').value = '';
    document.getElementById('historyAllergies').value = '';

    if (role === 'DOCTOR') {
        document.getElementById('doctorFields').classList.remove('hidden');
    } else {
        document.getElementById('doctorFields').classList.add('hidden');
    }

    document.getElementById('userEditBtn').classList.add('hidden');
    const container = document.getElementById('userTabsContainer');
    container.innerHTML = `<button class="patient-tab active px-4 py-2" data-tab="personalInfo">Personal Info</button>`;

    enableUserEdit(false);
    switchTab('personalInfo');
    openModal('userModal');
}

function disableUserEdit() {
    ['userFiscalCode', 'userBirthplace', 'userFirstName', 'userLastName', 'userEmail', 'userPhone',
        'userBirthDate', 'userAddress', 'userSpecialization', 'userMedicalLicenseNumber',
        'historyDiagnosis', 'historyTreatments', 'historyAllergies'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = true;
        });
    document.getElementById('userGlobalSaveBtn').classList.add('hidden');
    document.getElementById('deleteUserBtn').classList.add('hidden');
}

function enableUserEdit(showDelete = true) {
    ['userBirthplace', 'userFirstName', 'userLastName', 'userEmail', 'userPhone',
        'userBirthDate', 'userAddress', 'userSpecialization', 'userMedicalLicenseNumber',
        'historyDiagnosis', 'historyTreatments', 'historyAllergies'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = false;
        });
    if (!isEditMode) {
        document.getElementById('userFiscalCode').disabled = false;
    }
    document.getElementById('userGlobalSaveBtn').classList.remove('hidden');
    if (showDelete) {
        document.getElementById('deleteUserBtn').classList.remove('hidden');
    }
}

document.getElementById('registerUserBtn').onclick = () => openModal('roleModal');
document.getElementById('userEditBtn').onclick = () => enableUserEdit(true);
document.getElementById('searchInput').oninput = renderUsersList;
document.getElementById('roleFilter').onchange = renderUsersList;

document.getElementById('userGlobalSaveBtn').onclick = async () => {
    const fiscalCode = document.getElementById('userFiscalCode').value.trim();
    // Use the reliable global variable instead of the hidden input (which may be stale)
    const role = currentRole || document.getElementById('userRole').value;

    try {
        if (role === 'DOCTOR') {
            const doctorData = {
                firstName: document.getElementById('userFirstName').value,
                lastName: document.getElementById('userLastName').value,
                email: document.getElementById('userEmail').value,
                phoneNumber: document.getElementById('userPhone').value,
                dob: toBackendDate(document.getElementById('userBirthDate').value),
                birthplace: document.getElementById('userBirthplace').value,
                fiscalCode,
                address: document.getElementById('userAddress').value,
                specialization: document.getElementById('userSpecialization').value,
                medicalLicenseNumber: document.getElementById('userMedicalLicenseNumber').value
            };
            if (isEditMode) {
                await api.doctor.update(doctorData);
            } else {
                await api.doctor.create(doctorData);
            }
        } else {
            const patientData = {
                firstName: document.getElementById('userFirstName').value,
                lastName: document.getElementById('userLastName').value,
                email: document.getElementById('userEmail').value,
                phoneNumber: document.getElementById('userPhone').value,
                dob: toBackendDate(document.getElementById('userBirthDate').value),
                birthplace: document.getElementById('userBirthplace').value,
                fiscalCode,
                address: document.getElementById('userAddress').value,
                diagnosis: document.getElementById('historyDiagnosis').value,
                treatments: document.getElementById('historyTreatments').value,
                allergies: document.getElementById('historyAllergies').value
            };
            if (isEditMode) {
                await api.patient.update(patientData);
            } else {
                await api.patient.create(patientData);
            }
        }

        if (isEditMode) {
            disableUserEdit();
            showToast('Changes saved successfully');
        } else {
            closeModal('userModal');
            showToast('User registered successfully');
        }
        await loadAndRenderUsers();
    } catch (err) {
        console.error('Failed to save user:', err);
        showToast('Failed to communicate with the server.', 'error');
    }
};

document.getElementById('deleteUserBtn').onclick = async () => {
    const fiscalCode = document.getElementById('userFiscalCode').value.trim();
    const role = currentRole || document.getElementById('userRole').value;
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
        if (role === 'DOCTOR') {
            await api.doctor.delete(fiscalCode);
        } else {
            await api.patient.delete(fiscalCode);
        }
        closeModal('userModal');
        showToast('User deleted successfully');
        await loadAndRenderUsers();
    } catch (err) {
        console.error('Failed to delete user:', err);
        showToast('Failed to communicate with the server.', 'error');
    }
};

window.onload = loadAndRenderUsers;
