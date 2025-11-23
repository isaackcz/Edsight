document.addEventListener("DOMContentLoaded", function () {
  const forgotPasswordForm = document.getElementById("forgotPasswordForm");
  const emailInput = document.getElementById("email");

  // Helper to reset error states
  function resetErrors() {
    const errorMsg = document.getElementById("forgotPasswordErrorMsg");
    if (errorMsg) errorMsg.remove();
    
    const successMsg = document.getElementById("forgotPasswordSuccessMsg");
    if (successMsg) successMsg.remove();
    
    emailInput.classList.remove("input-error");
  }

  // Helper to show error
  function showError(msg) {
    resetErrors();
    
    const errorMsg = document.createElement("div");
    errorMsg.id = "forgotPasswordErrorMsg";
    errorMsg.className = "error-message";
    
    const formGroup = forgotPasswordForm.querySelector(".form-group");
    if (formGroup) {
      forgotPasswordForm.insertBefore(errorMsg, formGroup);
    } else {
      forgotPasswordForm.insertBefore(errorMsg, forgotPasswordForm.firstChild);
    }
    
    errorMsg.textContent = msg;
    emailInput.classList.add("input-error");
  }

  // Helper to show success message
  function showSuccess(msg) {
    resetErrors();
    
    const successMsg = document.createElement("div");
    successMsg.id = "forgotPasswordSuccessMsg";
    successMsg.className = "success-message";
    successMsg.innerHTML = `<i class="ph ph-bold ph-check-circle"></i> ${msg}`;
    
    const formGroup = forgotPasswordForm.querySelector(".form-group");
    if (formGroup) {
      forgotPasswordForm.insertBefore(successMsg, formGroup);
    } else {
      forgotPasswordForm.insertBefore(successMsg, forgotPasswordForm.firstChild);
    }
  }

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", function (e) {
      e.preventDefault();
      resetErrors();
      
      const emailUser = emailInput ? emailInput.value.trim() : "";
      
      if (!emailUser) {
        showError("Please enter your email address.");
        emailInput.focus();
        return;
      }

      // Construct full email
      const email = emailUser.includes("@")
        ? emailUser
        : emailUser + "@deped.gov.ph";

      // Show loading state
      const submitBtn = forgotPasswordForm.querySelector('button[type="submit"]');
      let originalBtnHTML = null;
      if (submitBtn) {
        originalBtnHTML = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML =
          '<i class="ph ph-bold ph-circle-notch ph-spin"></i> Sending...';
      }

      fetch("/auth/forgot-password/submit/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
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
            // Show success message
            showSuccess(
              data.message || 
              "If this email exists in our system, a password reset link has been sent to your email."
            );
            // Clear the form
            emailInput.value = "";
            // Scroll to success message
            const successMsg = document.getElementById("forgotPasswordSuccessMsg");
            if (successMsg) {
              successMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          } else {
            // Show error message
            showError(data.error || "An error occurred. Please try again.");
            emailInput.focus();
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          showError("Network error. Please check your connection and try again.");
          emailInput.focus();
        })
        .finally(() => {
          // Reset loading state
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML || "Send Reset Link";
          }
        });
    });
  }
});

