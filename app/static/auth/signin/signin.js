document.addEventListener('DOMContentLoaded', function() {
    // --- Autocomplete for region, division, district, schoolName ---
    function setupAutocomplete(inputId, type) {
        const input = document.getElementById(inputId);
        if (!input) return;
        let timeout = null;
        let suggestionBox = document.createElement('div');
        suggestionBox.className = 'autocomplete-suggestions';
        suggestionBox.style.display = 'none';
        input.parentNode.style.position = 'relative';
        input.parentNode.appendChild(suggestionBox);

        // For schoolName, get the schoolIdBox and related fields
        let schoolIdBox = null;
        let districtInput = null, divisionInput = null, regionInput = null;
        if (inputId === 'schoolName') {
            schoolIdBox = document.getElementById('schoolIdBox');
            districtInput = document.getElementById('district');
            divisionInput = document.getElementById('division');
            regionInput = document.getElementById('region');
        }

        // Helper to lock/unlock related fields
        function setRelatedDisabled(disabled) {
            if (districtInput) districtInput.disabled = disabled;
            if (divisionInput) divisionInput.disabled = disabled;
            if (regionInput) regionInput.disabled = disabled;
        }

        // Helper to clear related fields
        function clearRelated() {
            if (districtInput) districtInput.value = '';
            if (divisionInput) divisionInput.value = '';
            if (regionInput) regionInput.value = '';
            setRelatedDisabled(false);
        }

        // Listen for manual changes to schoolName to unlock related fields
        if (inputId === 'schoolName') {
            input.addEventListener('input', () => {
                setRelatedDisabled(false);
            });
        }

        input.addEventListener('input', function() {
            clearTimeout(timeout);
            if (schoolIdBox) {
                schoolIdBox.style.display = 'none';
                schoolIdBox.textContent = '';
            }
            if (inputId === 'schoolName') {
                clearRelated();
            }
            timeout = setTimeout(() => {
                const value = input.value.trim();
                if (value.length === 0) {
                    suggestionBox.innerHTML = '';
                    suggestionBox.style.display = 'none';
                    if (schoolIdBox) {
                        schoolIdBox.style.display = 'none';
                        schoolIdBox.textContent = '';
                    }
                    if (inputId === 'schoolName') {
                        clearRelated();
                    }
                    return;
                }
                // For schoolName, fetch by name or id
                let url = `/api/search_location/?type=${type}&q=${encodeURIComponent(value)}`;
                fetch(url)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok');
                        }
                        return response.json();
                    })
                    .then(data => {
                        suggestionBox.innerHTML = '';
                        if (!data || data.length === 0) {
                            suggestionBox.style.display = 'none';
                            // If user entered a value and no match, show not found
                            if (inputId === 'schoolName' && value.length > 0) {
                                if (schoolIdBox) {
                                    schoolIdBox.textContent = 'Not found';
                                    schoolIdBox.style.display = 'inline-block';
                                }
                                clearRelated();
                            }
                            return;
                        }
                        // For schoolName, data is array of objects {school_name, school_id, ...}
                        data.forEach(item => {
                            const div = document.createElement('div');
                            if (type === 'school' && typeof item === 'object') {
                                div.textContent = `${item.school_name} (${item.school_id})`;
                            } else {
                                div.textContent = item;
                            }
                            div.onclick = () => {
                                if (type === 'school' && typeof item === 'object') {
                                    input.value = item.school_name;
                                    if (schoolIdBox) {
                                        schoolIdBox.textContent = item.school_id;
                                        schoolIdBox.style.display = 'inline-block';
                                    }
                                    // Auto-fill district, division, region if present
                                    if (item.district_name) {
                                        if (districtInput) districtInput.value = item.district_name;
                                    }
                                    if (item.division_name) {
                                        if (divisionInput) divisionInput.value = item.division_name;
                                    }
                                    if (item.region_name) {
                                        if (regionInput) regionInput.value = item.region_name;
                                    }
                                    setRelatedDisabled(true);
                                } else {
                                    input.value = item;
                                }
                                suggestionBox.innerHTML = '';
                                suggestionBox.style.display = 'none';
                            };
                            suggestionBox.appendChild(div);
                        });
                        suggestionBox.style.display = 'block';
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        suggestionBox.innerHTML = '';
                        suggestionBox.style.display = 'none';
                    });
            }, 1000); // 1 second debounce
        });

        // Hide suggestions on blur
        input.addEventListener('blur', () => setTimeout(() => {
            suggestionBox.innerHTML = '';
            suggestionBox.style.display = 'none';
        }, 200));
    }

    setupAutocomplete('region', 'region');
    setupAutocomplete('division', 'division');
    setupAutocomplete('district', 'district');
    setupAutocomplete('schoolName', 'school');
    // --- Elements ---
    const signupForm = document.getElementById('signupForm');
    const passwordInput = document.getElementById('password');
    const emailError = document.getElementById('emailError');
    const emailUserInput = document.getElementById('emailUser');
    const passwordTooltip = document.getElementById('passwordTooltip');
    const usernameInput = document.getElementById('username');
    const togglePassword = document.getElementById('togglePassword');
    const page1 = document.getElementById('page1');
    const page2 = document.getElementById('page2');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const backPageBtn = document.getElementById('backPageBtn');

    // Use static custom-tooltip divs for username and email (like password)
    const usernameTooltip = document.getElementById('usernameTooltip');
    const emailTooltip = document.getElementById('emailTooltip');

    // Modal for school account exists (accessible)
    let schoolModal = document.getElementById('schoolExistsModal');
    if (!schoolModal) {
        schoolModal = document.createElement('div');
        schoolModal.id = 'schoolExistsModal';
        schoolModal.style.display = 'none';
        schoolModal.setAttribute('role', 'dialog');
        schoolModal.setAttribute('aria-modal', 'true');
        schoolModal.innerHTML = `
            <div class="modal-backdrop" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(41,52,64,0.25);z-index:1000;"></div>
            <div class="modal-content login-card" tabindex="-1" aria-labelledby="schoolModalTitle" aria-describedby="schoolModalMsg" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--white);border-radius:16px;z-index:1001;min-width:340px;max-width:420px;width:100%;box-shadow:var(--shadow);padding:0;overflow:hidden;font-family:inherit;display:flex;flex-direction:column;align-items:center;">
                <div id="schoolModalTitle" style="width:100%;background:var(--light-blue);padding:1.5em 2em 1em 2em;color:var(--dark-blue);text-align:center;font-size:1.25em;font-weight:600;letter-spacing:0.5px;border-top-left-radius:16px;border-top-right-radius:16px;">Account Already Exists</div>
                <div id="schoolModalMsg" role="alert" style="padding:1.5em 2em 1em 2em;color:var(--dark-blue);text-align:center;font-size:1.08em;"></div>
                <div style="display:flex;justify-content:center;gap:1em;padding:1em 2em 2em 2em;background:var(--white);width:100%;">
                    <button id="schoolModalCancel" class="login-button" style="background:var(--medium-blue);color:var(--white);border-radius:10px;min-width:120px;">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(schoolModal);
        // Trap focus in modal
        schoolModal.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                schoolModal.style.display = 'none';
            }
            // Trap tab
            const focusable = schoolModal.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
            if (e.key === 'Tab' && focusable.length) {
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
                    e.preventDefault();
                    (e.shiftKey ? last : first).focus();
                }
            }
        });
    }

    // Loading spinner (accessible, for AJAX checks and submit)
    let loadingSpinner = document.getElementById('loadingSpinner');
    if (!loadingSpinner) {
        loadingSpinner = document.createElement('div');
        loadingSpinner.id = 'loadingSpinner';
        loadingSpinner.setAttribute('role', 'status');
        loadingSpinner.setAttribute('aria-live', 'polite');
        loadingSpinner.style.display = 'none';
        loadingSpinner.innerHTML = '<div style="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2000;background:rgba(255,255,255,0.5);display:flex;align-items:center;justify-content:center;"><div style="background:var(--white);padding:2em 2.5em;border-radius:12px;box-shadow:var(--shadow);font-size:1.2em;display:flex;align-items:center;gap:1em;"><span class="spinner" style="width:2em;height:2em;border:4px solid #1976d2;border-top:4px solid #e0e0e0;border-radius:50%;display:inline-block;animation:spin 1s linear infinite;"></span> <span>Loading...</span></div></div>';
        document.body.appendChild(loadingSpinner);
        // Spinner CSS
        const style = document.createElement('style');
        style.innerHTML = '@keyframes spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}';
        document.head.appendChild(style);
    }

    function showSpinner() { loadingSpinner.style.display = 'block'; }
    function hideSpinner() { loadingSpinner.style.display = 'none'; }

    // Error modal (for network/server errors)
    let errorModal = document.getElementById('errorModal');
    if (!errorModal) {
        errorModal = document.createElement('div');
        errorModal.id = 'errorModal';
        errorModal.style.display = 'none';
        errorModal.setAttribute('role', 'alertdialog');
        errorModal.setAttribute('aria-modal', 'true');
        errorModal.innerHTML = `
            <div class="modal-backdrop" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(41,52,64,0.25);z-index:3000;"></div>
            <div class="modal-content login-card" tabindex="-1" aria-labelledby="errorModalTitle" aria-describedby="errorModalMsg" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--white);border-radius:16px;z-index:3001;min-width:340px;max-width:420px;width:100%;box-shadow:var(--shadow);padding:0;overflow:hidden;font-family:inherit;display:flex;flex-direction:column;align-items:center;">
                <div id="errorModalTitle" style="width:100%;background:#e53935;padding:1.5em 2em 1em 2em;color:var(--white);text-align:center;font-size:1.25em;font-weight:600;letter-spacing:0.5px;border-top-left-radius:16px;border-top-right-radius:16px;">Error</div>
                <div id="errorModalMsg" role="alert" style="padding:1.5em 2em 1em 2em;color:#222;text-align:center;font-size:1.08em;"></div>
                <div style="display:flex;justify-content:center;gap:1em;padding:1em 2em 2em 2em;background:var(--white);width:100%;">
                    <button id="errorModalClose" class="login-button" style="background:#e53935;color:var(--white);border-radius:10px;min-width:120px;">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(errorModal);
        errorModal.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') errorModal.style.display = 'none';
        });
        document.getElementById('errorModalClose').onclick = function() {
            errorModal.style.display = 'none';
        };
    }

    // Success modal (for post-signup feedback)
    let successModal = document.getElementById('successModal');
    if (!successModal) {
        successModal = document.createElement('div');
        successModal.id = 'successModal';
        successModal.style.display = 'none';
        successModal.setAttribute('role', 'alertdialog');
        successModal.setAttribute('aria-modal', 'true');
        successModal.innerHTML = `
            <div class="modal-backdrop" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(41,52,64,0.25);z-index:4000;"></div>
            <div class="modal-content login-card" tabindex="-1" aria-labelledby="successModalTitle" aria-describedby="successModalMsg" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--white);border-radius:16px;z-index:4001;min-width:340px;max-width:420px;width:100%;box-shadow:var(--shadow);padding:0;overflow:hidden;font-family:inherit;display:flex;flex-direction:column;align-items:center;">
                <div id="successModalTitle" style="width:100%;background:var(--light-blue);padding:1.5em 2em 1em 2em;color:var(--dark-blue);text-align:center;font-size:1.25em;font-weight:600;letter-spacing:0.5px;border-top-left-radius:16px;border-top-right-radius:16px;">Account Created</div>
                <div id="successModalMsg" role="alert" style="padding:1.5em 2em 1em 2em;color:var(--dark-blue);text-align:center;font-size:1.08em;">Your account has been created!</div>
            </div>
        `;
        document.body.appendChild(successModal);
    }

    // --- Success Toast ---
    let successToast = document.getElementById('successToast');
    if (!successToast) {
        successToast = document.createElement('div');
        successToast.id = 'successToast';
        successToast.setAttribute('role', 'status');
        successToast.setAttribute('aria-live', 'polite');
        successToast.style.display = 'none';
        successToast.style.position = 'fixed';
        successToast.style.top = '32px';
        successToast.style.right = '32px';
        successToast.style.zIndex = '5000';
        successToast.style.background = 'var(--light-blue)';
        successToast.style.color = 'var(--dark-blue)';
        successToast.style.padding = '1em 2em';
        successToast.style.borderRadius = '12px';
        successToast.style.boxShadow = 'var(--shadow)';
        successToast.style.fontSize = '1.08em';
        successToast.style.fontWeight = '500';
        successToast.style.letterSpacing = '0.5px';
        successToast.style.transition = 'opacity 0.3s';
        successToast.innerHTML = '<i class="fas fa-check-circle" style="margin-right:0.5em;color:#388e3c;"></i> Account created! Redirecting...';
        document.body.appendChild(successToast);
    }

    function showSuccessToast() {
        successToast.style.display = 'block';
        successToast.style.opacity = '1';
        setTimeout(() => {
            successToast.style.opacity = '0';
            setTimeout(() => { successToast.style.display = 'none'; }, 400);
        }, 2000);
    }

    // --- Validation Functions ---
    function validatePassword(password) {
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/.test(password);
    }

    function validateUsername(username) {
        return /^[a-zA-Z0-9]{3,}$/.test(username);
    }

    function validateEmailUser(emailUser) {
        // Only letters and numbers, at least 3 chars, no dots allowed
        return /^[a-zA-Z0-9]{3,}$/.test(emailUser);
    }

    let usernameErrorTimeout, emailErrorTimeout, passwordErrorTimeout;

    // --- Rate limit helper ---
    function rateLimit(fn, delay) {
        let lastCall = 0;
        let timeout = null;
        return function(...args) {
            const now = Date.now();
            if (now - lastCall < delay) {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    lastCall = Date.now();
                    fn.apply(this, args);
                }, delay);
            } else {
                lastCall = now;
                fn.apply(this, args);
            }
        };
    }

    function showUsernameError() {
        if (!usernameInput || !usernameTooltip) return;
        usernameTooltip.textContent = '';
        usernameTooltip.style.display = 'none';
        usernameInput.classList.remove('input-error');
        clearTimeout(usernameErrorTimeout);
        usernameErrorTimeout = setTimeout(() => {
            if (!validateUsername(usernameInput.value)) {
                usernameInput.classList.add('input-error');
                usernameTooltip.textContent = 'Username must be at least 3 characters, letters and numbers only.';
                usernameTooltip.style.display = 'block';
                return;
            }
            // AJAX check for username existence (GET) - no spinner
            fetch(`/api/search_location/?type=username&q=${encodeURIComponent(usernameInput.value)}`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.usernameExists) {
                        usernameInput.classList.add('input-error');
                        usernameTooltip.textContent = 'This username is already used.';
                        usernameTooltip.style.display = 'block';
                    }
                })
                .catch(() => {
                    errorModal.style.display = 'block';
                    document.getElementById('errorModalMsg').textContent = 'A network or server error occurred. Please try again.';
                });
        }, 300);
    }
    // Wrap username error in rate limit
    const rateLimitedShowUsernameError = rateLimit(showUsernameError, 700);
    if (usernameInput) {
        usernameInput.addEventListener('input', rateLimitedShowUsernameError);
        usernameInput.addEventListener('blur', showUsernameError);
    }
    if (usernameInput) {
        usernameInput.addEventListener('input', showUsernameError);
        usernameInput.addEventListener('blur', showUsernameError);
    }

    function showEmailError() {
        if (!emailUserInput || !emailTooltip) return;
        emailTooltip.textContent = '';
        emailTooltip.style.display = 'none';
        emailUserInput.classList.remove('input-error');
        clearTimeout(emailErrorTimeout);
        emailErrorTimeout = setTimeout(() => {
            if (!validateEmailUser(emailUserInput.value)) {
                emailUserInput.classList.add('input-error');
                emailTooltip.textContent = 'Email username must be at least 3 characters, only letters and numbers allowed.';
                emailTooltip.style.display = 'block';
                return;
            }
            // AJAX check for email existence (GET) - no spinner
            const email = emailUserInput.value + '@deped.gov.ph';
            fetch(`/api/search_location/?type=email&q=${encodeURIComponent(email)}`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.emailExists) {
                        emailUserInput.classList.add('input-error');
                        emailTooltip.textContent = 'This email is already used.';
                        emailTooltip.style.display = 'block';
                    }
                })
                .catch(() => {
                    errorModal.style.display = 'block';
                    document.getElementById('errorModalMsg').textContent = 'A network or server error occurred. Please try again.';
                });
        }, 300);
    }
    // Wrap email error in rate limit
    const rateLimitedShowEmailError = rateLimit(showEmailError, 700);
    if (emailUserInput) {
        emailUserInput.addEventListener('input', rateLimitedShowEmailError);
        emailUserInput.addEventListener('blur', showEmailError);
    }

    function showPasswordError() {
        if (!passwordInput || !passwordTooltip) return;
        passwordTooltip.textContent = '';
        passwordTooltip.style.display = 'none';
        passwordInput.classList.remove('input-error');
        clearTimeout(passwordErrorTimeout);
        passwordErrorTimeout = setTimeout(() => {
            const value = passwordInput.value;
            const errors = [];
            if (value.length < 8) errors.push('at least 8 characters');
            if (!/[A-Z]/.test(value)) errors.push('an uppercase letter');
            if (!/[a-z]/.test(value)) errors.push('a lowercase letter');
            if (!/\d/.test(value)) errors.push('a number');
            if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)) errors.push('a special character');
            if (errors.length > 0) {
                passwordInput.classList.add('input-error');
                passwordTooltip.textContent = 'Password must contain: ' + errors.join(', ') + '.';
                passwordTooltip.style.display = 'block';
            }
            checkFormValidity();
        }, 300);
    }

    if (passwordInput) {
        passwordInput.addEventListener('input', showPasswordError);
        passwordInput.addEventListener('blur', showPasswordError);
    }

    // --- Password toggle ---
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }

    // --- Stepper logic ---
    function showPage(pageNum) {
        const stepCircle1 = document.getElementById('stepCircle1');
        const stepCircle2 = document.getElementById('stepCircle2');
        const stepLabel1 = document.getElementById('stepLabel1');
        const stepLabel2 = document.getElementById('stepLabel2');
        const stepLine1 = document.getElementById('stepLine1');
        
        if (!page1 || !page2 || !stepCircle1 || !stepCircle2 || !stepLabel1 || !stepLabel2 || !stepLine1) return;
        
        if (pageNum === 1) {
            page1.style.display = '';
            page2.style.display = 'none';
            stepCircle1.className = 'h-step-circle active';
            stepCircle1.innerHTML = '1';
            stepCircle1.setAttribute('aria-current', 'step');
            stepLabel1.className = 'h-step-label active';
            stepCircle2.className = 'h-step-circle';
            stepCircle2.innerHTML = '2';
            stepCircle2.removeAttribute('aria-current');
            stepLabel2.className = 'h-step-label';
            stepLine1.style.background = '#e0e0e0';
        } else {
            page1.style.display = 'none';
            page2.style.display = '';
            stepCircle1.className = 'h-step-circle completed';
            stepCircle1.innerHTML = '<i class="fas fa-check"></i>';
            stepCircle1.removeAttribute('aria-current');
            stepLabel1.className = 'h-step-label completed';
            stepCircle2.className = 'h-step-circle active';
            stepCircle2.innerHTML = '2';
            stepCircle2.setAttribute('aria-current', 'step');
            stepLabel2.className = 'h-step-label active';
            stepLine1.style.background = '#1976d2';
        }
    }

    // Initialize to page1
    if (page1 && page2) showPage(1);

    // Next button
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function() {
            const fields = [
                document.getElementById('schoolName'),
                document.getElementById('district'),
                document.getElementById('division'),
                document.getElementById('region')
            ];
            let valid = true;
            fields.forEach(field => {
                if (!field) return;
                if (!field.value.trim()) {
                    field.classList.add('input-error');
                    valid = false;
                } else {
                    field.classList.remove('input-error');
                }
            });
            // --- School must be found check ---
            const schoolIdBox = document.getElementById('schoolIdBox');
            const schoolNameInput = document.getElementById('schoolName');
            if (schoolNameInput) {
                // If schoolIdBox exists, check its content
                if (schoolIdBox && (schoolIdBox.textContent === 'Not found' || schoolIdBox.textContent.trim() === '')) {
                    schoolNameInput.classList.add('input-error');
                    // Optionally show a tooltip or alert
                    schoolNameInput.focus();
                    return;
                }
            }
            if (!valid) return;
            // --- School user existence validation ---
            if (schoolNameInput && schoolNameInput.value.trim()) {
                // Try to get school id from schoolIdBox if available, else use name
                let schoolId = null;
                if (schoolIdBox && schoolIdBox.textContent && schoolIdBox.textContent !== 'Not found') {
                    schoolId = schoolIdBox.textContent.trim();
                }
                // Query backend for user existence for this school
                let url = '/api/search_location/?type=school_user_exists';
                if (schoolId) {
                    url += `&school_id=${encodeURIComponent(schoolId)}`;
                } else {
                    url += `&school_name=${encodeURIComponent(schoolNameInput.value.trim())}`;
                }
                showSpinner();
                fetch(url)
                    .then(res => res.json())
                    .then(data => {
                        hideSpinner();
                        if (data && data.exists) {
                            // Show modal and do not proceed
                            const msg = `A user is already registered for this school.<br><br><b>Username:</b> ${data.username}<br><b>DepEd Email:</b> ${data.email}`;
                            document.getElementById('schoolModalMsg').innerHTML = msg;
                            schoolModal.style.display = 'block';
                            document.getElementById('schoolModalCancel').onclick = function() {
                                schoolModal.style.display = 'none';
                            };
                        } else {
                            showPage(2);
                        }
                    })
                    .catch(() => {
                        hideSpinner();
                        errorModal.style.display = 'block';
                        document.getElementById('errorModalMsg').textContent = 'A network or server error occurred. Please try again.';
                    });
            } else {
                showPage(2);
            }
        });
    }

    // Back button
    if (backPageBtn) {
        backPageBtn.addEventListener('click', function() { 
            showPage(1); 
        });
    }

    // --- Enable/disable Create Account button based on validation ---
    const createAccountBtn = signupForm ? signupForm.querySelector('button[type="submit"], input[type="submit"]') : null;

    function isPasswordValid(pw) {
        return (
            pw.length >= 8 &&
            /[A-Z]/.test(pw) &&
            /[a-z]/.test(pw) &&
            /\d/.test(pw) &&
            /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw)
        );
    }

    function checkFormValidity() {
        // Check for input errors and required fields
        const hasUsernameError = usernameTooltip && usernameTooltip.style.display === 'block';
        const hasEmailError = emailTooltip && emailTooltip.style.display === 'block';
        const hasPasswordError = passwordTooltip && passwordTooltip.style.display === 'block';
        const requiredFields = [
            document.getElementById('schoolName'),
            document.getElementById('district'),
            document.getElementById('division'),
            document.getElementById('region'),
            usernameInput,
            emailUserInput,
            passwordInput
        ];
        let allFilled = requiredFields.every(f => f && f.value && f.value.trim().length > 0);
        let noErrors = !hasUsernameError && !hasEmailError && !hasPasswordError;
        let passwordValid = passwordInput && isPasswordValid(passwordInput.value);
        if (createAccountBtn) {
            createAccountBtn.disabled = !(allFilled && noErrors && passwordValid);
        }
    }

    // Attach to all relevant input events
    [usernameInput, emailUserInput, passwordInput,
        document.getElementById('schoolName'),
        document.getElementById('district'),
        document.getElementById('division'),
        document.getElementById('region')
    ].forEach(function(input) {
        if (input) {
            input.addEventListener('input', checkFormValidity);
            input.addEventListener('blur', checkFormValidity);
        }
    });

    // Also call after each error check
    const origShowUsernameError = showUsernameError;
    const origShowEmailError = showEmailError;
    showUsernameError = function() { origShowUsernameError(); checkFormValidity(); };
    showEmailError = function() { origShowEmailError(); checkFormValidity(); };
    // showPasswordError now calls checkFormValidity itself

    // Initial state
    checkFormValidity();

    // --- Final submit ---
    if (signupForm) {
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            // Immediately show errors on submit
            showUsernameError();
            showEmailError();
            showPasswordError();

            setTimeout(() => {
                const hasUsernameError = usernameTooltip && usernameTooltip.style.display === 'block';
                const hasEmailError = emailTooltip && emailTooltip.style.display === 'block';
                const hasPasswordError = passwordTooltip && passwordTooltip.style.display === 'block';
                if (hasUsernameError || hasEmailError || hasPasswordError) {
                    return;
                }

                // Prepare form data
                const formData = new FormData(signupForm);
                // Add full email
                let existing = document.getElementById('fullEmailHidden');
                if (existing) existing.remove();
                if (emailUserInput) {
                    const hidden = document.createElement('input');
                    hidden.type = 'hidden';
                    hidden.name = 'email';
                    hidden.id = 'fullEmailHidden';
                    hidden.value = emailUserInput.value + '@deped.gov.ph';
                    signupForm.appendChild(hidden);
                    formData.set('email', hidden.value);
                }

                // Helper to actually submit (force=1 if needed)
                function doSubmit(force) {
                    showSpinner();
                    fetch('../../backend/signin/signin.php', {
                        method: 'POST',
                        body: formData
                    })
                    .then(res => res.headers.get('content-type') && res.headers.get('content-type').includes('application/json') ? res.json() : res.text())
                    .then(data => {
                        hideSpinner();
                        if (typeof data === 'object' && data !== null) {
                            if (data.success) {
                                // Show success modal and toast before refresh
                                successModal.style.display = 'block';
                                showSuccessToast();
                                // Add handler for Okay button
                                let okayBtn = document.getElementById('successModalOkay');
                                if (!okayBtn) {
                                    okayBtn = document.createElement('button');
                                    okayBtn.id = 'successModalOkay';
                                    okayBtn.className = 'login-button';
                                    okayBtn.style.margin = '2em auto 1em auto';
                                    okayBtn.style.minWidth = '120px';
                                    okayBtn.style.maxWidth = '200px';
                                    okayBtn.style.width = 'auto';
                                    okayBtn.textContent = 'Done!';
                                    successModal.querySelector('.modal-content').appendChild(okayBtn);
                                }
                                okayBtn.onclick = function() {
                                    successModal.style.display = 'none';
                                    window.location.reload();
                                };
                            } else if (data.exists) {
                                // Show modal for school account exists
                                const msg = `A user is already registered for this school.<br><br><b>Username:</b> ${data.username}<br><b>DepEd Email:</b> ${data.email}`;
                                document.getElementById('schoolModalMsg').innerHTML = msg;
                                schoolModal.style.display = 'block';
                                document.getElementById('schoolModalCancel').onclick = function() {
                                    schoolModal.style.display = 'none';
                                };
                            } else if (data.errors) {
                                errorModal.style.display = 'block';
                                document.getElementById('errorModalMsg').textContent = data.errors.join('\n');
                            }
                        } else {
                            // fallback: reload page or show error
                            document.body.innerHTML = data;
                        }
                    })
                    .catch(err => {
                        hideSpinner();
                        errorModal.style.display = 'block';
                        document.getElementById('errorModalMsg').textContent = 'A network or server error occurred. Please try again.';
                    });
                }

                // First, check for existing user with same school
                fetch('../../backend/signin/signin.php', {
                    method: 'POST',
                    body: formData
                })
                .then(res => res.headers.get('content-type') && res.headers.get('content-type').includes('application/json') ? res.json() : res.text())
                .then(data => {
                    if (typeof data === 'object' && data !== null && data.exists) {
                        // Show modal for school account exists, do not allow continue
                        const msg = `A user is already registered for this school.<br><br><b>Username:</b> ${data.username}<br><b>DepEd Email:</b> ${data.email}`;
                        document.getElementById('schoolModalMsg').innerHTML = msg;
                        schoolModal.style.display = 'block';
                        document.getElementById('schoolModalCancel').onclick = function() {
                            schoolModal.style.display = 'none';
                        };
                        return;
                    } else if (typeof data === 'object' && data !== null && data.success) {
                        // Show success modal and toast before refresh
                        successModal.style.display = 'block';
                        showSuccessToast();
                        // Add handler for Okay button
                        let okayBtn = document.getElementById('successModalOkay');
                        if (!okayBtn) {
                            okayBtn = document.createElement('button');
                            okayBtn.id = 'successModalOkay';
                            okayBtn.className = 'login-button';
                            okayBtn.style.margin = '2em auto 1em auto';
                            okayBtn.style.minWidth = '120px';
                            okayBtn.style.maxWidth = '200px';
                            okayBtn.style.width = 'auto';
                            okayBtn.textContent = 'Okay';
                            successModal.querySelector('.modal-content').appendChild(okayBtn);
                        }
                        okayBtn.onclick = function() {
                            successModal.style.display = 'none';
                            window.location.reload();
                        };
                    } else if (typeof data === 'object' && data !== null && data.errors) {
                        alert(data.errors.join('\n'));
                    } else {
                        // fallback: reload page or show error
                        document.body.innerHTML = data;
                    }
                })
                .catch(err => {
                    alert('An error occurred. Please try again.');
                });
            }, 10);
        });
    }
});