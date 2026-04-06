const API_BASE = 'http://localhost:3000';

function authFetch(url, options = {}) {
    const token = localStorage.getItem('token');

    if (!token) {
        alert("Phiên đăng nhập hết hạn, vui lòng đăng nhập lại!");
        window.location.href = 'login.html';
        return Promise.reject("No token");
    }

    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {})
        }
    }).then(res => {
        if (res.status === 401 || res.status === 403) {
            localStorage.clear();
            window.location.href = 'login.html';
        }
        return res;
    });
}


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

    //hàm

    async _req(endpoint, method = 'GET', body = null) {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const res = await authFetch(`${this.apiBase}${endpoint}`, opts);
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

    async searchMembers(keyword) {
        if (!keyword || !keyword.trim()) {
            return this.loadMembers('memberTbody');
        }
        try {
            const res = await authFetch(`${this.apiBase}/api/members/search?keyword=${encodeURIComponent(keyword)}`);
            const data = await res.json();
            const tbody = document.getElementById('memberTbody');
            if (tbody) {
                tbody.innerHTML = '';
                data.forEach(m => {
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
        } catch (error) {
            console.error("lỗi:", error);
            alert("Lỗi");
        }
    }

    //Trainer

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

    //Payment

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
            paymentType: 'Tiền mặt'
        };
        const result = await this._req('/api/payments', 'POST', data);
        if (result.success) { alert('Lưu thành công!'); this.loadPayments(); }
        else alert('Lỗi: ' + result.message);
    }

    async iniPayment() {
        const [packages, schedules] = await Promise.all([
            this._req('/api/packages'),
            this._req('/api/schedules-detail')
        ]);

        const pkgSelect = document.getElementById('packageSelect');
        this._pkgs = packages; // Lưu tạm để lấy giá
        packages.forEach(p => pkgSelect.innerHTML += `<option value="${p.packageid}">${p.name}</option>`);

        const schSelect = document.getElementById('scheduleSelect');
        this._schs = schedules;
        schedules.forEach(s => {
            schSelect.innerHTML += `<option value="${s.MaLich}">${s.TenNV} - ${s.MaLich}</option>`;
        });
    }
    onPackageChange(el) {
        const pkg = this._pkgs.find(p => p.packageid === el.value);
        document.getElementById('priceInput').value = pkg ? pkg.price : '';
    }

    onScheduleChange(el) {
        const sch = this._schs.find(s => s.MaLich === el.value);
        if (sch) {
            document.getElementById('timeDisplay').value = `${sch.GioBatDau} - ${sch.GioKetThuc}`;
            document.getElementById('daysDisplay').value = `Thứ: ${sch.CácThứ}`;
        } else {
            document.getElementById('timeDisplay').value = '';
            document.getElementById('daysDisplay').value = '';
        }
    }

    onPackageChange(selectEl, priceInputId) {
        const el = document.getElementById(priceInputId);
        if (el) el.value = selectEl.value ? this._fmtMoney(selectEl.value) : '';
    }

    showQR() { this._show('qrModal'); }
    hideQR() { this._hide('qrModal'); }

    //Package

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
            </tr>`;
        });
    }

    async searchPayment(keyword) {
        if (!keyword || !keyword.trim()) {
            return this.loadPayments('paymentTbody');
        }
        try {
            const res = await authFetch(`${this.apiBase}/api/payments/search?keyword=${encodeURIComponent(keyword)}`);
            const data = await res.json();
            const tbody = document.getElementById('paymentTbody');
            if (tbody) {
                tbody.innerHTML = '';
                data.forEach(p => {
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
        } catch (error) {
            console.error("lỗi", error);
            alert("Lỗi");
        }
    }

    //Registration

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

