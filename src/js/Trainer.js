const API_BASE = 'http://localhost:3000';



class TrainerApp {
    constructor() {
        this.apiBase = API_BASE;
        window.onclick = (e) => {
            ['memberDetailModal', 'trainerModal'].forEach(id => {
                const el = document.getElementById(id);
                if (el && e.target === el) this._hide(id);
            });
        };
    }

    // ── Tiện ích ────────────────────────────────────────────

    async _req(endpoint, method = 'GET', body = null) {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(`${this.apiBase}${endpoint}`, opts);
        if (!res.ok) throw new Error(`Lỗi ${res.status}`);
        return res.json();
    }

    _show(id)  { const el = document.getElementById(id); if (el) el.style.display = 'block'; }
    _hide(id)  { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    _val(id)   { const el = document.getElementById(id); return el ? el.value : ''; }
    _set(id, v){ const el = document.getElementById(id); if (el) el.value = v ?? ''; }
    _txt(id, v){ const el = document.getElementById(id); if (el) el.textContent = v ?? ''; }

    //Profile
    async loadProfile(staffId) {
        try{
            const data = await this._req(`/api/staffs/${staffId}`);
            this._txt('displayMasv', data.staffId);
            this._txt('displayUsername', data.username);
            this._txt('displayName', data.name);
            this._txt('displayContact', data.contact);
            this._txt('displayEmail', data.email);
            this._txt('displayDob', data.dob);
            this._txt('displayGender', data.gender);
            this._set('profileUsername', data.username);
            this._set('profileName',     data.name);
            this._set('profileContact',  data.contact);
            this._set('profileEmail',    data.email);
            this._set('profileDob',      data.dob);
        }catch (err){
            alert("lỗi")
        }

    }

    async saveProfile(staffId) {
        const data = {
            username: this._val('profileUsername'),
            name: this._val('profileName'),
            contact:  this._val('profileContact'),
            email: this._val('profileEmail'),
            dob: this._val('profileDob'),
            pass: this._val('profilePassword')
        };
        const result = await this._req(`/api/staffs/${staffId}`, 'PUT', data);
        if (result.success) alert('Cập nhật thành công');
        else alert('Lỗi: ' + result.message);
    }
    //khởi tạo schedule
    async initSchedulePage(trainerId) {
        try {
            const schedules = await this._req(`/api/trainer/schedules/${trainerId}`);
            const select = document.getElementById('scheduleSelect');
            select.innerHTML = '<option value="all">Tất cả hội viên đang dạy</option>';
            schedules.forEach(s => {
                select.innerHTML += `
                <option value="${s.MaLich}">
                    Ca ${s.MaLich}: ${s.GioBatDau}-${s.GioKetThuc} (Thứ: ${s.ThuTrongTuan})
                </option>`;
            });
            this.loadMembersBySchedule(trainerId, 'all');
        } catch (err) {
            console.error("Lỗi khởi tạo:", err);
        }
    }

    async loadMembersBySchedule(trainerId, maLich) {
        try {
            const members = await this._req(`/api/trainer/members?trainerId=${trainerId}&maLich=${maLich}`);
            const tbody = document.querySelector('#memberTable tbody');
            tbody.innerHTML = '';

            members.forEach(m => {
                tbody.innerHTML += `
            <tr>
                <td>${m.name}</td>
                <td>${m.memberid}</td>
                <td>${m.date_enrolled}</td>
                <td>${m.date_expiry}</td>
                <td>
                    <button class="btn-detail-pill" 
                        onclick="app.openMemberModal('${m.memberid}','${m.name}','${m.dob}','${m.gender}','${m.contact}')">
                        Detail
                    </button>
                </td>
            </tr>`;
            });
        } catch (err) {
            alert("Lỗi tải danh sách hội viên");
        }
    }

    openMemberModal(id, name, dob, gender, contact) {
        this._txt('displayMemberId', id);
        this._set('detailName',    name);
        this._set('detailDob',     dob);
        this._set('detailGender',  gender);
        this._set('detailContact', contact);
        this._show('memberDetailModal');
    }

    closeMemberModal() { this._hide('memberDetailModal'); }

    // ── Trainer (xem đồng nghiệp) ───────────────────────────

    async loadTrainers(tbodyId = 'trainerTbody') {
        const trainers = await this._req('/api/trainers');
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        tbody.innerHTML = '';
        trainers.forEach(t => {
            tbody.innerHTML += `
            <tr>
                <td>${t.name}</td>
                <td>${t.staffid}</td>
                <td>${t.contact}</td>
                <td>${t.specialty ?? 'N/A'}</td>
                <td><button class="btn-detail-small"
                    onclick="app.openTrainerModal('${t.staffid}','${t.name}','${t.dob}','${t.gender}','${t.contact}','${t.specialty}')">
                    Detail</button></td>
            </tr>`;
        });
    }

    openTrainerModal(id, name, dob, gender, contact, specialty) {
        this._txt('modalTrainerId', id);
        this._set('modalName',      name);
        this._set('modalDob',       dob);
        this._set('modalGender',    gender);
        this._set('modalContact',   contact);
        this._set('modalSpecialty', specialty);
        this._show('trainerModal');
    }

    closeTrainerModal() { this._hide('trainerModal'); }
}



