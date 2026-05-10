const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {decode} = require("jsonwebtoken");
const JWT_SECRET = "max1236987";

const crypto = require('crypto');
const qs = require('qs');

const vnp_TmnCode = "L78Z5RJL";
const vnp_HashSecret = "H6WDRGINYRU2494CWFBN3WR0BBZ6GU2L";
const vnp_Url = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
const vnp_ReturnUrl = "http://localhost:3000/api/vnpay-return";


function verifyToken(req,res,next){
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if(!token){
        return res.status(401).json({success: false,message: "Khong co token"});
    }
    jwt.verify(token,JWT_SECRET,(err,decode) => {
        if(err) {
            return res.status(403).json({success: false, message: "Token het han"});
        }
        req.user = decode;
        next();
    });
}

function sortObject(obj) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) {
            str.push(encodeURIComponent(key));
        }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
        sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
}


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

//API đăng nhập
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const query = `
        SELECT USER.*, NHANVIEN.MaCV, NHANVIEN.TenNV, NHANVIEN.Email
        FROM USER
                 JOIN NHANVIEN ON USER.MaNV = NHANVIEN.MaNV
        WHERE USER.username = ?`;

    db.query(query, [username], async (err, results) => {
        if (err) return res.status(500).send(err);

        if (results.length === 0) {
            return res.json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });
        }

        const user = results[0];


        if (user.Password.startsWith('$2b$')) {
            isMatch = await bcrypt.compare(password, user.Password);
        }
        // 👉 Nếu password còn plain text
        else {
            if (password === user.Password) {
                isMatch = true;

                const hashed = await bcrypt.hash(password, 10);
                db.query("UPDATE USER SET Password = ? WHERE UserID = ?", [hashed, user.UserID]);
            }
        }
        if (!isMatch) {
            return res.json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });
        }

        if (user.Status === 'Suspended') {
            return res.json({ success: false, message: "Tài khoản đã bị khóa, vui lòng liên hệ quản trị viên" });
        }

        const token = jwt.sign(
            {
                id: user.MaNV,
                role: user.MaCV
            },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.json({
            success: true,
            token,
            staffId: user.MaNV,
            role: user.MaCV,
            name: user.TenNV,
            email: user.Email
        });
    });
});

//API thêm nhân viên
app.post('/api/staffs', async (req, res) => {
    const { staffId, name, dob, gender, contact, email, role, username, password } = req.body;

    try {
        const userId = await generateNextId('USER', 'UserID', 'U');

        db.beginTransaction(err => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            const sqlNV = "INSERT INTO NHANVIEN (MaNV, TenNV, NgaySinh, GioiTinh, SDT, Email, MaCV, HeSoLuong) VALUES (?, ?, ?, ?, ?, ?, ?, 1.0)";
            db.query(sqlNV, [staffId, name, dob, gender, contact, email, role], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false, message: "Lỗi NHANVIEN: " + err.message }));
                const sqlU = "INSERT INTO USER (UserID, MaNV, UserName, Password, Status) VALUES (?, ?, ?, ?, 'Active')";
                db.query(sqlU, [userId, staffId, username, password], (err) => {
                    if (err) return db.rollback(() => res.status(500).json({ success: false, message: "Lỗi USER: " + err.message }));

                    db.commit(err => {
                        if (err) return db.rollback(() => res.status(500).json({ success: false }));
                        res.json({ success: true, message: "Thêm nhân viên thành success!" });
                    });
                });
            });
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi tạo ID: " + error.message });
    }
});

//API xóa nhân viên
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
            DATE_FORMAT(nv.NgaySinh,'%Y-%m-%d') as dob,
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

app.get('/api/staffs/:id', (req, res) => {
    const staffId = req.params.id;

    const sql = `
        SELECT
            nv.MaNV as staffId,
            nv.TenNV as name,
            u.UserName as username,
            u.Password as pass,
            u.Status as status,
            DATE_FORMAT(nv.NgaySinh, '%Y-%m-%d') as dob,
            nv.GioiTinh as gender,
            nv.SDT as contact,
            nv.Email as email,
            nv.MaCV as role_id,
            cv.TenChucVu as role_name,
            (cv.Luong * nv.HeSoLuong) as salary_num
        FROM NHANVIEN nv
                 LEFT JOIN USER u ON nv.MaNV = u.MaNV
                 LEFT JOIN CHUCVU cv ON nv.MaCV = cv.MaCV
        WHERE nv.MaNV = ?
    `;

    db.query(sql, [staffId], (err, results) => {
        if (err) {
            console.error("lỗi thông tin:", err);
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: "lỗi không nv" });
        }
        res.json(results[0]);
    });
});


// API Cập nhật nhân viên
app.put('/api/staffs/:id', async (req, res) => {
    const staffId = req.params.id;
    const { name, username, password, dob, gender, contact, email, role, status } = req.body;


    try{
        const hashPassword = await bcrypt.hash(password,10);

        db.beginTransaction((err) => {
            if (err) return res.status(500).json({success: false, message: err.message});
            //Cập nhật NHANVIEN
            const sqlNV = `
                UPDATE NHANVIEN
                SET TenNV = ?, NgaySinh = ?, GioiTinh = ?, SDT = ?, Email = ?, MaCV=?
                WHERE MaNV = ?`;

            db.query(sqlNV, [name, dob, gender, contact, email, role, staffId], (err, result) => {
                if (err) {
                    return db.rollback(() => {
                        res.status(500).json({success: false, message: "Lỗi cập nhật nhân viên"});
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
                            res.status(500).json({success: false, message: "Lỗi cập nhật tài khoản"});
                        });
                    }

                    db.commit((err) => {
                        if (err) {
                            return db.rollback(() => {
                                res.status(500).json({success: false, message: "Lỗi Commit"});
                            });
                        }
                        res.json({success: true, message: "Cập nhật thành công"});
                    });
                });
            });
        });
    }catch (error){
        res.status(500).json({succes: false, message: "loi hashmk"});
    }
});
//cập nhật profile
app.put('/api/staffs/:id/profile', (req, res) => {
    const staffId = req.params.id;
    const { username, name, contact, email, dob, pass } = req.body;

    db.beginTransaction((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        // 1. Cập nhật NHANVIEN
        const sqlNV = `
            UPDATE NHANVIEN
            SET TenNV = ?, NgaySinh = ?, SDT = ?, Email = ?
            WHERE MaNV = ?`;

        db.query(sqlNV, [name, dob, contact, email, staffId], (err, result) => {
            if (err) {
                return db.rollback(() => {
                    console.error("Lỗi NHANVIEN:", err);
                    res.status(500).json({ success: false, message: "Lỗi " });
                });
            }

            // 2. Cập nhật USER
            let sqlU = `UPDATE USER SET UserName = ?`;
            let params = [username];

            if (pass && pass.trim() !== '') {
                sqlU += `, Password = ?`;
                params.push(pass);
            }

            sqlU += ` WHERE MaNV = ?`;
            params.push(staffId);

            db.query(sqlU, params, (err, result) => {
                if (err) {
                    return db.rollback(() => {
                        console.error("Lỗi USER:", err);
                        res.status(500).json({ success: false, message: "Lỗi " });
                    });
                }

                db.commit((err) => {
                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({ success: false, message: "Lỗi Commit" });
                        });
                    }
                    console.log("✅ Profile update successful");
                    res.json({ success: true, message: "Cập nhật thành công" });
                });
            });
        });
    });
});

//API lấy thông tin hội viên sắp hết hạn
app.get('/api/dashboard/expiring-members', (req, res) => {
    const sql = `
        SELECT
            hv.MaHV as memberid,
            hv.TenHV as name,
            DATE_FORMAT(dk.NgayBatDau,'%Y-%m-%d') as date_enrolled,
            DATE_FORMAT(dk.NgayKetThuc,'%Y-%m-%d') as date_expiry
        FROM HOIVIEN hv
                 INNER JOIN DANGKYTAP dk ON hv.MaHV = dk.MaHV
        WHERE dk.NgayKetThuc >= CURDATE()
        ORDER BY dk.NgayKetThuc ASC
            LIMIT 5
    `;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

//API lấy thông tin member
app.get('/api/members', (req, res) => {
    const sql = `
        SELECT
            hv.MaHV as memberid,
            hv.TenHV as name,
            DATE_FORMAT( hv.NgaySinh,'%Y-%m-%d') as dob,
            hv.GioiTinh as gender,
            hv.SDT as contact,
            DATE_FORMAT( dk.NgayBatDau,'%Y-%m-%d') as date_enrolled,
            DATE_FORMAT( dk.NgayKetThuc,'%Y-%m-%d') as date_expiry,
            hv.is_vip as is_vip
        FROM HOIVIEN hv
                 LEFT JOIN DANGKYTAP dk ON hv.MaHV = dk.MaHV
    `;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});
// hàm gen id
const generateNextId = (table, column, prefix) => {
    return new Promise((resolve, reject) => {
        const sql = `SELECT ${column} FROM ${table} ORDER BY ${column} DESC LIMIT 1`;
        db.query(sql, (err, results) => {
            if (err) return reject(err);
            let nextNum = 11;
            if (results.length > 0) {
                const lastId = results[0][column];
                const lastNum = parseInt(lastId.replace(prefix, ""));
                nextNum = lastNum + 1;
            }
            resolve(prefix + String(nextNum).padStart(3, '0'));
        });
    });
};



//API sửa hội viên
app.put('/api/members/:id', (req, res) => {
    const { name, dob, gender, contact ,is_vip} = req.body;
    const id = req.params.id;

    const sql = "UPDATE HOIVIEN SET TenHV = ?, NgaySinh = ?, GioiTinh = ?, SDT = ?, is_vip = ? WHERE MaHV = ?";
    db.query(sql, [name, dob, gender, contact, is_vip||0, id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: "Đã cập nhật" });
    });
});

//API đăng ký hội viên
app.post('/api/members', async (req, res) => {
    try {
        const { name, dob, gender, contact } = req.body;
        const maHV = await generateNextId('HOIVIEN', 'MaHV', 'HV');

        const sql = "INSERT INTO HOIVIEN (MaHV, TenHV, NgaySinh, GioiTinh, SDT) VALUES (?, ?, ?, ?, ?)";
        db.query(sql, [maHV, name, dob, gender, contact], (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, message: `Đăng ký thành công ${maHV}` });
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

//API tìm kiếm member
app.get('/api/members/search', (req, res) => {
    const { keyword } = req.query;
    const searchVal = `%${keyword}%`;

    const sql = `
        SELECT
            hv.MaHV as memberid,
            hv.TenHV as name,
            DATE_FORMAT(hv.NgaySinh, '%Y-%m-%d') as dob,
            hv.GioiTinh as gender,
            hv.SDT as contact,
            MAX(DATE_FORMAT(dk.NgayBatDau, '%Y-%m-%d')) as date_enrolled,
            MAX(DATE_FORMAT(dk.NgayKetThuc, '%Y-%m-%d')) as date_expiry,
            hv.is_vip as is_vip
        FROM HOIVIEN hv
                 LEFT JOIN DANGKYTAP dk ON hv.MaHV = dk.MaHV
        WHERE
            hv.MaHV LIKE ? OR
            hv.TenHV LIKE ? OR
            DATE_FORMAT(dk.NgayBatDau, '%Y-%m-%d') LIKE ?
        GROUP BY hv.MaHV, hv.TenHV, hv.NgaySinh, hv.GioiTinh, hv.SDT, hv.is_vip`;

    db.query(sql, [searchVal, searchVal, searchVal], (err, results) => {
        if (err) {
            console.error('sql:', err);
            return res.status(500).json({ success: false, message: "Lỗi" });
        }
        res.json(results);
    });
});


//API tìm kiếm payment
app.get('/api/payments/search', (req, res) => {
    const { keyword } = req.query;
    const searchVal = `%${keyword}%`;

    const sql = `
        SELECT
            hv.TenHV as name,
            hv.MaHV as memberid,
            gt.TenGoi as package,
            DATE_FORMAT(tt.NgayTT,'%Y-%m-%d') as date_paid,
            tt.SoTien as amount,
            tt.HinhThucTT as payment_type,
            tt.TrangThai as status
        FROM THANHTOAN tt
                 JOIN DANGKYTAP dk ON tt.MaDK = dk.MaDK
                 JOIN HOIVIEN hv ON dk.MaHV = hv.MaHV
                 JOIN GOITAP gt ON dk.MaGoi = gt.MaGoi
        WHERE
            hv.MaHV LIKE ? OR
            hv.TenHV LIKE ? OR
            gt.TenGOi LIKE ? OR
            DATE_FORMAT(tt.NgayTT, '%Y-%m-%d') LIKE ? OR
            tt.HinhThucTT LIKE ?
        ORDER BY tt.NgayTT DESC `;

    db.query(sql, [searchVal, searchVal, searchVal, searchVal, searchVal], (err, results) => {
        if (err) {
            console.error('sql:', err);
            return res.status(500).json({ success: false, message: "Lỗi" });
        }
        res.json(results);
    });
});



//API thanh toán -> lưu vào bảng đăng ký tập vs bảng tt
app.post('/api/payments-full', async (req, res) => {
    const { memberName, packageId, maLich, sdate, edate, paymentType, amount } = req.body;

    // check tên hội viên + lấy is_vip
    db.query("SELECT MaHV, is_vip FROM HOIVIEN WHERE TenHV = ?", [memberName], async (err, members) => {
        if (err || members.length === 0) return res.status(400).json({ success: false, message: "Hội viên chưa tồn tại!" });
        const maHV   = members[0].MaHV;
        const finalAmount = parseFloat(amount) || 0;

        try {
            const maDK = await generateNextId('DANGKYTAP', 'MaDK', 'DK');
            const maTT = await generateNextId('THANHTOAN', 'MaTT', 'TT');

            db.beginTransaction((err) => {
                // Thêm DANGKYTAP
                const sqlDK = "INSERT INTO DANGKYTAP (MaDK, MaHV, MaGoi, MaLich, NgayBatDau, NgayKetThuc) VALUES (?,?,?,?,?,?)";
                db.query(sqlDK, [maDK, maHV, packageId, maLich, sdate, edate], (err) => {
                    if (err) return db.rollback(() => res.status(500).json({ success: false, message: "Lỗi DK" }));

                    // Thêm THANHTOAN với giá đã tính VIP
                    const sqlTT = "INSERT INTO THANHTOAN (MaTT, MaDK, NgayTT, SoTien, HinhThucTT, TrangThai) VALUES (?,?,NOW(),?,?,'Đã thanh toán')";
                    db.query(sqlTT, [maTT, maDK, finalAmount, paymentType], (err) => {
                        if (err) return db.rollback(() => res.status(500).json({ success: false, message: "Lỗi TT" }));

                        db.commit(() => res.json({
                            success: true,
                            message:"Thành công"
                        }));
                    });
                });
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
});

//API lấy lịch dạy
app.get('/api/schedules-detail', (req, res) => {
    const sql = `
        SELECT ld.MaLich, ld.MaHLV, nv.TenNV, ld.GioBatDau, ld.GioKetThuc,
               GROUP_CONCAT(lt.Thu ORDER BY lt.Thu) as CácThứ
        FROM LICHDAY ld
                 JOIN NHANVIEN nv ON ld.MaHLV = nv.MaNV
                 JOIN LICHTHU lt ON ld.MaLich = lt.MaLich
        GROUP BY ld.MaLich
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

//API lấy thông tin huấn luyện viên
app.get('/api/trainers', (req, res) => {
    const sql = `
        SELECT
            nv.MaNV as staffid,
            nv.TenNV as name,
            nv.SDT as contact,
            DATE_FORMAT(nv.NgaySinh,'%Y-%m-%d') as dob,
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

app.put('/api/trainers/:id', (req, res) => {
    const trainerId = req.params.id;
    const { name, contact, dob, gender, specialty } = req.body;

    if (!name || !contact) {
        return res.status(400).json({
            success: false,
            message: "Thiếu thông tin bắt buộc!"
        });
    }

    db.beginTransaction((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Lỗi transaction" });
        }

        // 1. Update NHANVIEN
        const sqlNV = `
            UPDATE NHANVIEN
            SET TenNV = ?, SDT = ?, NgaySinh = ?, GioiTinh = ?
            WHERE MaNV = ?
        `;

        db.query(sqlNV, [name, contact, dob, gender, trainerId], (err, result1) => {
            if (err) {
                return db.rollback(() =>
                    res.status(500).json({ success: false, message: "Lỗi update NHANVIEN" })
                );
            }

            if (result1.affectedRows === 0) {
                return db.rollback(() =>
                    res.status(404).json({ success: false, message: "Không tìm thấy trainer!" })
                );
            }

            // 2. Update HUANLUYENVIEN
            const sqlHLV = `
                UPDATE HUANLUYENVIEN
                SET ChuyenMon = ?
                WHERE MaNV = ?
            `;

            db.query(sqlHLV, [specialty, trainerId], (err, result2) => {
                if (err) {
                    return db.rollback(() =>
                        res.status(500).json({ success: false, message: "Lỗi update HLV" })
                    );
                }

                db.commit((err) => {
                    if (err) {
                        return db.rollback(() =>
                            res.status(500).json({ success: false, message: "Lỗi commit" })
                        );
                    }

                    res.json({
                        success: true,
                        message: "Cập nhật trainer thành công!"
                    });
                });
            });
        });
    });
});

// API Xóa Trainer
app.delete('/api/trainers/:id', (req, res) => {
    const trainerId = req.params.id;

    db.beginTransaction((err) => {
        if (err) return res.status(500).json({ success: false, message: "Lỗi kết nối" });

        // 1. Xóa trong bảng HUANLUYENVIEN
        db.query("DELETE FROM HUANLUYENVIEN WHERE MaNV = ?", [trainerId], (err) => {
            if (err) return db.rollback(() => res.status(500).json({ success: false, message: "Lỗi xóa HLV" }));

            // 2. Xóa USER liên quan (nếu cần)
            db.query("DELETE FROM USER WHERE MaNV = ?", [trainerId], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false, message: "Lỗi xóa User" }));

                // 3. Cuối cùng xóa NHANVIEN
                db.query("DELETE FROM NHANVIEN WHERE MaNV = ?", [trainerId], (err) => {
                    if (err) return db.rollback(() => res.status(500).json({ success: false, message: "Lỗi xóa thông tin nhân viên" }));

                    db.commit((err) => {
                        if (err) return db.rollback(() => res.status(500).json({ success: false }));
                        res.json({ success: true, message: "Đã xóa huấn luyện viên thành công" });
                    });
                });
            });
        });
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
            DATE_FORMAT(tt.NgayTT,'%Y-%m-%d') as date_paid,
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



//API gói tập
app.get('/api/packages', (req, res) => {
    const sql = "SELECT MaGoi as packageid, TenGoi as name, ThoiHan as validity, GiaTien as price FROM GOITAP";
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});


// API danh sách packages
app.post('/api/packages', (req, res) => {
    const { name, validity, price } = req.body;
    const maGoi = 'GT' + Date.now();
    const sql = "INSERT INTO GOITAP (MaGoi, TenGoi, ThoiHan, GiaTien) VALUES (?, ?, ?, ?)";
    db.query(sql, [maGoi, name, validity, price], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, message: "Thêm gói tập thành công!" });
    });
});

//API cập nhật packages
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



//API lấy danh sách ca dạy của 1 huấn luyện viên
app.get('/api/trainer/schedules/:trainerId', (req, res) => {
    const trainerId = req.params.trainerId;
    const sql = `
        SELECT ld.MaLich, ld.GioBatDau, ld.GioKetThuc,
               GROUP_CONCAT(lt.Thu ORDER BY lt.Thu) as ThuTrongTuan
        FROM LICHDAY ld
                 JOIN LICHTHU lt ON ld.MaLich = lt.MaLich
        WHERE ld.MaHLV = ?
        GROUP BY ld.MaLich`;

    db.query(sql, [trainerId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

//API lấy hội viên theo ca
app.get('/api/trainer/members', (req, res) => {
    const { trainerId, maLich } = req.query;
    let sql = `
        SELECT
            hv.MaHV as memberid,
            hv.TenHV as name,
            DATE_FORMAT(hv.NgaySinh, '%Y-%m-%d') as dob,
            hv.GioiTinh as gender,
            hv.SDT as contact,
            DATE_FORMAT(dk.NgayBatDau, '%Y-%m-%d') as date_enrolled,
            DATE_FORMAT(dk.NgayKetThuc, '%Y-%m-%d') as date_expiry,
            dk.MaLich
        FROM HOIVIEN hv
                 JOIN DANGKYTAP dk ON hv.MaHV = dk.MaHV
                 JOIN LICHDAY ld ON dk.MaLich = ld.MaLich
        WHERE ld.MaHLV = ?`;

    const params = [trainerId];
    if (maLich && maLich !== 'all') {
        sql += " AND dk.MaLich = ?";
        params.push(maLich);
    }

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});




//Thanh toán online
app.post('/api/create-payment-url', (req, res) => {
    try {
        const { amount, orderInfo } = req.body;

        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: "Số tiền không hợp lệ" });
        }

        const date = new Date();
        const pad = n => String(n).padStart(2, '0');
        const createDate = `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

        const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const ipAddr = rawIp.includes('::ffff:') ? rawIp.split('::ffff:')[1] : rawIp;

        const safeOrderInfo = (orderInfo || 'AGym Payment')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd').replace(/Đ/g, 'D')
            .replace(/[^a-zA-Z0-9 \-_.]/g, '')
            .slice(0, 255);

        let vnp_Params = {
            vnp_Version: "2.1.0",
            vnp_Command: "pay",
            vnp_TmnCode: vnp_TmnCode,
            vnp_Locale: "vn",
            vnp_CurrCode: "VND",
            vnp_TxnRef: Date.now().toString(),
            vnp_OrderInfo: safeOrderInfo,
            vnp_OrderType: "other",
            vnp_Amount: Math.round(Number(amount)) * 100,
            vnp_ReturnUrl: vnp_ReturnUrl,
            vnp_IpAddr: ipAddr,
            vnp_CreateDate: createDate
        };

        vnp_Params = sortObject(vnp_Params);

        const signData = qs.stringify(vnp_Params, { encode: false });
        const hmac = crypto.createHmac("sha512", vnp_HashSecret);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

        vnp_Params['vnp_SecureHash'] = signed;

        const paymentUrl = vnp_Url + '?' + qs.stringify(vnp_Params, { encode: false });

        console.log('[VNPay] Created payment URL for amount:', amount, '| TxnRef:', vnp_Params.vnp_TxnRef);
        res.json({ paymentUrl });

    } catch (err) {
        console.error('[VNPay] Error creating payment URL:', err);
        res.status(500).json({ success: false, message: 'Lỗi tạo URL thanh toán: ' + err.message });
    }
});


app.get('/api/vnpay-return', (req, res) => {
    let vnp_Params = { ...req.query };
    const secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);

    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    const responseCode = req.query['vnp_ResponseCode'];

    if (secureHash === signed) {
        if (responseCode === '00') {
            res.send(`
                <script>
                    alert("Giao dịch đã được xử lý thành công!");
                    window.close();
                </script>
            `);
        } else {
            res.send(`
                <script>
                    alert("Thanh toán thất bại! Mã lỗi: ${responseCode}");
                    window.close();
                </script>
            `);
        }
    } else {
        res.send(`
            <script>
                alert("Chữ ký không hợp lệ!");
                window.close();
            </script>
        `);
    }
});

app.get('/api/members/check-vip', (req, res) => {
    const name = req.query.name;
    db.query("SELECT is_vip FROM HOIVIEN WHERE TenHV = ?", [name], (err, results) => {
        if (results.length > 0) res.json({ is_vip: results[0].is_vip });
        else res.json({ is_vip: false });
    });
});


app.use('/api',verifyToken);

app.listen(3000, () => {
    console.log('Server đang chạy tại http://localhost:3000');
});