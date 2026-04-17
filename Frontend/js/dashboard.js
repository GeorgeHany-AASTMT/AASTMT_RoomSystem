import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, updateDoc, doc, serverTimestamp, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const userJson = localStorage.getItem('user');
    if (!userJson) return window.location.href = 'login.html';
    
    const user = JSON.parse(userJson);
    const roleId = user.role_id;
    
    document.getElementById('userName').textContent = `${user.fullname} (${user.department})`;

    const permittedAdminRoles = [1, 2];
    if (permittedAdminRoles.includes(roleId)) { // Admin/Manager Panel Injection
        const navDiv = document.querySelector('nav .flex.items-center.gap-4:last-child');
        const adminBtn = document.createElement('a');
        adminBtn.href = 'admin.html';
        adminBtn.className = 'text-sm font-bold bg-white text-primary-container px-4 py-2 rounded-lg hover:bg-gray-200 transition-all mr-2';
        adminBtn.textContent = 'Control Panel';
        navDiv.insertBefore(adminBtn, document.getElementById('userName'));
    }

    const buttonsContainer = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.gap-6');
    
    // -- RBAC Constraint Mathematics --
    function getMinDateConstraint() {
        const now = new Date();
        if (roleId === 4) now.setHours(now.getHours() + 48); // Secretary strictly 48h
        else if (roleId === 3) now.setHours(now.getHours() + 24); // Employee strictly 24h
        // Admin (1) and Manager (2) bypass limits
        return now.toISOString().slice(0, 16);
    }

    // Modal Manager
    function openModal(type) {
        let title, fields;
        const minDate = getMinDateConstraint();
        const dateLimitWarning = (roleId === 4) ? 'Must be at least 48h in advance.' : (roleId === 3) ? 'Must be at least 24h in advance.' : '';

        if (type === 'lecture') {
            title = 'Lecture Room Booking';
            fields = `
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-bold text-gray-700">Course / Lecture Title</label>
                        <input id="bm-title" type="text" class="w-full mt-1 px-4 py-2 border rounded focus:ring-2 focus:ring-primary" required>
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-gray-700">Start Time <span class="text-xs text-red-500 font-normal">(${dateLimitWarning})</span></label>
                        <input id="bm-start" type="datetime-local" min="${minDate}" class="w-full mt-1 px-4 py-2 border rounded focus:ring-2 focus:ring-primary" required>
                    </div>
                </div>
            `;
        } else {
            title = 'Multi-Purpose Room Booking';
            fields = `
                 <div class="space-y-2">
                    <div>
                        <label class="block text-sm font-bold text-gray-700">Purpose of Event</label>
                        <input id="bm-title" type="text" class="w-full mt-1 px-4 py-2 border rounded focus:ring-2 focus:ring-primary" required>
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-gray-700">Start Time <span class="text-xs text-red-500 font-normal">(${dateLimitWarning})</span></label>
                        <input id="bm-start" type="datetime-local" min="${minDate}" class="w-full mt-1 px-4 py-2 border rounded focus:ring-2 focus:ring-primary" required>
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-gray-700">Expected Attendance Count</label>
                        <input id="bm-count" type="number" class="w-full mt-1 px-4 py-2 border rounded focus:ring-2 focus:ring-primary" required>
                    </div>
                    <div class="flex gap-4">
                        <label class="flex items-center gap-2"><input id="bm-equip" type="checkbox"> Needs Equipment</label>
                        <label class="flex items-center gap-2"><input id="bm-guests" type="checkbox"> External Guests</label>
                    </div>
                </div>
            `;
        }

        const modalHtml = `
            <div id="bookingModal" class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <div class="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in-up">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-headline font-bold text-xl">${title}</h3>
                        <button onclick="document.getElementById('bookingModal').remove()" class="material-symbols-outlined text-gray-400 hover:text-black">close</button>
                    </div>
                    <form id="submitBookingForm">
                        ${fields}
                        <button type="submit" class="w-full bg-secondary text-white font-bold py-3 mt-6 rounded-xl hover:opacity-90">Confirm Request</button>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('submitBookingForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.textContent = 'Submitting...'; btn.disabled = true;

            // -- Role-Based Workflow Logic --
            let finalStatus = 'Pending';
            let notifyAdmin = false;

            if (roleId === 1) { // Admin
                if (type === 'lecture') finalStatus = 'Approved';
                else finalStatus = 'Pending'; // Remains Pending for Branch Manager
            } else if (roleId === 2) { // Branch Manager
                finalStatus = 'Approved'; 
                notifyAdmin = true; // Will send message to Admin mailbox
            } else {
                finalStatus = 'Pending'; // Employees and Secretaries always wait
            }

            const payload = {
                user_id: user.uid,
                fullname: user.fullname,
                emp_id: user.emp_id,
                department: user.department,
                room_type: type,
                title: document.getElementById('bm-title').value,
                start_time: document.getElementById('bm-start').value,
                status: finalStatus,
                created_at: serverTimestamp(),
            };

            if(type === 'multi_purpose') {
                payload.attendance_count = document.getElementById('bm-count').value;
                payload.needs_equipment = document.getElementById('bm-equip').checked;
                payload.external_guests = document.getElementById('bm-guests').checked;
            }

            try {
                await addDoc(collection(db, "Bookings"), payload);
                
                if (notifyAdmin) {
                    await addDoc(collection(db, "Messages"), {
                        to: "admin",
                        from: user.fullname,
                        msg: `The Branch Manager (${user.fullname}) has requested the room: ${document.getElementById('bm-title').value}.`,
                        created_at: serverTimestamp()
                    });
                }

                alert('Booking successfully processed!');
                document.getElementById('bookingModal').remove();
                loadStats();
            } catch (err) {
                alert('Database Error: ' + err.message);
                btn.textContent = 'Confirm Request'; btn.disabled = false;
            }
        });
    }

    // -- Real-Time Booking Synchronization --
    function initBookingSync() {
        // My Bookings Table (Real-Time)
        const qAll = query(collection(db, "Bookings"), where("user_id", "==", user.uid));
        onSnapshot(qAll, (snap) => {
            const tbody = document.getElementById('myBookingsTable');
            if (snap.empty) {
                tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500 italic">No bookings found.</td></tr>';
                return;
            }
            let html = '';
            snap.forEach(d => {
                const data = d.data();
                const statusClass = (data.status === 'Approved') ? 'text-green-700 bg-green-100' : 
                                  (data.status === 'Rejected') ? 'text-red-700 bg-red-100' : 'text-yellow-700 bg-yellow-100';
                html += `
                    <tr class="border-b hover:bg-gray-50">
                        <td class="p-4 capitalize font-medium">${data.room_type.replace('_', ' ')}</td>
                        <td class="p-4 font-bold text-primary">${data.title}</td>
                        <td class="p-4 text-xs font-mono">${data.start_time.replace('T', ' ')}</td>
                        <td class="p-4"><span class="px-2 py-1 rounded-full text-[10px] font-black uppercase ${statusClass}">${data.status}</span></td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        });
    }

    initBookingSync();

    window.openModal = openModal; // Bind to window so inline onclick works from dynamically built buttons

    // Routing Logic to inject actionable buttons
    function createLectureButton() {
        return `
            <button onclick="openModal('lecture')" class="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary hover:bg-blue-50 transition-all group">
                <span class="material-symbols-outlined text-4xl text-gray-400 group-hover:text-primary mb-3">meeting_room</span>
                <span class="font-bold text-lg text-gray-700 group-hover:text-primary">Lecture Room</span>
                <span class="text-sm text-gray-500 mt-2">Book standard academic rooms</span>
            </button>
        `;
    }

    function createMultiPurposeButton() {
        return `
            <button onclick="openModal('multi_purpose')" class="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-xl hover:border-secondary hover:bg-yellow-50 transition-all group">
                <span class="material-symbols-outlined text-4xl text-gray-400 group-hover:text-secondary mb-3">celebration</span>
                <span class="font-bold text-lg text-gray-700 group-hover:text-secondary">Multi-Purpose Room</span>
                <span class="text-sm text-gray-500 mt-2">Requires administrative approval</span>
            </button>
        `;
    }

    if (roleId === 1) buttonsContainer.innerHTML = createLectureButton() + createMultiPurposeButton();
    else if (roleId === 2) buttonsContainer.innerHTML = `<p class="italic p-8">Branch Manager View: Check the Admin Portal to approve Multi-Purpose requests.</p>`;
    else if (roleId === 3) buttonsContainer.innerHTML = createLectureButton() + createMultiPurposeButton();
    else if (roleId === 4) buttonsContainer.innerHTML = `
        <div class="col-span-2">${createMultiPurposeButton()}</div>
        <p class="text-xs text-center col-span-2 text-gray-500">College Secretaries are explicitly restricted to Multi-Purpose room schedules.</p>
    `;

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        try {
            await signOut(auth);
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        } catch(e) {}
    });
});
