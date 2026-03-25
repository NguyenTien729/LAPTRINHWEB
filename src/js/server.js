const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

//MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // Thay bằng user MySQL của bạn
    password: 'max1236987',      // Thay bằng password MySQL của bạn
    database: 'gymmanagement'   // Tên database của bạn
});

db.connect(err => {
    if (err) {
        console.error('Lỗi kết nối DB: ' + err.stack);
        return;
    }
    console.log('Đã kết nối MySQL.');
});

//API Đăng nhập
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const query = `
        SELECT USER.*, NHANVIEN.MaCV,NHANVIEN.TenNV,NHANVIEN.Email 
        FROM USER 
        JOIN NHANVIEN ON USER.MaNV = NHANVIEN.MaNV 
        WHERE USER.username = ? AND USER.password = ?`;

    db.query(query, [username, password], (err, results) => {
        if (err) return res.status(500).send(err);
        if (results.length > 0) {
            res.json({
                success: true,
                role: results[0].MaCV,
                name: results[0].TenNV,
                email: results[0].Email,
                message: "Đăng nhập thành công"
            });
        } else {
            res.json({ success: false, message: "Sai tài khoản hoặc mật khẩu"});
        }
    });
});

//API THÊM NHÂN VIÊN MỚI
app.post('/api/staffs', (req, res) => {
    const { staffId, name, dob, gender, contact, email, role_id } = req.body;

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ success: false, message: err });

        // Thêm vào bảng NHANVIEN
        const sqlNV = "INSERT INTO NHANVIEN (MaNV, TenNV, NgaySinh, GioiTinh, SDT, Email, MaCV, HeSoLuong) VALUES (?, ?, ?, ?, ?, ?, ?, 1.0)";
        db.query(sqlNV, [staffId, name, dob, gender, contact, email, role_id], (err) => {
            if (err) return db.rollback(() => res.status(500).json({ success: false, message: "Mã NV đã tồn tại hoặc lỗi dữ liệu" }));

            // Tạo tài khoản USER mặc định (User = Mã NV, Pass = 123, Status = Active)
            const sqlU = "INSERT INTO USER (MaNV, UserName, Password, Status) VALUES (?, ?, ?, 'Active')";
            db.query(sqlU, [staffId, staffId, '123'], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false, message: "Lỗi tạo tài khoản" }));

                db.commit(err => {
                    if (err) return db.rollback(() => res.status(500).json({ success: false }));
                    res.json({ success: true, message: "Thêm nhân viên thành công!" });
                });
            });
        });
    });
});

//API XÓA NHÂN VIÊN
app.delete('/api/staffs/:id', (req, res) => {
    const staffId = req.params.id;
    // Do có ràng buộc khóa ngoại, ta xóa USER trước, NHANVIEN sau (hoặc dùng Transaction)
    const sqlDelUser = "DELETE FROM USER WHERE MaNV = ?";
    db.query(sqlDelUser, [staffId], (err) => {
        if (err) return res.status(500).json({ success: false });

        const sqlDelNV = "DELETE FROM NHANVIEN WHERE MaNV = ?";
        db.query(sqlDelNV, [staffId], (err) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true, message: "Đã xóa nhân viên" });
        });
    });
});

//API lấy thông tin nhân viên
app.get('/api/staffs', (req, res) => {
    const sql = `
        SELECT 
            nv.MaNV as staffId, 
            nv.TenNV as name, 
            u.UserName as username, 
            u.Password as pass, 
            u.Status as status, 
            nv.NgaySinh as dob, 
            nv.GioiTinh as gender, 
            nv.SDT as contact, 
            nv.Email as email, 
            nv.MaCV as role_id,
            cv.TenChucVu as role_name, 
            (cv.Luong * nv.HeSoLuong) as salary_num
        FROM NHANVIEN nv
        LEFT JOIN USER u ON nv.MaNV = u.MaNV
        LEFT JOIN CHUCVU cv ON nv.MaCV = cv.MaCV
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// API Cập nhật nhân viên
app.put('/api/staffs/:id', (req, res) => {
    const staffId = req.params.id;
    const { name, username, password, dob, gender, contact, email, role, status } = req.body;


    db.beginTransaction((err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });

        //Cập nhật NHANVIEN
        const sqlNV = `
            UPDATE NHANVIEN 
            SET TenNV = ?, NgaySinh = ?, GioiTinh = ?, SDT = ?, Email = ?, MaCV = ? 
            WHERE MaNV = ?`;

        db.query(sqlNV, [name, dob, gender, contact, email, role, staffId], (err, result) => {
            if (err) {
                return db.rollback(() => {
                    res.status(500).json({ success: false, message: "Lỗi cập nhật nhân viên" });
                });
            }

            // Cập nhật USER
            const sqlU = `
                UPDATE USER 
                SET UserName = ?, Password = ?, Status = ? 
                WHERE MaNV = ?`;

            db.query(sqlU, [username, password, status, staffId], (err, result) => {
                if (err) {
                    return db.rollback(() => {
                        res.status(500).json({ success: false, message: "Lỗi cập nhật tài khoản" });
                    });
                }

                db.commit((err) => {
                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({ success: false, message: "Lỗi Commit" });
                        });
                    }
                    res.json({ success: true, message: "Cập nhật thành công" });
                });
            });
        });
    });
});

//API lấy thông tin member
app.get('/api/members', (req, res) => {
    const sql = `
        SELECT
            hv.MaHV as memberid,
            hv.TenHV as name,
            hv.NgaySinh as dob,
            hv.GioiTinh as gender,
            hv.SDT as contact,
            dk.NgayBatDau as date_enrolled,
            dk.NgayKetThuc as date_expiry
        FROM HOIVIEN hv
        LEFT JOIN DANGKYTAP dk ON hv.MaHV = dk.MaHV
    `;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

//API lấy thông tin huấn luyện viên
app.get('/api/trainers', (req, res) => {
    const sql = `
        SELECT
            nv.MaNV as staffid,
            nv.TenNV as name,
            nv.SDT as contact,
            nv.NgaySinh as dob,
            nv.GioiTinh as gender,
            hlv.ChuyenMon as specialty
        FROM NHANVIEN nv
        INNER JOIN HUANLUYENVIEN hlv ON nv.MaNV = hlv.MaNV
    `;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});



//API tính doanh thu trong khoảng
app.get('/api/revenue/total', (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) {
        return res.status(400).json({
            success: false,
            message: "Vui lòng chọn from và to date"
        });
    }

    const sql = `
        SELECT
            SUM(tt.SoTien) as totalRevenue,
            COUNT(*) as totalTransactions
        FROM THANHTOAN tt
        WHERE tt.NgayTT >= ?
          AND tt.NgayTT < DATE_ADD(?, INTERVAL 1 DAY)
          AND tt.TrangThai = 'Đã thanh toán'
    `;

    db.query(sql, [from, to], (err, result) => {
        if (err) {
            console.error("Lỗi tính tổng doanh thu:", err);
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        res.json({
            success: true,
            data: {
                totalRevenue: result[0].totalRevenue || 0,
                totalTransactions: result[0].totalTransactions || 0,
                fromDate: from,
                toDate: to
            }
        });
    });
});

// API lấy danh sách thanh toán
app.get('/api/payments', (req, res) => {
    const sql = `
        SELECT
            hv.TenHV as name,
            hv.MaHV as memberid,
            gt.TenGoi as package,
            tt.NgayTT as date_paid,
            tt.SoTien as amount,
            tt.HinhThucTT as payment_type,
            tt.TrangThai as status
        FROM THANHTOAN tt
        JOIN DANGKYTAP dk ON tt.MaDK = dk.MaDK
        JOIN HOIVIEN hv ON dk.MaHV = hv.MaHV
        JOIN GOITAP gt ON dk.MaGoi = gt.MaGoi
        ORDER BY tt.NgayTT DESC
    `;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json({err});
        res.json(result);
    });
});


// API thêm thanh toán
app.post('/api/payments', (req, res) => {
    const { memberName, packageId, date, paymentType } = req.body;
    // 1. Tìm MaHV từ tên hội viên
    const sqlFindMember = "SELECT MaHV FROM HOIVIEN WHERE TenHV = ? LIMIT 1";
    db.query(sqlFindMember, [memberName], (err, members) => {
        if (err || members.length === 0)
            return res.status(400).json({ success: false, message: "Không tìm thấy hội viên" });
        const maHV = members[0].MaHV;

        // 2. Tìm MaDK của hội viên (lấy bản đăng ký mới nhất)
        const sqlFindDK = "SELECT MaDK FROM DANGKYTAP WHERE MaHV = ? ORDER BY NgayBatDau DESC LIMIT 1";
        db.query(sqlFindDK, [maHV], (err, dks) => {
            if (err || dks.length === 0)
                return res.status(400).json({ success: false, message: "Hội viên chưa có đăng ký tập" });

            const maDK = dks[0].MaDK;

            // 3. Tạo mã thanh toán tự động
            const maTT = 'TT' + Date.now();

            // 4. Thêm vào bảng THANHTOAN
            const sqlInsert = `
                INSERT INTO THANHTOAN (MaTT, MaDK, NgayTT, SoTien, HinhThucTT, TrangThai)
                VALUES (?, ?, ?, (SELECT GiaTien FROM GOITAP WHERE MaGoi = ?), ?, 'Đã Thanh Toán')
            `;
            db.query(sqlInsert, [maTT, maDK, date, packageId, paymentType || 'Tiền mặt'], (err) => {
                if (err) return res.status(500).json({ success: false, message: err.message });
                res.json({ success: true, message: "Lưu thanh toán thành công!" });
            });
        });
    });
});





//API gói tập
app.get('/api/packages', (req, res) => {
    const sql = "SELECT MaGoi as packageid, TenGoi as name, ThoiHan as validity, GiaTien as price FROM GOITAP";
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});


// API lấy danh sách packages
app.post('/api/packages', (req, res) => {
    const { name, validity, price } = req.body;
    const maGoi = 'GT' + Date.now();
    const sql = "INSERT INTO GOITAP (MaGoi, TenGoi, ThoiHan, GiaTien) VALUES (?, ?, ?, ?)";
    db.query(sql, [maGoi, name, validity, price], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: "Thêm gói tập thành công!" });
    });
});

//API cập nhật package
app.put('/api/packages/:id', (req, res) => {
    const { name, validity, price } = req.body;
    const sql = "UPDATE GOITAP SET TenGoi = ?, ThoiHan = ?, GiaTien = ? WHERE MaGoi = ?";
    db.query(sql, [name, validity, price, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: "Cập nhật gói tập thành công!" });
    });
});
//API xóa package
app.delete('/api/packages/:id', (req, res) => {
    const sql = "DELETE FROM GOITAP WHERE MaGoi = ?";
    db.query(sql, [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: "Đã xóa gói tập" });
    });
});



app.listen(3000, () => {
    console.log('Server đang chạy tại http://localhost:3000');
});