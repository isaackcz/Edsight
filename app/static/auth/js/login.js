document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");
  const emailUserInput = document.getElementById("emailUser");
  const passwordInput = document.getElementById("password");

  // Helper to reset error states
  function resetErrors() {
    // Do not modify input border classes; just remove any existing error message
    let errMsg = document.getElementById("loginErrorMsg");
    if (errMsg) errMsg.remove();
  }

  // Helper to show error
  function showError(msg) {
    let errMsg = document.getElementById("loginErrorMsg");
    if (!errMsg) {
      errMsg = document.createElement("div");
      errMsg.id = "loginErrorMsg";
      errMsg.className = "error-message";
      // Insert above the email group if present, otherwise fall back to previous locations
      const emailGroup = loginForm.querySelector(".email-group");
      const formOptions = loginForm.querySelector(".form-options");
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      if (emailGroup) loginForm.insertBefore(errMsg, emailGroup);
      else if (formOptions) loginForm.insertBefore(errMsg, formOptions);
      else if (submitBtn) loginForm.insertBefore(errMsg, submitBtn);
      else loginForm.insertBefore(errMsg, loginForm.firstChild);
    }
    errMsg.textContent = msg;
  }

  // Password show/hide toggle
  const togglePasswordBtn = document.querySelector(".toggle-password");
  if (togglePasswordBtn && passwordInput) {
    // Ensure initial aria state
    togglePasswordBtn.setAttribute("aria-pressed", "false");
    togglePasswordBtn.setAttribute("aria-label", "Show password");

    togglePasswordBtn.addEventListener("click", function () {
      const isHidden = passwordInput.type === "password";
      passwordInput.type = isHidden ? "text" : "password";

      // Update Phosphor icon classes: ph-eye <-> ph-eye-slash
      const icon = this.querySelector("i");
      if (icon) {
        // remove both possible icon classes then add the correct one
        icon.classList.remove("ph-eye", "ph-eye-slash");
        icon.classList.add(isHidden ? "ph-eye-slash" : "ph-eye");
      }

      // Update aria attributes for accessibility
      this.setAttribute("aria-pressed", String(isHidden));
      this.setAttribute(
        "aria-label",
        isHidden ? "Hide password" : "Show password"
      );
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      resetErrors();
      const emailUser = emailUserInput ? emailUserInput.value.trim() : "";
      const password = passwordInput ? passwordInput.value : "";
      let valid = true;
      if (!emailUser) {
        valid = false;
      }
      // If password input exists, require it. Otherwise proceed as an email-first flow.
      if (passwordInput && !password) {
        valid = false;
      }
      if (!valid) {
        showError(
          passwordInput
            ? "Please enter your email and password."
            : "Please enter your email."
        );
        return;
      }
      const email = emailUser.includes("@")
        ? emailUser
        : emailUser + "@deped.gov.ph";
      const next = document.getElementById("next").value;

      // Show loading state
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      let originalBtnHTML = null;
      if (submitBtn) {
        originalBtnHTML = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Logging in...';
      }

      fetch("/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, next }),
      })
        .then((res) =>
          res
            .json()
            .then((data) => ({ status: res.status, data }))
            .catch((err) => {
              console.error("JSON parse error:", err);
              return {
                status: res.status,
                data: { error: "Invalid server response" },
              };
            })
        )
        .then(({ status, data }) => {
          if (status === 200 && data.success) {
            // Store user data if needed
            if (data.user) {
              localStorage.setItem("user", JSON.stringify(data.user));
            }
            // Store token for API access
            if (data.token) {
              localStorage.setItem("auth_token", data.token);
            }
            // Redirect to the specified URL
            window.location.href = data.redirect || "/user-dashboard/";
          } else {
            showError(data.error || "Invalid email or password.");
          }
        })
        .catch(() => {
          showError("Network error. Please try again.");
        })
        .finally(() => {
          // Reset loading state
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML || "Login";
          }
        });
    });
  }
});
