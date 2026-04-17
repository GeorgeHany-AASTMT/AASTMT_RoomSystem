import { auth, db } from './firebase-config.js';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verify Admin Status
    const userJson = localStorage.getItem('user');
    if (!userJson) return window.location.href = 'login.html';
    
    const user = JSON.parse(userJson);
    const permittedRoles = [1, 2];
    if (!permittedRoles.includes(user.role_id)) {
        alert('Access Denied. Insufficient Permissions.');
        window.location.href = 'dashboard.html';
        return;
    }
    const roleName = user.role_id === 1 ? 'Admin' : 'Branch Manager';
    document.getElementById('adminName').textContent = user.fullname + ' (' + roleName + ')';

    const tabPending = document.getElementById('tab-pending');
    const tabBookings = document.getElementById('tab-bookings');
    const tabMailbox = document.getElementById('tab-mailbox');
    const tabDelegation = document.getElementById('tab-delegation');
    const tabOverrides = document.getElementById('tab-overrides');
    
    const secPending = document.getElementById('section-pending');
    const secBookings = document.getElementById('section-bookings');
    const secMailbox = document.getElementById('section-mailbox');
    const secDelegation = document.getElementById('section-delegation');
    const secOverrides = document.getElementById('section-overrides');

    // Role-Based Tab Visibility (CRITICAL)
    if (user.role_id === 2) { // Branch Manager
        [tabPending, tabMailbox, tabDelegation, tabOverrides].forEach(t => t.classList.add('hidden'));
        setActiveTab(tabBookings, secBookings);
        loadBookings();
    } else {
        setActiveTab(tabPending, secPending);
        loadPendingUsers();
    }

    function resetTabs() {
        [tabPending, tabBookings, tabMailbox, tabDelegation, tabOverrides].forEach(t => {
            t.classList.remove('bg-primary-container', 'text-white');
            t.classList.add('bg-surface-container-highest', 'text-gray-700');
        });
        [secPending, secBookings, secMailbox, secDelegation, secOverrides].forEach(s => s.classList.add('hidden'));
    }

    function setActiveTab(tab, sec) {
        resetTabs();
        tab.classList.replace('bg-surface-container-highest', 'bg-primary-container');
        tab.classList.replace('text-gray-700', 'text-white');
        sec.classList.remove('hidden');
    }

    tabPending.addEventListener('click', () => {
        setActiveTab(tabPending, secPending);
        loadPendingUsers();
    });

    tabBookings.addEventListener('click', () => {
        setActiveTab(tabBookings, secBookings);
        loadBookings();
    });

    tabMailbox.addEventListener('click', () => {
        setActiveTab(tabMailbox, secMailbox);
        loadMessages();
    });

    tabDelegation.addEventListener('click', () => {
        setActiveTab(tabDelegation, secDelegation);
    });

    tabOverrides.addEventListener('click', () => {
        setActiveTab(tabOverrides, secOverrides);
        loadActiveUsers();
    });

    // 2. Fetch Booking Requests (Real-Time)
    function loadBookings() {
        const tbody = document.getElementById('bookingsTable');
        const q = query(collection(db, "Bookings"), orderBy("created_at", "desc"));
        
        onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center">No bookings found.</td></tr>';
                return;
            }

            let html = '';
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const dateStr = data.start_time ? data.start_time.replace('T', ' ') : 'N/A';
                
                // Status Color Logic
                let statusClass = 'text-gray-500 bg-gray-100';
                if (data.status === 'Pending') statusClass = 'text-yellow-700 bg-yellow-100';
                if (data.status === 'Approved') statusClass = 'text-green-700 bg-green-100';
                if (data.status === 'Rejected') statusClass = 'text-red-700 bg-red-100';

                // Action Logic
                let actions = '';
                if (user.role_id === 2) { // Branch Manager (Primary Approver)
                    if (data.status === 'Pending') {
                        actions = `<button onclick="handleBooking('${docSnap.id}', 'Approved')" class="bg-secondary text-white px-3 py-1 rounded text-xs font-bold shadow-sm">Approve</button>`;
                    }
                } else if (user.role_id === 1) { // Admin
                    if (data.status === 'Pending') {
                        actions = `<button onclick="handleBooking('${docSnap.id}', 'Approved')" class="bg-primary text-white px-3 py-1 rounded text-xs font-bold">Admin Force Approve</button>`;
                    }
                }

                if (data.status === 'Pending') {
                    actions += ` <button onclick="handleBooking('${docSnap.id}', 'Rejected')" class="bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded text-xs font-bold ml-1">Reject</button>`;
                }

                html += `
                    <tr class="border-b hover:bg-gray-50">
                        <td class="p-4 capitalize font-medium">${data.room_type.replace('_', ' ')}</td>
                        <td class="p-4 font-bold text-primary">${data.title}</td>
                        <td class="p-4">
                            <div class="font-bold">${data.fullname || 'Unknown'}</div>
                            <div class="text-xs text-gray-500">Dept: ${data.department}</div>
                        </td>
                        <td class="p-4 text-xs font-mono">${dateStr}</td>
                        <td class="p-4"><span class="px-2 py-1 rounded-full text-[10px] font-black uppercase ${statusClass}">${data.status}</span></td>
                        <td class="p-4">${actions}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        });
    }

    // 3. Fetch Admin Mailbox (Real-Time)
    function loadMessages() {
        const container = document.getElementById('mailboxList');
        const q = query(collection(db, "Messages"), where("to", "==", "admin"), orderBy("created_at", "desc"));
        
        onSnapshot(q, (snap) => {
            if (snap.empty) {
                container.innerHTML = '<p class="text-center py-8 text-gray-500 italic">No new messages.</p>';
                return;
            }

            let html = '';
            snap.forEach(d => {
                const data = d.data();
                const timeStr = data.created_at ? data.created_at.toDate().toLocaleString() : 'Just now';
                html += `
                    <div class="bg-blue-50 p-4 border-l-4 border-primary rounded shadow-sm">
                        <div class="flex justify-between items-start mb-2">
                            <span class="font-bold text-primary-container">From: ${data.from}</span>
                            <span class="text-xs text-gray-500">${timeStr}</span>
                        </div>
                        <p class="text-sm text-gray-700 font-medium">${data.msg}</p>
                    </div>
                `;
            });
            container.innerHTML = html;
        });
    }

    // -- Role Delegation --
    window.handleDelegation = async () => {
        const empId = document.getElementById('delegateEmpId').value;
        if (!empId) return alert('Enter an Employee ID');

        if (!confirm(`Delegate Admin privileges to Employee ID: ${empId}?`)) return;

        try {
            const q = query(collection(db, "Users"), where("emp_id", "==", empId));
            const snap = await getDocs(q);
            if (snap.empty) return alert('Employee not found!');

            const userDoc = snap.docs[0];
            await updateDoc(doc(db, "Users", userDoc.id), { role_id: 1 });
            alert('Delegation Successful. Role updated to Admin.');
            document.getElementById('delegateEmpId').value = '';
        } catch(e) { alert(e.message); }
    };

    // 3. Fetch Pending Users
    async function loadPendingUsers() {
        const tbody = document.getElementById('pendingUsersTable');
        try {
            const q = query(collection(db, "Users"), where("is_active", "==", false));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center font-medium">No pending requests.</td></tr>';
                return;
            }

            let html = '';
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                html += `
                    <tr class="border-b hover:bg-gray-50 transition">
                        <td class="p-4 font-bold">${data.emp_id}</td>
                        <td class="p-4">${data.fullname}</td>
                        <td class="p-4">${data.department}</td>
                        <td class="p-4 text-gray-500">${data.email}</td>
                        <td class="p-4 flex gap-2">
                            <button onclick="approveUser('${docSnap.id}')" class="bg-green-100 text-green-700 px-3 py-1 rounded font-bold hover:bg-green-200">Approve</button>
                            <button onclick="rejectUser('${docSnap.id}')" class="bg-red-100 text-red-700 px-3 py-1 rounded font-bold hover:bg-red-200">Reject</button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        } catch (err) {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-600">Error loading data.</td></tr>';
        }
    }

    // 3. Fetch Active Users for Overrides
    async function loadActiveUsers() {
        const tbody = document.getElementById('activeUsersTable');
        try {
            const q = query(collection(db, "Users"), where("is_active", "==", true));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) return;

            let html = '';
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.role_id === 1) return; // Skip admins

                const roleMap = {2: 'Branch Manager', 3: 'Employee', 4: 'Secretary'};
                const hasViewOverride = data.can_view_rooms ? 'Yes' : 'No';
                const toggleColor = data.can_view_rooms ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700';

                html += `
                    <tr class="border-b hover:bg-gray-50 transition">
                        <td class="p-4 font-bold">${data.fullname}</td>
                        <td class="p-4"><span class="px-2 py-1 rounded bg-gray-200 text-xs font-bold">${roleMap[data.role_id]}</span></td>
                        <td class="p-4 font-medium">${hasViewOverride}</td>
                        <td class="p-4 text-gray-500">${data.delegation_to || 'None'}</td>
                        <td class="p-4 flex gap-2">
                            <button onclick="toggleOverride('${docSnap.id}', ${!data.can_view_rooms})" class="${toggleColor} px-3 py-1 rounded font-bold hover:opacity-80 transition">Toggle View View</button>
                            <button onclick="openDelegateModal('${docSnap.id}')" class="bg-gray-800 text-white px-3 py-1 rounded font-bold hover:bg-gray-700 transition">Delegate</button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        } catch (err) {
            console.error(err);
        }
    }

    // Assigning to window so inline onclick can use them
    window.approveUser = async (uid) => {
        if(!confirm('Approve this user?')) return;
        try {
            await updateDoc(doc(db, "Users", uid), { is_active: true });
            loadPendingUsers();
        } catch(e) { alert(e.message); }
    };

    window.rejectUser = async (uid) => {
        if(!confirm('Reject and delete this request permanently?')) return;
        try {
            await deleteDoc(doc(db, "Users", uid));
            loadPendingUsers();
        } catch(e) { alert(e.message); }
    };

    window.handleBooking = async (bid, newStatus) => {
        const action = newStatus === 'Rejected' ? 'reject' : 'approve';
        if(!confirm(`Are you sure you want to ${action} this booking?`)) return;
        
        try {
            const updatePayload = { status: newStatus };
            if (newStatus === 'Rejected') {
                const reason = prompt("Enter rejection reason (optional):");
                if (reason) updatePayload.rejection_reason = reason;
            }
            await updateDoc(doc(db, "Bookings", bid), updatePayload);
            loadBookings();
        } catch(e) { alert('Update failed: ' + e.message); }
    };

    window.toggleOverride = async (uid, newValue) => {
        try {
            await updateDoc(doc(db, "Users", uid), { can_view_rooms: newValue });
            loadActiveUsers();
        } catch(e) { alert(e.message); }
    };

    window.openDelegateModal = (uid) => {
        const subId = prompt("Enter the Employee ID of the Substitute User:");
        if (subId) {
            updateDoc(doc(db, "Users", uid), { delegation_to: subId })
                .then(() => loadActiveUsers())
                .catch(e => alert(e.message));
        }
    };

    // Load Default Table
    loadPendingUsers();
});
