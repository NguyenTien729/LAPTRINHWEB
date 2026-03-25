const API_BASE = 'http://localhost:3000';


class ReceptionistApp {
    constructor() {
        this.apiBase = API_BASE;

        window.onclick = (e) => {
            ['memberModal', 'trainerModal', 'qrModal'].forEach(id => {
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
    _fmtMoney(v){ return Number(v).toLocaleString('vi-VN') + ' VNĐ'; }

    // ── Profile ─────────────────────────────────────────────

    async loadProfile(staffId) {
        const data = await this._req(`/api/staffs/${staffId}`);
        this._set('profileUsername', data.username);
        this._set('profileContact',  data.contact);
        this._set('profileEmail',    data.email);
    }

    async saveProfile(staffId) {
        const data = {
            username: this._val('profileUsername'),
            contact:  this._val('profileContact'),
            email:    this._val('profileEmail')
        };
        const result = await this._req(`/api/staffs/${staffId}`, 'PUT', data);
        if (result.success) alert('Cập nhật thành công!');
        else alert('Lỗi: ' + result.message);
    }

    // ── Members ─────────────────────────────────────────────

    async loadMembers(tbodyId = 'memberTbody') {
        const members = await this._req('/api/members');
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        tbody.innerHTML = '';
        members.forEach(m => {
            tbody.innerHTML += `
            <tr>
                <td>${m.name}</td>
                <td>${m.memberid}</td>
                <td>${m.date_enrolled ?? ''}</td>
                <td>${m.date_expiry ?? ''}</td>
                <td><button class="btn-detail-pill"
                    onclick="app.openMemberModal('${m.memberid}','${m.name}','${m.dob}','${m.gender}','${m.contact}')">
                    Detail</button></td>
            </tr>`;
        });
    }

    openMemberModal(id, name, dob, gender, contact) {
        this._txt('modalMemberId', id);
        this._set('memberFullname', name);
        this._set('memberDob',      dob);
        this._set('memberGender',   gender);
        this._set('memberContact',  contact);
        this._show('memberModal');
    }

    closeMemberModal() { this._hide('memberModal'); }

    async deleteMember(memberId) {
        if (!confirm(`Xóa hội viên ${memberId}?`)) return;
        const result = await this._req(`/api/members/${memberId}`, 'DELETE');
        if (result.success) { this.closeMemberModal(); this.loadMembers(); }
    }

    // ── Trainer ─────────────────────────────────────────────

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

    // ── Payment ─────────────────────────────────────────────

    async loadPayments(tbodyId = 'paymentTbody') {
        const payments = await this._req('/api/payments');
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        tbody.innerHTML = '';
        payments.forEach(p => {
            tbody.innerHTML += `
            <tr>
                <td>${p.name}</td>
                <td>${p.memberid}</td>
                <td>${p.package}</td>
                <td>${p.date_paid}</td>
                <td>${p.payment_type}</td>
            </tr>`;
        });
    }

    async savePayment() {
        const data = {
            memberName:  this._val('paymentMember'),
            packageId:   this._val('packageSelect'),
            date:        this._val('paymentDate'),
            paymentType: this._val('paymentMethod')
        };
        if(!data.memberName||!data.date||!data.paymentType||!data.packageId){
            alert("Vui lòng nhập đầy đủ thông tin");
            return;
        }

        const result = await this._req('/api/payments', 'POST', data);
        if (result.success) { alert('Lưu thành công!'); this.loadPayments(); }
        else alert('Lỗi: ' + result.message);
    }

    onPackageChange(selectEl, priceInputId) {
        const el = document.getElementById(priceInputId);
        if (el) el.value = selectEl.value ? this._fmtMoney(selectEl.value) : '';
    }

    showQR() { this._show('qrModal'); }
    hideQR() { this._hide('qrModal'); }

    // ── Package (chỉ xem, không sửa) ────────────────────────

    async loadPackages(tbodyId = 'packageTbody') {
        const packages = await this._req('/api/packages');
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        tbody.innerHTML = '';
        packages.forEach(p => {
            tbody.innerHTML += `
            <tr>
                <td>${p.name}</td>
                <td>${p.validity}</td>
                <td>${Number(p.price).toLocaleString('vi-VN')}</td>
                <td><button class="btn-edit-small"
                    onclick="app.openPackageModal('${p.packageId}','${p.name}','${p.validity}','${p.price}')">Edit</button></td>
            </tr>`;
        });
    }

    // ── Registration ─────────────────────────────────────────

    async registerMember() {
        const data = {
            name:    this._val('regName'),
            email:   this._val('regEmail'),
            contact: this._val('regContact'),
            plan:    this._val('regPlan'),
            date:    this._val('regDate')
        };
        const result = await this._req('/api/members', 'POST', data);
        if (result.success) alert('Đăng ký thành công!');
        else alert('Lỗi: ' + result.message);
    }
}

