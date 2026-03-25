const API_BASE = 'http://localhost:3000';



class Admin {
    constructor() {
        this.apiBase = API_BASE;
        this.isEditMode = false;

        window.onclick = (event) => {
            const modal = document.getElementById('staffModal');
            if (event.target === modal) this.closeModal();
        };
    }

    // ==================== API ====================

    async fetchAll() {
        const response = await fetch(`${this.apiBase}/api/staffs`);
        if (!response.ok) throw new Error('Không thể lấy dữ liệu từ server');
        return await response.json();
    }

    async save(data) {
        const url = this.isEditMode ? `${this.apiBase}/api/staffs/${data.staffId}` : `${this.apiBase}/api/staffs`;
        const method = this.isEditMode ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    }

    async delete(id) {
        const response = await fetch(`${this.apiBase}/api/staffs/${id}`, { method: 'DELETE' });
        return await response.json();
    }

    // ==================== UI ====================

    async renderStaffGrid() {
        const staffGrid = document.getElementById('staff-grid');
        try {
            const staffs = await this.fetchAll();
            staffGrid.innerHTML = '';
            staffs.forEach(s => staffGrid.innerHTML += this._buildStaffCard(s));
        } catch (error) {
            console.error('Lỗi:', error);
            staffGrid.innerHTML = `<p style="color:red">Lỗi: ${error.message}. Đảm bảo Backend đã chạy.</p>`;
        }
    }

    _buildStaffCard(s) {
        const statusClass = s.status === 'Active' ? 'status-active' : 'status-suspended';
        return `
                <div class="card staff-card">
                    <div class="avatar-circle">👤</div>
                    <h3>${s.name} <span class="badge ${statusClass}">${s.status}</span></h3>
                    <div class="staff-info-list">
                        <p>Staff ID: <span>${s.staffId}</span></p>
                        <p>Role: <span>${s.role_name}</span></p>
                        <p>Contact: <span>${s.contact}</span></p>
                    </div>
                    <button class="btn-edit-yellow"
                        onclick="admin.openEditModal('${s.staffId}','${s.name}','${s.username}','${s.pass}','${s.dob}','${s.gender}','${s.contact}','${s.email}','${s.role_id}','${s.status}')">
                        Edit
                    </button>
                </div>`;
    }

    // ==================== MODAL ====================

    openAddModal() {
        this.isEditMode = false;
        document.getElementById('modalStaffId').innerText = 'New Staff';
        document.getElementById('editStaffIdDisplay').readOnly = false;
        this._fillModal('', '', '', '', '', '', '', '', 'CV03', 'Active');
        document.getElementById('staffModal').style.display = 'block';
    }

    openEditModal(id, name, user, pass, dob, gender, contact, email, roleId, status) {
        this.isEditMode = true;
        document.getElementById('modalStaffId').innerText = id;
        document.getElementById('editStaffIdDisplay').readOnly = true;
        this._fillModal(id, name, user, pass, dob, gender, contact, email, roleId, status);
        document.getElementById('staffModal').style.display = 'block';
    }

    _fillModal(id, name, user, pass, dob, gender, contact, email, roleId, status) {
        document.getElementById('editStaffIdDisplay').value = id;
        document.getElementById('editStaffName').value = name;
        document.getElementById('editUsername').value = user;
        document.getElementById('editPassword').value = pass;
        document.getElementById('editGender').value = gender;
        document.getElementById('editContact').value = contact;
        document.getElementById('editEmail').value = email;
        document.getElementById('editRole').value = roleId;
        document.getElementById('editStatus').value = status;
        document.getElementById('editDob').value =
            (dob && dob !== 'null') ? new Date(dob).toISOString().split('T')[0] : '';
    }

    closeModal() {
        document.getElementById('staffModal').style.display = 'none';
    }

    // ==================== ACTIONS ====================

    async handleSubmit() {
        const staffId = document.getElementById('editStaffIdDisplay').value;
        const data = {
            staffId,
            name:     document.getElementById('editStaffName').value,
            username: document.getElementById('editUsername').value,
            password: document.getElementById('editPassword').value,
            dob:      document.getElementById('editDob').value,
            gender:   document.getElementById('editGender').value,
            contact:  document.getElementById('editContact').value,
            email:    document.getElementById('editEmail').value,
            role:     document.getElementById('editRole').value,
            status:   document.getElementById('editStatus').value
        };

        const result = await this.save(data);
        if (result.success) {
            alert(result.message);
            this.closeModal();
            this.renderStaffGrid();
        } else {
            alert('Lỗi: ' + result.message);
        }
    }

    async handleDelete(id) {
        if (confirm(`Xóa nhân viên ${id}?`)) {
            const result = await this.delete(id);
            if (result.success) this.renderStaffGrid();
        }
    }
}
