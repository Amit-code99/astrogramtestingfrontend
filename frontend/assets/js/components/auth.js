import { api, setToken, setCurrentUser } from '../api.js';
import { navigate, showToast } from '../app.js';

export const renderAuth = (container) => {
    // Create container
    const authContainer = document.createElement('div');
    authContainer.className = 'auth-container';
    
    // Create box
    const authBox = document.createElement('div');
    authBox.className = 'auth-box';
    
    const title = document.createElement('h1');
    title.textContent = 'Astrogram';
    authBox.appendChild(title);
    
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Enter your email to receive an OTP';
    subtitle.style.color = 'var(--text-secondary)';
    subtitle.style.marginBottom = '24px';
    subtitle.style.fontSize = '14px';
    subtitle.style.textAlign = 'center';
    authBox.appendChild(subtitle);
    
    // Form
    const form = document.createElement('form');
    form.className = 'auth-form';
    form.id = 'auth-form';
    
    // Email Input
    const emailGroup = document.createElement('div');
    emailGroup.className = 'input-group';
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.placeholder = 'Email address';
    emailInput.required = true;
    emailGroup.appendChild(emailInput);
    
    // OTP Input (hidden initially)
    const otpGroup = document.createElement('div');
    otpGroup.className = 'input-group';
    otpGroup.style.display = 'none';
    const otpInput = document.createElement('input');
    otpInput.type = 'text';
    otpInput.placeholder = '6-digit OTP code';
    otpGroup.appendChild(otpInput);
    
    // Submit Button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn-primary';
    submitBtn.textContent = 'Send OTP';
    
    // Back button to reset to email mode
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn-primary';
    backBtn.textContent = 'Back to Email';
    backBtn.style.backgroundColor = 'transparent';
    backBtn.style.color = 'var(--text-secondary)';
    backBtn.style.marginTop = '8px';
    backBtn.style.display = 'none';
    
    form.appendChild(emailGroup);
    form.appendChild(otpGroup);
    form.appendChild(submitBtn);
    form.appendChild(backBtn);
    
    authBox.appendChild(form);
    authContainer.appendChild(authBox);
    container.appendChild(authContainer);
    
    let state = 'request_otp'; // can be 'request_otp' or 'verify_otp'
    
    backBtn.addEventListener('click', () => {
        state = 'request_otp';
        otpGroup.style.display = 'none';
        otpInput.required = false;
        emailInput.disabled = false;
        submitBtn.textContent = 'Send OTP';
        backBtn.style.display = 'none';
        subtitle.textContent = 'Enter your email to receive an OTP';
    });

    // Handle Form Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        submitBtn.disabled = true;
        
        try {
            if (state === 'request_otp') {
                const email = emailInput.value;
                submitBtn.textContent = 'Sending...';
                await api.sendOtp(email);
                
                showToast('OTP sent to your email');
                state = 'verify_otp';
                
                // Update UI for OTP verification
                emailInput.disabled = true;
                otpGroup.style.display = 'block';
                otpInput.required = true;
                otpInput.value = '';
                submitBtn.textContent = 'Verify & Log In';
                backBtn.style.display = 'block';
                subtitle.textContent = `Enter the OTP sent to ${email}`;
                
            } else if (state === 'verify_otp') {
                const email = emailInput.value;
                const otp = otpInput.value;
                submitBtn.textContent = 'Verifying...';
                
                const res = await api.verifyOtp(email, otp);
                
                if (res && res.data && res.data.accessToken) {
                    setToken(res.data.accessToken);
                    setCurrentUser(res.data.user);
                } else if (res && res.token) {
                    setToken(res.token);
                    setCurrentUser(res.user);
                } else {
                    // Fallback stub user for testing if no user returned but success
                    setCurrentUser({ email });
                }
                
                showToast('Logged in successfully!');
                navigate('feed');
            }
        } catch (error) {
            showToast(error.message || 'Authentication failed', 'error');
            // reset button state on error
            submitBtn.textContent = state === 'request_otp' ? 'Send OTP' : 'Verify & Log In';
        } finally {
            submitBtn.disabled = false;
        }
    });
};
