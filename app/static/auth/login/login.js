document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const emailUserInput = document.getElementById('emailUser');
    const passwordInput = document.getElementById('password');
    
    // Helper to reset error states
    function resetErrors() {
        emailUserInput.classList.remove('input-error');
        passwordInput.classList.remove('input-error');
        let errMsg = document.getElementById('loginErrorMsg');
        if (errMsg) errMsg.remove();
    }

    // Helper to show error
    function showError(msg) {
        emailUserInput.classList.add('input-error');
        passwordInput.classList.add('input-error');
        let errMsg = document.getElementById('loginErrorMsg');
        if (!errMsg) {
            errMsg = document.createElement('div');
            errMsg.id = 'loginErrorMsg';
            errMsg.className = 'error-message';
            loginForm.insertBefore(errMsg, loginForm.querySelector('.form-options'));
        }
        errMsg.textContent = msg;
    }

    // Password show/hide toggle
    const togglePasswordBtn = document.querySelector('.toggle-password');
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', function() {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            this.querySelector('i').classList.toggle('fa-eye');
            this.querySelector('i').classList.toggle('fa-eye-slash');
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            resetErrors();
            const emailUser = emailUserInput.value.trim();
            const password = passwordInput.value;
            let valid = true;
            if (!emailUser) {
                emailUserInput.classList.add('input-error');
                valid = false;
            }
            if (!password) {
                passwordInput.classList.add('input-error');
                valid = false;
            }
            if (!valid) {
                showError('Please enter your email and password.');
                return;
            }
            const email = emailUser.includes('@') ? emailUser : emailUser + '@deped.gov.ph';
            const next = document.getElementById('next').value;
            
            // Show loading state
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
            }
            
            fetch('/login/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, next })
            })
            .then(res => res.json()
                .then(data => ({ status: res.status, data }))
                .catch(err => {
                    console.error('JSON parse error:', err);
                    return { status: res.status, data: { error: 'Invalid server response' } };
                })
            )
            .then(({ status, data }) => {
                if (status === 200 && data.success) {
                    // Store user data if needed
                    if (data.user) {
                        localStorage.setItem('user', JSON.stringify(data.user));
                    }
                    // Store token for API access
                    if (data.token) {
                        localStorage.setItem('auth_token', data.token);
                    }
                    // Redirect to the specified URL
                    window.location.href = data.redirect || '/user-dashboard/';
                } else {
                    showError(data.error || 'Invalid email or password.');
                }
            })
            .catch(() => {
                showError('Network error. Please try again.');
                })
                .finally(() => {
                    // Reset loading state
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = 'Login';
                    }
                });
        });
    }
});