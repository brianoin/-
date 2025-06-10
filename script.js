const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');

// 顯示註冊表單
showRegisterLink.addEventListener('click', function(e) {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
});

// 顯示登入表單
showLoginLink.addEventListener('click', function(e) {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
});

// 登入表單提交事件
loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message + ' 歡迎：' + data.username);
            // 這裡將使用者導向到功能主頁
            window.location.href = '/dashboard';
        } else {
            alert('登入失敗: ' + data.message);
        }
    } catch (error) {
        console.error('登入請求錯誤:', error);
        alert('登入過程中發生錯誤，請稍後再試。');
    }
});

// 註冊表單提交事件
registerForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message);
            // 註冊成功後自動切換回登入表單
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
        } else {
            alert('註冊失敗: ' + data.message);
        }
    } catch (error) {
        console.error('註冊請求錯誤:', error);
        alert('註冊過程中發生錯誤，請稍後再試。');
    }
}); 