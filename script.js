document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // 這裡可以加入實際的驗證邏輯
    // 目前使用簡單的示範驗證
    if (username === 'admin' && password === 'password') {
        alert('登入成功！');
        // 這裡可以加入登入成功後的導向邏輯
    } else {
        alert('帳號或密碼錯誤！');
    }
}); 