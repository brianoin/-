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
        // 建立使用者表格 (如果不存在)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )`, (err) => {
            if (err) {
                console.error('建立表格錯誤:', err.message);
            } else {
                console.log('使用者表格已準備好');
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
                res.status(200).json({ message: '登入成功！', username: user.username });
            } else {
                res.status(401).json({ message: '帳號或密碼錯誤' });
            }
        });
    } catch (error) {
        res.status(500).json({ message: '伺服器錯誤', error: error.message });
    }
});

// 設定路由，提供 index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 新增功能主頁路由
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// 啟動伺服器，監聽所有網路介面
app.listen(port, '0.0.0.0', () => {
    console.log(`伺服器運行在 http://localhost:${port}`);
    console.log('您也可以通過以下方式訪問：');
    console.log(`http://[您的IP位址]:${port}`);
}); 