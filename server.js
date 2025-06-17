const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const app = express();
const port = 5000;

// 解析 JSON 格式的請求體
app.use(express.json());

// 提供靜態檔案
app.use(express.static(path.join(__dirname)));

// 會員驗證中間件
const authenticateUser = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: '未登入' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: '未登入' });
    }

    // 檢查 token 是否有效
    db.get('SELECT * FROM users WHERE token = ?', [token], (err, user) => {
        if (err) {
            return res.status(500).json({ message: '資料庫錯誤' });
        }
        if (!user) {
            return res.status(401).json({ message: '未登入' });
        }
        req.user = user;
        next();
    });
};

// 初始化 SQLite 資料庫
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('資料庫連線錯誤:', err.message);
    } else {
        console.log('成功連線到 SQLite 資料庫');
        
        // 先刪除舊的 users 表格
        db.run('DROP TABLE IF EXISTS users', (err) => {
            if (err) {
                console.error('刪除舊表格錯誤:', err.message);
            } else {
                console.log('舊表格已刪除');
                
                // 建立新的使用者表格
                db.run(`CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    token TEXT
                )`, (err) => {
                    if (err) {
                        console.error('建立使用者表格錯誤:', err.message);
                    } else {
                        console.log('使用者表格已準備好');
                    }
                });
            }
        });

        // 建立系統參數資料表
        db.run(`CREATE TABLE IF NOT EXISTS sys_parainfo (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            param_code VARCHAR(50) NOT NULL,
            param_value VARCHAR(255) NOT NULL,
            param_desc VARCHAR(255),
            sys_flag CHAR(1) NOT NULL DEFAULT 'N'
        )`, (err) => {
            if (err) {
                console.error('建立系統參數表格錯誤:', err.message);
            } else {
                console.log('系統參數表格已準備好');
            }
        });

        // 建立系統功能資料表
        db.run(`CREATE TABLE IF NOT EXISTS sys_menuinfo (
            menuid INTEGER PRIMARY KEY AUTOINCREMENT,
            paretid INTEGER DEFAULT 0,
            menuna NVARCHAR(255) NOT NULL,
            menuimg VARCHAR(255) DEFAULT '',
            menuurl VARCHAR(255) DEFAULT '',
            menonly CHAR(1) DEFAULT 'Y',
            opennew CHAR(1) DEFAULT 'N',
            dispseq CHAR(10) DEFAULT '00100',
            lastusr INTEGER DEFAULT 0,
            lasttm CHAR(14) DEFAULT ''
        )`, (err) => {
            if (err) {
                console.error('建立系統功能表格錯誤:', err.message);
            } else {
                console.log('系統功能表格已準備好');
            }
        });
    }
});

// 註冊 API
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: '帳號和密碼不能為空' });
    }

    try {
        // 檢查使用者是否已存在
        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            if (row) {
                return res.status(409).json({ message: '此帳號已存在' });
            }

            // 加密密碼
            const hashedPassword = await bcrypt.hash(password, 10);

            // 儲存使用者
            db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
                if (err) {
                    return res.status(500).json({ message: err.message });
                }
                res.status(201).json({ message: '註冊成功！', userId: this.lastID });
            });
        });
    } catch (error) {
        res.status(500).json({ message: '伺服器錯誤', error: error.message });
    }
});

// 登入 API
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: '帳號和密碼不能為空' });
    }

    try {
        // 查找使用者
        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            if (!user) {
                return res.status(401).json({ message: '帳號或密碼錯誤' });
            }

            // 比較密碼
            const isMatch = await bcrypt.compare(password, user.password);

            if (isMatch) {
                // 生成 token
                const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
                
                // 更新使用者的 token
                db.run('UPDATE users SET token = ? WHERE id = ?', [token, user.id], (err) => {
                    if (err) {
                        return res.status(500).json({ message: err.message });
                    }
                    res.status(200).json({ 
                        message: '登入成功！', 
                        username: user.username,
                        token: token
                    });
                });
            } else {
                res.status(401).json({ message: '帳號或密碼錯誤' });
            }
        });
    } catch (error) {
        res.status(500).json({ message: '伺服器錯誤', error: error.message });
    }
});

// 檢查登入狀態 API
app.get('/api/check-auth', authenticateUser, (req, res) => {
    res.json({ isAuthenticated: true, username: req.user.username });
});

// 系統參數 API
// 獲取所有系統參數
app.get('/api/params', authenticateUser, (req, res) => {
    db.all('SELECT * FROM sys_parainfo', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json(rows);
    });
});

// 新增系統參數
app.post('/api/params', authenticateUser, (req, res) => {
    const { param_code, param_value, param_desc, sys_flag } = req.body;
    db.run('INSERT INTO sys_parainfo (param_code, param_value, param_desc, sys_flag) VALUES (?, ?, ?, ?)',
        [param_code, param_value, param_desc, sys_flag || 'N'],
        function(err) {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            res.status(201).json({ id: this.lastID, message: '參數新增成功' });
        });
});

// 更新系統參數
app.put('/api/params/:id', authenticateUser, (req, res) => {
    const { param_code, param_value, param_desc, sys_flag } = req.body;
    db.run('UPDATE sys_parainfo SET param_code = ?, param_value = ?, param_desc = ?, sys_flag = ? WHERE id = ?',
        [param_code, param_value, param_desc, sys_flag, req.params.id],
        function(err) {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            res.json({ message: '參數更新成功' });
        });
});

// 刪除系統參數
app.delete('/api/params/:id', authenticateUser, (req, res) => {
    db.run('DELETE FROM sys_parainfo WHERE id = ?', req.params.id, function(err) {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json({ message: '參數刪除成功' });
    });
});

// 系統功能 API
// 獲取所有系統功能
app.get('/api/menus', (req, res) => {
    db.all('SELECT * FROM sys_menuinfo ORDER BY dispseq', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json(rows);
    });
});

// 新增系統功能
app.post('/api/menus', (req, res) => {
    const { paretid, menuna, menuimg, menuurl, menonly, opennew, dispseq } = req.body;
    const lasttm = new Date().toISOString().replace(/[-T:]/g, '').slice(0, 14);
    
    db.run(`INSERT INTO sys_menuinfo (paretid, menuna, menuimg, menuurl, menonly, opennew, dispseq, lasttm) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [paretid || 0, menuna, menuimg || '', menuurl || '', menonly || 'Y', opennew || 'N', dispseq || '00100', lasttm],
        function(err) {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            res.status(201).json({ menuid: this.lastID, message: '功能新增成功' });
        });
});

// 更新系統功能
app.put('/api/menus/:id', (req, res) => {
    const { paretid, menuna, menuimg, menuurl, menonly, opennew, dispseq, lastusr } = req.body;
    const lasttm = new Date().toISOString().replace(/[-T:]/g, '').slice(0, 14);
    
    db.run(`UPDATE sys_menuinfo 
            SET paretid = ?, menuna = ?, menuimg = ?, menuurl = ?, 
                menonly = ?, opennew = ?, dispseq = ?, lastusr = ?, lasttm = ?
            WHERE menuid = ?`,
        [paretid, menuna, menuimg, menuurl, menonly, opennew, dispseq, lastusr, lasttm, req.params.id],
        function(err) {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            res.json({ message: '功能更新成功' });
        });
});

// 刪除系統功能
app.delete('/api/menus/:id', (req, res) => {
    db.run('DELETE FROM sys_menuinfo WHERE menuid = ?', req.params.id, function(err) {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json({ message: '功能刪除成功' });
    });
});

// 登出 API
app.post('/api/logout', authenticateUser, (req, res) => {
    // 清除使用者的 token
    db.run('UPDATE users SET token = NULL WHERE id = ?', [req.user.id], (err) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json({ message: '登出成功' });
    });
});

// 設定路由，提供 index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 新增功能主頁路由
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// 會員管理 API
// 獲取所有會員
app.get('/api/members', authenticateUser, (req, res) => {
    db.all('SELECT id, username FROM users', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json(rows);
    });
});

// 新增會員
app.post('/api/members', authenticateUser, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: '帳號和密碼不能為空' });
    }

    try {
        // 檢查使用者是否已存在
        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            if (row) {
                return res.status(409).json({ message: '此帳號已存在' });
            }

            // 加密密碼
            const hashedPassword = await bcrypt.hash(password, 10);

            // 儲存使用者
            db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
                if (err) {
                    return res.status(500).json({ message: err.message });
                }
                res.status(201).json({ message: '會員新增成功！', userId: this.lastID });
            });
        });
    } catch (error) {
        res.status(500).json({ message: '伺服器錯誤', error: error.message });
    }
});

// 更新會員
app.put('/api/members/:id', authenticateUser, async (req, res) => {
    const { username, password } = req.body;
    const userId = req.params.id;

    if (!username) {
        return res.status(400).json({ message: '帳號不能為空' });
    }

    try {
        // 檢查使用者是否存在
        db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            if (!user) {
                return res.status(404).json({ message: '找不到此會員' });
            }

            // 檢查新帳號是否已被其他使用者使用
            db.get('SELECT * FROM users WHERE username = ? AND id != ?', [username, userId], async (err, existingUser) => {
                if (err) {
                    return res.status(500).json({ message: err.message });
                }
                if (existingUser) {
                    return res.status(409).json({ message: '此帳號已被使用' });
                }

                let updateQuery = 'UPDATE users SET username = ?';
                let params = [username];

                // 如果有提供新密碼，則更新密碼
                if (password) {
                    const hashedPassword = await bcrypt.hash(password, 10);
                    updateQuery += ', password = ?';
                    params.push(hashedPassword);
                }

                updateQuery += ' WHERE id = ?';
                params.push(userId);

                db.run(updateQuery, params, function(err) {
                    if (err) {
                        return res.status(500).json({ message: err.message });
                    }
                    res.json({ message: '會員資料更新成功' });
                });
            });
        });
    } catch (error) {
        res.status(500).json({ message: '伺服器錯誤', error: error.message });
    }
});

// 刪除會員
app.delete('/api/members/:id', authenticateUser, (req, res) => {
    const userId = req.params.id;

    // 檢查是否為最後一個管理員
    db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        if (result.count <= 1) {
            return res.status(400).json({ message: '無法刪除最後一個會員' });
        }

        db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            res.json({ message: '會員刪除成功' });
        });
    });
});

// 啟動伺服器，監聽所有網路介面
app.listen(port, '0.0.0.0', () => {
    console.log(`伺服器運行在 http://localhost:${port}`);
    console.log('您也可以通過以下方式訪問：');
    console.log(`http://[您的IP位址]:${port}`);
}); 