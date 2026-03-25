const API_BASE = 'http://localhost:3000';

class ManagerApp {
    constructor() {
        this.apiBase = API_BASE;
        this.isEditMode = false;
        this._currentPackageId = null;

        window.onclick = (e) => {
            ['memberModal','trainerModal','editModal','qrModal'].forEach(id => {
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

    async updateMember() {
        const memberId = document.getElementById('modalMemberId').innerText;
        const data = {
            name:    this._val('memberFullname'),
            dob:     this._val('memberDob'),
            gender:  this._val('memberGender'),
            contact: this._val('memberContact')
        };

        if (!data.name || !data.contact) {
            alert("Không để trống tên/sđt");
            return;
        }
        try {
            const res = await this._req(`/api/members/${memberId}`, 'PUT', data);
            if (res.success) {
                alert("Cập nhật thành công");
                this._hide('memberModal');
                this.loadMembers('memberTbody');
            }
        } catch (err) {
            alert("Lỗi: " + err.message);
        }
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
                <td>${t.specialty}</td>
                <td><button class="btn-detail-small"
                    onclick="app.openTrainerModal('${t.staffid}','${t.name}','${t.dob}','${t.gender}','${t.contact}','${t.specialty}')">
                    Edit</button></td>
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


    async loadDashboard() {
        const [members, trainers] = await Promise.all([
            this._req('/api/members'),
            this._req('/api/trainers')
        ]);

        const tbody = document.getElementById('dashMemberTbody');
        if (tbody) {
            tbody.innerHTML = '';
            members.forEach(m => {
                tbody.innerHTML += `
                <tr>
                    <td><div class="sm-avatar"></div></td>
                    <td>${m.name}</td>
                    <td>${m.date_enrolled ?? ''}</td>
                    <td>${m.date_expiry ?? ''}</td>
                    <td><span class="status-active">Active</span></td>
                </tr>`;
            });
        }

        const trainerList = document.getElementById('dashTrainerList');
        if (trainerList) {
            trainerList.innerHTML = '';
            trainers.forEach(t => {
                trainerList.innerHTML += `<div class="list-item"><span class="dot"></span> ${t.name}</div>`;
            });
        }
    }



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




    showQR() { this._show('qrModal'); }
    hideQR() { this._hide('qrModal'); }

    // ── Package ─────────────────────────────────────────────

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
                    onclick="app.openPackageModal('${p.packageid}','${p.name}','${p.validity}','${p.price}')">✏️</button></td>
            </tr>`;
        });
    }

    openPackageModal(id, name, validity, amount) {
        this.isEditMode = !!id;
        this._currentPackageId = id;
        this._txt('displayPackageName', name);
        this._set('editPlanName', name);
        this._set('editValidity', validity);
        this._set('editAmount',   amount);
        this._show('editModal');
    }

    closePackageModal() { this._hide('editModal'); }

    async savePackage() {
        const data = {
            name:     this._val('editPlanName'),
            validity: this._val('editValidity'),
            price:    this._val('editAmount')
        };
        const url    = this.isEditMode ? `/api/packages/${this._currentPackageId}` : '/api/packages';
        const method = this.isEditMode ? 'PUT' : 'POST';
        const result = await this._req(url, method, data);
        if (result.success) { this.closePackageModal(); this.loadPackages(); }
        else alert('Lỗi: ' + result.message);
    }

    async deletePackage() {
        if (!confirm('Xóa gói tập này?')) return;
        const result = await this._req(`/api/packages/${this._currentPackageId}`, 'DELETE');
        if (result.success) { this.closePackageModal(); this.loadPackages(); }
    }

    //Registration

    async registerMember() {
        const data = {
            name: this._val('regName'),
            dob: this._val('regDob'),
            email: this._val('regEmail'),
            gender: this._val('regGender'),
            contact: this._val('regContact')
        };
        if(!data.name||!data.contact){
            alert("vui lòng nhập tên và số điện thoại");
            return;
        }

        const result = await this._req('/api/members', 'POST', data);
        if (result.success) {
            alert(result.message);
            window.location.href('ma-payment.html');
        }
        else alert('Lỗi: ' + result.message);
    }


    async iniPayment() {
        const [packages, schedules] = await Promise.all([
            this._req('/api/packages'),
            this._req('/api/schedules-detail')
        ]);

        // Đổ gói tập
        const pkgSelect = document.getElementById('packageSelect');
        this._pkgs = packages; // Lưu tạm để lấy giá
        packages.forEach(p => pkgSelect.innerHTML += `<option value="${p.packageid}">${p.name}</option>`);

        // Đổ lịch tập
        const schSelect = document.getElementById('scheduleSelect');
        this._schs = schedules; // Lưu tạm để lấy giờ/thứ
        schedules.forEach(s => {
            schSelect.innerHTML += `<option value="${s.MaLich}">${s.TenNV} - ${s.MaLich}</option>`;
        });
    }
    // 2. Xử lý khi chọn gói tập -> Hiển thị giá
    onPackageChange(el) {
        const pkg = this._pkgs.find(p => p.packageid === el.value);
        document.getElementById('priceInput').value = pkg ? pkg.price : '';
    }

    // 3. Xử lý khi chọn lịch -> Hiển thị Giờ & Thứ (Readonly)
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

    // 4. Lưu tổng hợp
    async savePayment() {
        const startDateVal = this._val('paymentDate'); // Lấy chuỗi yyyy-mm-dd
        const packageId = this._val('packageSelect');
        // KIỂM TRA 2: Tìm gói tập để lấy số ngày (validity)
        const selectedPkg = this._pkgs.find(p => p.packageid === packageId);
        if (!selectedPkg) {
            alert("Vui lòng chọn Gói tập!");
            return;
        }

        // 3. Tính toán Ngày kết thúc (edate)
        const sDate = new Date(startDateVal);

        // Kiểm tra nếu đối tượng Date không hợp lệ
        if (isNaN(sDate.getTime())) {
            alert("Định dạng ngày bắt đầu không hợp lệ!");
            return;
        }

        const validityDays = parseInt(selectedPkg.validity);
        const eDateObj = new Date(sDate);
        eDateObj.setDate(sDate.getDate() + validityDays);

        // Chuyển về định dạng yyyy-mm-dd
        const edate = eDateObj.toISOString().split('T')[0];

        console.log("Sdate:", startDateVal); // Kiểm tra log ở Console
        console.log("Edate:", edate);

        const data = {
            memberName:  this._val('paymentMember'),
            packageId:   packageId,
            maLich:      this._val('scheduleSelect'),
            amount:      this._val('priceInput'),
            sdate:       startDateVal, // Gửi ngày bắt đầu
            edate:       edate,        // Gửi ngày kết thúc
            paymentType: this._val('paymentMethod')
        };

        const res = await this._req('/api/payments-full', 'POST', data);
        if (res.success) {
            alert(res.message);
            this.loadPayments('paymentTbody');
        }
    }

    // ── Report ───────────────────────────────────────────────
    async loadReport() {
        const fromDate = document.getElementById('reportFrom').value;
        const toDate = document.getElementById('reportTo').value;

        // Validate
        if (!fromDate || !toDate) {
            alert("chọn t.g");
            return;
        }
        if (new Date(fromDate) > new Date(toDate)) {
            alert("ngày trc > ngày sau");
            return;
        }
        try {
            await this.loadRevenueTotal(fromDate, toDate);
        } catch (error) {
            alert("lỗi doanh thu");
        }
    }

    // ==================== API: TÍNH TỔNG DOANH THU ====================
    async loadRevenueTotal(fromDate, toDate) {
        try {
            const url = `${this.apiBase}/api/revenue/total?from=${fromDate}&to=${toDate}`;
            console.log("🔗 Calling API:", url);

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                const totalRevenue = result.data.totalRevenue || 0;
                const totalTransactions = result.data.totalTransactions || 0;
                document.getElementById('reportTotal').textContent =
                    totalRevenue.toLocaleString('vi-VN') + ' VNĐ';

            } else {
                document.getElementById('reportTotal').textContent = '0 VNĐ';
                alert(result.message || "lỗi tính doanh thu");
            }
        } catch (error) {
            document.getElementById('reportTotal').textContent = 'Lỗi';
            alert("lỗi to");
        }
    }

    // ==================== TIỆN ÍCH: SET NGÀY MẶC ĐỊNH ====================
    setDefaultDates() {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        document.getElementById('reportFrom').value = formatDate(firstDayOfMonth);
        document.getElementById('reportTo').value = formatDate(today);

    }
}

// =============================================================
//  TRAINER APP (CV02) - Huấn luyện viên
//  Trang: trainer-profile, trainer-schedule, trainer-trainer
// =============================================================
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

    // ── Profile ─────────────────────────────────────────────



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
        if (result.success) alert('Cập nhật thành công!');
        else alert('Lỗi: ' + result.message);
    }

    // ── Schedule ─────────────────────────────────────────────

    async loadSchedule(trainerId, tbodyId = 'scheduleTbody') {
        const members = await this._req(`/api/schedule/${trainerId}`);
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        tbody.innerHTML = '';
        members.forEach((m, i) => {
            const scheduleType = m.schedule_type ?? String((i % 2) + 1);
            tbody.innerHTML += `
            <tr data-schedule="${scheduleType}">
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

    filterSchedule(type) {
        document.querySelectorAll('#memberTable tbody tr').forEach(row => {
            const t = row.getAttribute('data-schedule');
            row.style.display = (type === 'all' || t === type) ? '' : 'none';
        });
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



