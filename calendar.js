let calendarUsers = [];
let _currentPopupApt = null;

async function initializeCalendar() {
    const calendarEl = document.getElementById('calendar');

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
        weekends: false,
        slotMinTime: '09:00:00',
        slotMaxTime: '18:00:00',
        allDaySlot: false,
        height: '100%',
        expandRows: true,
        events: async (fetchInfo, successCallback, failureCallback) => {
            try {
                const appointments = await api.appointments.getAll();
                const events = appointments.map(apt => {
                    const patient = calendarUsers.find(u => u.fiscalCode === apt.patientFiscalCode);
                    const patientLabel = patient
                        ? `${patient.firstName} ${patient.lastName}`
                        : (apt.patientFiscalCode || '');
                        
                    const pastelColors = {
                        CONSULTATION: { bg: '#e9d5ff', text: '#581c87' }, // purple
                        CHECKUP: { bg: '#bae6fd', text: '#0369a1' }, // blue
                        SURGERY: { bg: '#fecaca', text: '#991b1b' }, // red/pink
                        FOLLOW_UP: { bg: '#fed7aa', text: '#9a3412' } // orange
                    };
                    const color = pastelColors[apt.appointmentType] || { bg: '#f1f5f9', text: '#475569' };

                    return {
                        id: apt.appointmentId,
                        title: `${patientLabel}\n${apt.appointmentType || ''}`,
                        start: `${toHtmlDate(apt.appointmentDate)}T${apt.appointmentTime}`,
                        backgroundColor: color.bg,
                        borderColor: color.bg,
                        textColor: color.text,
                        extendedProps: apt
                    };
                });
                successCallback(events);
            } catch (err) {
                console.error('Failed to load appointments:', err);
                showToast('Failed to load appointments from server.', 'error');
                failureCallback(err);
            }
        },
        dateClick: (info) => {
            closePopup();
            openNewAppointmentModal(info.dateStr);
        },
        eventMouseEnter: (info) => {
            clearTimeout(window.popupCloseTimeout);
            openAppointmentPopup(info.event.extendedProps, info.jsEvent);
        },
        eventMouseLeave: (info) => {
            window.popupCloseTimeout = setTimeout(() => {
                closePopup();
            }, 300);
        }
    });

    calendar.render();
    window.calendarInstance = calendar;
}

async function loadUsersForSelects() {
    try {
        calendarUsers = await api.users.getAll();
    } catch (err) {
        console.error('Failed to load users for selects:', err);
        showToast('Failed to load user list from server.', 'error');
    }
}

function openAppointmentPopup(apt, jsEvent) {
    const popup = document.getElementById('aptPopup');

    if (_currentPopupApt && _currentPopupApt.appointmentId === apt.appointmentId) {
        popup.classList.remove('hidden');
        return;
    }

    _currentPopupApt = apt;

    const patient = calendarUsers.find(u => u.fiscalCode === apt.patientFiscalCode);
    const doctor = calendarUsers.find(u => u.fiscalCode === apt.doctorFiscalCode);
    const patientLabel = patient ? `${patient.firstName} ${patient.lastName}` : (apt.patientFiscalCode || '—');
    const doctorLabel = doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : (apt.doctorFiscalCode || '—');

    const typeLabels = { CONSULTATION: 'Consultation', CHECKUP: 'Checkup', SURGERY: 'Surgery', FOLLOW_UP: 'Follow-up' };
    const statusColors = { CONFIRMED: '#16a34a', COMPLETED: '#2563eb', CANCELLED: '#dc2626' };

    document.getElementById('aptPopupId').textContent = `#${apt.appointmentId}`;
    document.getElementById('aptPopupPatient').textContent = patientLabel;
    document.getElementById('aptPopupDoctor').textContent = doctorLabel;
    document.getElementById('aptPopupDate').textContent = apt.appointmentDate;
    document.getElementById('aptPopupTime').textContent = apt.appointmentTime;
    document.getElementById('aptPopupType').textContent = typeLabels[apt.appointmentType] || apt.appointmentType || '—';

    const statusEl = document.getElementById('aptPopupStatus');
    statusEl.textContent = apt.appointmentStatus || '—';
    const statusIcon = statusEl.previousElementSibling;
    statusIcon.style.color = statusColors[apt.appointmentStatus] || '#94a3b8';
    statusIcon.style.fontSize = '0.5rem';

    popup.classList.remove('hidden');

    const margin = 12;
    const pw = popup.offsetWidth || 260;
    const ph = popup.offsetHeight || 260;
    let x = jsEvent.clientX + margin;
    let y = jsEvent.clientY + margin;
    if (x + pw > window.innerWidth - margin) x = jsEvent.clientX - pw - margin;
    if (y + ph > window.innerHeight - margin) y = jsEvent.clientY - ph - margin;

    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
}

function closePopup() {
    document.getElementById('aptPopup').classList.add('hidden');
    _currentPopupApt = null;
}

document.getElementById('aptPopupClose').onclick = closePopup;

document.getElementById('aptPopupEditBtn').onclick = () => {
    if (!_currentPopupApt) return;
    closePopup();
    openEditAppointmentModal(_currentPopupApt);
};

const aptPopup = document.getElementById('aptPopup');
aptPopup.addEventListener('mouseenter', () => {
    clearTimeout(window.popupCloseTimeout);
});
aptPopup.addEventListener('mouseleave', () => {
    window.popupCloseTimeout = setTimeout(() => {
        closePopup();
    }, 200);
});

document.addEventListener('click', (e) => {
    const popup = document.getElementById('aptPopup');
    if (!popup.classList.contains('hidden') && !popup.contains(e.target)) {
        closePopup();
    }
});

function openNewAppointmentModal(dateStr) {
    document.getElementById('appointmentForm').reset();
    document.getElementById('appointmentId').value = '';
    document.getElementById('appointmentIdDisplay').classList.add('hidden');

    const [date, time] = dateStr ? dateStr.split('T') : ['', ''];
    document.getElementById('appointmentDate').value = date;
    if (time) document.getElementById('appointmentTime').value = time.substring(0, 5);

    document.getElementById('appointmentModalTitle').textContent = 'New Appointment';
    document.getElementById('cancelAppointmentBtn').classList.add('hidden');
    document.getElementById('appointmentEditBtn').classList.add('hidden');
    enableAppointmentEdit();
    populateSelects();
    openModal('appointmentModal');
}

function openEditAppointmentModal(apt) {
    document.getElementById('appointmentId').value = apt.appointmentId;
    document.getElementById('appointmentIdDisplay').classList.remove('hidden');
    document.getElementById('appointmentIdReadonly').value = '#' + apt.appointmentId;
    document.getElementById('appointmentDate').value = toHtmlDate(apt.appointmentDate);
    document.getElementById('appointmentTime').value = apt.appointmentTime;
    document.getElementById('appointmentType').value = apt.appointmentType;
    document.getElementById('appointmentModalTitle').textContent = 'Edit Appointment';
    document.getElementById('cancelAppointmentBtn').classList.remove('hidden');
    document.getElementById('appointmentEditBtn').classList.remove('hidden');
    disableAppointmentEdit();
    populateSelects();
    document.getElementById('appointmentPatient').value = apt.patientFiscalCode || '';
    document.getElementById('appointmentDoctor').value = apt.doctorFiscalCode || '';
    openModal('appointmentModal');
}

function populateSelects() {
    const pSelect = document.getElementById('appointmentPatient');
    const dSelect = document.getElementById('appointmentDoctor');

    pSelect.innerHTML = '<option value="">Select a patient...</option>' +
        calendarUsers.filter(u => u.role === 'PATIENT').map(u =>
            `<option value="${u.fiscalCode}">${u.firstName} ${u.lastName}</option>`
        ).join('');

    dSelect.innerHTML = '<option value="">Select a doctor...</option>' +
        calendarUsers.filter(u => u.role === 'DOCTOR').map(u =>
            `<option value="${u.fiscalCode}">Dr. ${u.firstName} ${u.lastName}</option>`
        ).join('');
}

function enableAppointmentEdit() {
    ['appointmentDate', 'appointmentTime', 'appointmentPatient', 'appointmentDoctor', 'appointmentType']
        .forEach(id => document.getElementById(id).disabled = false);
    document.getElementById('appointmentConfirmBtn').classList.remove('hidden');
}

function disableAppointmentEdit() {
    ['appointmentDate', 'appointmentTime', 'appointmentPatient', 'appointmentDoctor', 'appointmentType']
        .forEach(id => document.getElementById(id).disabled = true);
    document.getElementById('appointmentConfirmBtn').classList.add('hidden');
}

document.getElementById('appointmentForm').onsubmit = async (e) => {
    e.preventDefault();
    const appId = document.getElementById('appointmentId').value;
    const patientFiscalCode = document.getElementById('appointmentPatient').value;
    const doctorFiscalCode = document.getElementById('appointmentDoctor').value;
    const type = document.getElementById('appointmentType').value;
    const body = {
        appointmentDate: toBackendDate(document.getElementById('appointmentDate').value),
        appointmentTime: document.getElementById('appointmentTime').value
    };

    try {
        if (appId) {
            await api.appointments.update(appId, body, type, 'CONFIRMED', doctorFiscalCode, patientFiscalCode);
        } else {
            await api.appointments.create(body, patientFiscalCode, doctorFiscalCode, type);
        }
        disableAppointmentEdit();
        showToast(appId ? 'Appointment updated successfully' : 'Appointment created successfully');
        window.calendarInstance.refetchEvents();
    } catch (err) {
        console.error('Failed to save appointment:', err);
        showToast('Failed to communicate with the server.', 'error');
    }
};

document.getElementById('cancelAppointmentBtn').onclick = async () => {
    const appId = document.getElementById('appointmentId').value;
    if (!appId || !confirm('Are you sure you want to cancel this appointment?')) return;
    const type = document.getElementById('appointmentType').value;
    const body = {
        appointmentDate: toBackendDate(document.getElementById('appointmentDate').value),
        appointmentTime: document.getElementById('appointmentTime').value
    };
    try {
        await api.appointments.update(appId, body, type, 'CANCELLED');
        closeModal('appointmentModal');
        showToast('Appointment cancelled successfully');
        window.calendarInstance.refetchEvents();
    } catch (err) {
        console.error('Failed to cancel appointment:', err);
        showToast('Failed to communicate with the server.', 'error');
    }
};

document.getElementById('appointmentEditBtn').onclick = enableAppointmentEdit;
document.getElementById('newAppointmentBtn').onclick = () => {
    closePopup();
    openNewAppointmentModal();
};

window.onload = async () => {
    await loadUsersForSelects();
    await initializeCalendar();
};
