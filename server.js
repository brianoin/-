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

// 初始化 SQLite 資料庫
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('資料庫連線錯誤:', err.message);
    } else {
        console.log('成功連線到 SQLite 資料庫');
        // 建立 users 表
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )`, (err) => {
            if (err) {
                console.error('建立使用者表格錯誤:', err.message);
            } else {
                console.log('使用者表格已準備好');
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
                // 檢查並新增測驗選單
                db.get('SELECT * FROM sys_menuinfo WHERE menuurl = ?', ['/quiz'], (err, row) => {
                    if (!err && !row) {
                        db.run(`INSERT INTO sys_menuinfo (menuna, menuurl, dispseq) VALUES (?, ?, ?)`,
                            ['線上測驗', '/quiz', '00200'],
                            (err) => {
                                if (err) {
                                    console.error('插入測驗選單項目錯誤:', err.message);
                                } else {
                                    console.log('已新增線上測驗至選單');
                                }
                            }
                        );
                    }
                });
            }
        });
        // 建立測驗資料表（保留）
        db.run(`CREATE TABLE IF NOT EXISTS quizzes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            option_a TEXT NOT NULL,
            option_b TEXT NOT NULL,
            option_c TEXT NOT NULL,
            option_d TEXT NOT NULL,
            correct_answer CHAR(1) NOT NULL
        )`, (err) => {
            if (err) {
                console.error('建立測驗表格錯誤:', err.message);
            } else {
                console.log('測驗表格已準備好');
                // ...插入題目程式碼保留...
            }
        });
    }
});

// 系統參數 API
// 獲取所有系統參數
app.get('/api/params', (req, res) => {
    db.all('SELECT * FROM sys_parainfo', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json(rows);
    });
});
// 新增、更新、刪除系統參數 API 也都不需驗證
app.post('/api/params', (req, res) => {
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
app.put('/api/params/:id', (req, res) => {
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
app.delete('/api/params/:id', (req, res) => {
    db.run('DELETE FROM sys_parainfo WHERE id = ?', req.params.id, function(err) {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json({ message: '參數刪除成功' });
    });
});

// 系統功能 API
app.get('/api/menus', (req, res) => {
    db.all('SELECT * FROM sys_menuinfo ORDER BY dispseq', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json(rows);
    });
});
app.post('/api/menus', (req, res) => {
    const { paretid, menuna, menuimg, menuurl, menonly, opennew, dispseq } = req.body;
    const lasttm = new Date().toISOString().replace(/[-T:]/g, '').slice(0, 14);
    db.run(`INSERT INTO sys_menuinfo (paretid, menuna, menuimg, menuurl, menonly, opennew, dispseq, lasttm) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [paretid || 0, menuna, menuimg || '', menuurl || '', menonly || 'Y', opennew || 'N', dispseq || '00100', lasttm],
        function(err) {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            res.status(201).json({ menuid: this.lastID, message: '功能新增成功' });
        });
});
app.put('/api/menus/:id', (req, res) => {
    const { paretid, menuna, menuimg, menuurl, menonly, opennew, dispseq, lastusr } = req.body;
    const lasttm = new Date().toISOString().replace(/[-T:]/g, '').slice(0, 14);
    db.run(`UPDATE sys_menuinfo SET paretid = ?, menuna = ?, menuimg = ?, menuurl = ?, menonly = ?, opennew = ?, dispseq = ?, lastusr = ?, lasttm = ? WHERE menuid = ?`,
        [paretid, menuna, menuimg, menuurl, menonly, opennew, dispseq, lastusr, lasttm, req.params.id],
        function(err) {
            if (err) {
                return res.status(500).json({ message: err.message });
            }
            res.json({ message: '功能更新成功' });
        });
});
app.delete('/api/menus/:id', (req, res) => {
    db.run('DELETE FROM sys_menuinfo WHERE menuid = ?', req.params.id, function(err) {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json({ message: '功能刪除成功' });
    });
});

// 測驗 API
app.get('/api/quizzes', (req, res) => {
    db.all('SELECT id, question, option_a, option_b, option_c, option_d FROM quizzes', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }
        res.json(rows);
    });
});
app.post('/api/quiz/check-answer', (req, res) => {
    const { questionId, answer } = req.body;
    if (!questionId || !answer) {
        return res.status(400).json({ message: '缺少題目 ID 或答案' });
    }
    db.get('SELECT correct_answer FROM quizzes WHERE id = ?', [questionId], (err, row) => {
        if (err) {
            return res.status(500).json({ message: '資料庫查詢錯誤', error: err.message });
        }
        if (!row) {
            return res.status(404).json({ message: '找不到該題目' });
        }
        const isCorrect = row.correct_answer === answer;
        res.json({
            isCorrect: isCorrect,
            correctAnswer: row.correct_answer
        });
    });
});

// 使用者註冊 API
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: '請提供使用者名稱和密碼' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            return res.status(500).json({ message: '資料庫查詢錯誤', error: err.message });
        }
        if (row) {
            return res.status(400).json({ message: '使用者名稱已被註冊' });
        }

        bcrypt.hash(password, 10, (err, hash) => {
            if (err) {
                return res.status(500).json({ message: '密碼雜湊錯誤', error: err.message });
            }

            db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], function(err) {
                if (err) {
                    return res.status(500).json({ message: '註冊失敗', error: err.message });
                }
                res.status(201).json({ message: '註冊成功', userId: this.lastID });
            });
        });
    });
});

// 使用者登入 API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: '請提供使用者名稱和密碼' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ message: '資料庫錯誤', error: err.message });
        }
        if (!user) {
            return res.status(401).json({ message: '使用者不存在或密碼錯誤' });
        }

        bcrypt.compare(password, user.password, (err, result) => {
            if (result) {
                res.json({ message: '登入成功', username: user.username });
            } else {
                res.status(401).json({ message: '使用者不存在或密碼錯誤' });
            }
        });
    });
});

// 其他靜態頁面路由保留
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});
app.get('/quiz', (req, res) => {
    res.sendFile(path.join(__dirname, 'quiz.html'));
});

// 啟動伺服器，監聽所有網路介面
app.listen(port, '0.0.0.0', () => {
    console.log(`伺服器運行在 http://localhost:${port}`);
    console.log('您也可以通過以下方式訪問：');
    console.log(`http://[您的IP位址]:${port}`);
}); 