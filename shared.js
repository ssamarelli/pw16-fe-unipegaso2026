async function apiFetch(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return response.json();
    }
    return response.text();
}

const api = {
    users: {
        getAll: (role) => apiFetch(role ? `/api/user/list?role=${role}` : '/api/user/list')
    },
    doctor: {
        get: (fiscalCode) => apiFetch(`/api/doctor/${fiscalCode}`),
        getAppointments: (fiscalCode) => apiFetch(`/api/doctor/${fiscalCode}/appointments`),
        getPatients: (fiscalCode) => apiFetch(`/api/doctor/${fiscalCode}/patients`),
        create: (data) => apiFetch('/api/doctor/new-doctor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        update: (data) => apiFetch('/api/doctor/update-doctor', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        delete: (fiscalCode) => apiFetch(`/api/doctor/delete-doctor/${fiscalCode}`, {
            method: 'DELETE'
        })
    },
    patient: {
        get: (fiscalCode) => apiFetch(`/api/patient/${fiscalCode}`),
        getAppointments: (fiscalCode) => apiFetch(`/api/patient/${fiscalCode}/appointments`),
        create: (data) => apiFetch('/api/patient/new-patient', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        update: (data) => apiFetch('/api/patient/update-patient', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }),
        delete: (fiscalCode) => apiFetch(`/api/patient/delete/${fiscalCode}`, {
            method: 'DELETE'
        })
    },
    appointments: {
        getAll: () => apiFetch('/api/appointment/list'),
        create: (body, patientFiscalCode, doctorFiscalCode, type, status = 'CONFIRMED') => {
            const params = new URLSearchParams({ patientFiscalCode, doctorFiscalCode, type, status });
            return apiFetch(`/api/appointment/new-appointment?${params}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        },
        update: (id, body, type, status, doctorFiscalCode, patientFiscalCode) => {
            const params = new URLSearchParams({ type, status });
            if (doctorFiscalCode) params.append('doctorFiscalCode', doctorFiscalCode);
            if (patientFiscalCode) params.append('patientFiscalCode', patientFiscalCode);
            return apiFetch(`/api/appointment/update/${id}?${params}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        }
    }
};

function toBackendDate(htmlDate) {
    if (!htmlDate) return null;
    const [y, m, d] = htmlDate.split('-');
    return `${d}/${m}/${y}`;
}

function toHtmlDate(backendDate) {
    if (!backendDate) return '';
    const [d, m, y] = backendDate.split('/');
    return `${y}-${m}-${d}`;
}

function showToast(message, type = 'success') {
    const existing = document.getElementById('__toast');
    if (existing) existing.remove();

    const isSuccess = type === 'success';
    const toast = document.createElement('div');
    toast.id = '__toast';
    toast.style.cssText = [
        'position:fixed', 'bottom:2rem', 'right:2rem', 'z-index:9999',
        `background:${isSuccess ? 'linear-gradient(135deg,#22d3ee,#3b82f6)' : 'linear-gradient(135deg,#f87171,#ef4444)'}`,
        'color:#fff', 'padding:0.7rem 1.4rem', 'border-radius:999px',
        `font-family:'Poppins',sans-serif`, 'font-weight:600', 'font-size:0.875rem',
        `box-shadow:0 8px 30px rgba(${isSuccess ? '59,130,246' : '239,68,68'},0.35)`,
        'display:flex', 'align-items:center', 'gap:0.5rem',
        'transition:opacity 0.3s ease', 'opacity:1'
    ].join(';');
    toast.innerHTML = `<i class="fas fa-${isSuccess ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 320);
    }, 2600);
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('hidden');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
}

function showLoading(elementId, message = 'Loading...') {
    const el = document.getElementById(elementId);
    if (el) el.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>${message}</td></tr>`;
}

function showError(elementId, message = 'Failed to communicate with the server.') {
    const el = document.getElementById(elementId);
    if (el) el.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-red-500"><i class="fas fa-exclamation-circle mr-2"></i>${message}</td></tr>`;
}

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.onclick = (e) => {
        e.preventDefault();
        const modal = e.target.closest('.modal');
        if (modal) closeModal(modal.id);
    };
});

window.onclick = (e) => {
    if (e.target.classList.contains('modal')) {
        closeModal(e.target.id);
    }
};
