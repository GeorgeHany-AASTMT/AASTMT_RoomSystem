import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');
    const alertBox = document.getElementById('alertBox');
    const alertMsg = document.getElementById('alertMsg');
    const alertIcon = document.getElementById('alertIcon');

    function showAlert(msg, isError = true) {
        alertMsg.textContent = msg;
        alertBox.classList.remove('hidden');
        if (isError) {
            alertBox.classList.replace('bg-green-100', 'bg-error-container/30');
            alertBox.classList.replace('border-green-400', 'border-error/20');
            alertIcon.textContent = 'error';
            alertIcon.classList.replace('text-green-600', 'text-error');
        } else {
            alertBox.classList.replace('bg-error-container/30', 'bg-green-100');
            alertBox.classList.replace('border-error/20', 'border-green-400');
            alertIcon.textContent = 'check_circle';
            alertIcon.classList.replace('text-error', 'text-green-600');
        }
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (password !== confirmPassword) {
                showAlert('Passwords do not match.');
                return;
            }

            const email = document.getElementById('email').value;
            const empId = document.getElementById('emp-id').value;

            // SRD Prefix Routing Logic
            const prefix = empId.charAt(0);
            let targetRole = 3; // Default Employee
            if (prefix === '1') targetRole = 1; // Admin
            else if (prefix === '2') targetRole = 2; // Branch Manager
            else if (prefix === '3') targetRole = 3; // Employee
            else if (prefix === '4') targetRole = 4; // Secretary
            
            const payload = {
                fullname: document.getElementById('fullname').value,
                emp_id: empId,
                department: document.getElementById('dept').value,
                email: email,
                ssn: document.getElementById('ssn').value,
                birthday: document.getElementById('birthday').value,
                role_id: targetRole,
                is_active: (targetRole === 1) ? true : false, // Admins auto-approve. Others require Admin dashboard.
                can_view_rooms: (targetRole === 1) // Admins can view rooms by default
            };

            // Basic UI Loading state
            const submitBtn = signupForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Processing... <span class="material-symbols-outlined animate-spin">refresh</span>';

            try {
                // Create user in Firebase Auth
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                // Store extra fields securely in Firestore mapped by user's UID
                await setDoc(doc(db, "Users", userCredential.user.uid), payload);

                showAlert('Registration successful! Pending administrator approval.', false);
                signupForm.reset();
                setTimeout(() => window.location.href = 'login.html', 3000);
            } catch (err) {
                // Show friendly errors
                let errMsg = err.message;
                if (err.code === 'auth/email-already-in-use') errMsg = 'This email is already registered.';
                if (err.code === 'auth/weak-password') errMsg = 'Password should be at least 6 characters.';
                
                showAlert(errMsg);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Request Access <span class="material-symbols-outlined">arrow_forward</span>';
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emp_id = document.getElementById('emp-id').value;
            const password = document.getElementById('password').value;
            
            // Wait, standard login requires email not emp_id in Firebase!
            // But UI accepts Employee ID. We have to map EmpID -> Email, or user inputs Email in Login UI!
            // Let's assume for ease without backend, we alert the user if they don't enter an Email string.
            if (!emp_id.includes('@')) {
                showAlert('Please enter your Email Address instead of Employee ID for Firebase Login.');
                return;
            }

            const email = emp_id;

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Authenticating... <span class="material-symbols-outlined animate-spin">refresh</span>';

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                
                // Fetch user data
                const userDoc = await getDoc(doc(db, "Users", userCredential.user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    
                    if (userData.is_active === false) {
                        // User exists but has not been approved yet
                        showAlert('Your account is still pending administrator approval.');
                        // Sign them back out
                        await auth.signOut();
                    } else {
                        // Approved! Save locally for fast dashboard access
                        localStorage.setItem('user', JSON.stringify({
                            uid: userCredential.user.uid,
                            ...userData
                        }));
                        showAlert('Login successful.', false);
                        setTimeout(() => window.location.href = 'dashboard.html', 1000);
                    }
                } else {
                    showAlert('Account data not found in Database.');
                }
            } catch (err) {
                let errMsg = err.message;
                if (err.code === 'auth/invalid-credential') errMsg = 'Invalid email or password.';
                showAlert(errMsg);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Sign In <span class="material-symbols-outlined">login</span>';
            }
        });
    }
});
