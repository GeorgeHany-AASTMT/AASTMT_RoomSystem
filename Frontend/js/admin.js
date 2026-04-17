import { auth, db } from './firebase-config.js';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verify Admin Status
    const userJson = localStorage.getItem('user');
    if (!userJson) return window.location.href = 'login.html';
    
    const user = JSON.parse(userJson);
    if (user.role_id !== 1) {
        alert('Access Denied. You are not an Admin.');
        window.location.href = 'dashboard.html';
        return;
    }
    document.getElementById('adminName').textContent = user.name + ' (Admin)';

    // Tab Logic
    const tabPending = document.getElementById('tab-pending');
    const tabOverrides = document.getElementById('tab-overrides');
    const secPending = document.getElementById('section-pending');
    const secOverrides = document.getElementById('section-overrides');

    tabPending.addEventListener('click', () => {
        tabPending.classList.replace('bg-surface-container-highest', 'bg-primary-container');
        tabPending.classList.replace('text-gray-700', 'text-white');
        tabOverrides.classList.replace('bg-primary-container', 'bg-surface-container-highest');
        tabOverrides.classList.replace('text-white', 'text-gray-700');
        secPending.classList.remove('hidden');
        secOverrides.classList.add('hidden');
    });

    tabOverrides.addEventListener('click', () => {
        tabOverrides.classList.replace('bg-surface-container-highest', 'bg-primary-container');
        tabOverrides.classList.replace('text-gray-700', 'text-white');
        tabPending.classList.replace('bg-primary-container', 'bg-surface-container-highest');
        tabPending.classList.replace('text-white', 'text-gray-700');
        secOverrides.classList.remove('hidden');
        secPending.classList.add('hidden');
        loadActiveUsers();
    });

    // 2. Fetch Pending Users
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
