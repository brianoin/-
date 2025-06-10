const express = require('express');
const path = require('path');
const app = express();
const port = 8080;

// 提供靜態檔案
app.use(express.static(path.join(__dirname)));

// 設定路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 啟動伺服器，監聽所有網路介面
app.listen(port, '0.0.0.0', () => {
    console.log(`伺服器運行在 http://localhost:${port}`);
    console.log('您也可以通過以下方式訪問：');
    console.log(`http://[您的IP位址]:${port}`);
}); 