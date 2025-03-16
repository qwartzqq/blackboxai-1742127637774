// Check authentication status
const checkAuth = () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = '/admin-login.html';
        return false;
    }
    return true;
};

// DOM Elements
const elements = {
    stats: {
        totalPastes: document.getElementById('totalPastes'),
        bannedIPs: document.getElementById('bannedIPs'),
        todayPastes: document.getElementById('todayPastes')
    },
    search: document.getElementById('searchInput'),
    filter: document.getElementById('filterStatus'),
    table: document.getElementById('pastesTableBody'),
    pagination: {
        prev: document.getElementById('prevPage'),
        next: document.getElementById('nextPage'),
        showing: document.getElementById('showingCount'),
        total: document.getElementById('totalCount')
    },
    ipBan: {
        input: document.getElementById('newIPBan'),
        button: document.getElementById('addIPBan'),
        list: document.getElementById('bannedIPsList')
    },
    logoutBtn: document.getElementById('logoutBtn')
};

// State management
let state = {
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    searchTerm: '',
    filterStatus: 'all'
};

// Utility Functions
const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
};

const showNotification = (message, type = 'success') => {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
    } text-white success-message`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
};

// API Calls
const fetchStats = async () => {
    try {
        const response = await fetch('/api/admin/stats', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch stats');
        
        const data = await response.json();
        elements.stats.totalPastes.textContent = data.totalPastes;
        elements.stats.bannedIPs.textContent = data.bannedIPs;
        elements.stats.todayPastes.textContent = data.todayPastes;
    } catch (error) {
        console.error('Error fetching stats:', error);
        showNotification('Failed to load statistics', 'error');
    }
};

const fetchPastes = async () => {
    try {
        const response = await fetch(`/api/admin/pastes?page=${state.currentPage}&limit=${state.itemsPerPage}&search=${state.searchTerm}&status=${state.filterStatus}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch pastes');
        
        const data = await response.json();
        renderPastes(data.pastes);
        updatePagination(data.total);
    } catch (error) {
        console.error('Error fetching pastes:', error);
        showNotification('Failed to load pastes', 'error');
    }
};

const deletePaste = async (id) => {
    try {
        const response = await fetch(`/api/admin/pastes/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to delete paste');
        
        showNotification('Paste deleted successfully');
        fetchPastes();
        fetchStats();
    } catch (error) {
        console.error('Error deleting paste:', error);
        showNotification('Failed to delete paste', 'error');
    }
};

const banIP = async (ip) => {
    try {
        const response = await fetch('/api/admin/ban', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            },
            body: JSON.stringify({ ip })
        });
        
        if (!response.ok) throw new Error('Failed to ban IP');
        
        showNotification('IP banned successfully');
        fetchBannedIPs();
        fetchStats();
    } catch (error) {
        console.error('Error banning IP:', error);
        showNotification('Failed to ban IP', 'error');
    }
};

const unbanIP = async (ip) => {
    try {
        const response = await fetch(`/api/admin/ban/${ip}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to unban IP');
        
        showNotification('IP unbanned successfully');
        fetchBannedIPs();
        fetchStats();
    } catch (error) {
        console.error('Error unbanning IP:', error);
        showNotification('Failed to unban IP', 'error');
    }
};

// Render Functions
const renderPastes = (pastes) => {
    elements.table.innerHTML = pastes.map(paste => `
        <tr class="border-t border-gray-700">
            <td class="py-3">${paste.title}</td>
            <td>${paste.ip}</td>
            <td>${formatDate(paste.timestamp)}</td>
            <td>
                <span class="px-2 py-1 rounded ${
                    paste.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                }">${paste.status}</span>
            </td>
            <td class="text-right">
                <button onclick="window.open('/p/${paste.id}')" 
                        class="text-blue-400 hover:text-blue-300 mr-2">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="deletePaste('${paste.id}')" 
                        class="text-red-400 hover:text-red-300 mr-2">
                    <i class="fas fa-trash"></i>
                </button>
                <button onclick="banIP('${paste.ip}')" 
                        class="text-yellow-400 hover:text-yellow-300">
                    <i class="fas fa-ban"></i>
                </button>
            </td>
        </tr>
    `).join('');
};

const updatePagination = (total) => {
    state.totalItems = total;
    elements.pagination.total.textContent = total;
    elements.pagination.showing.textContent = Math.min(state.itemsPerPage * state.currentPage, total);
    elements.pagination.prev.disabled = state.currentPage === 1;
    elements.pagination.next.disabled = state.currentPage * state.itemsPerPage >= total;
};

const renderBannedIPs = (ips) => {
    elements.ipBan.list.innerHTML = ips.map(ip => `
        <div class="flex justify-between items-center bg-gray-700 rounded p-3">
            <span>${ip}</span>
            <button onclick="unbanIP('${ip}')" 
                    class="text-red-400 hover:text-red-300">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
};

// Event Listeners
elements.search.addEventListener('input', (e) => {
    state.searchTerm = e.target.value;
    state.currentPage = 1;
    fetchPastes();
});

elements.filter.addEventListener('change', (e) => {
    state.filterStatus = e.target.value;
    state.currentPage = 1;
    fetchPastes();
});

elements.pagination.prev.addEventListener('click', () => {
    if (state.currentPage > 1) {
        state.currentPage--;
        fetchPastes();
    }
});

elements.pagination.next.addEventListener('click', () => {
    if (state.currentPage * state.itemsPerPage < state.totalItems) {
        state.currentPage++;
        fetchPastes();
    }
});

elements.ipBan.button.addEventListener('click', () => {
    const ip = elements.ipBan.input.value.trim();
    if (ip) {
        banIP(ip);
        elements.ipBan.input.value = '';
    }
});

elements.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin-login.html';
});

// Initialize
if (checkAuth()) {
    fetchStats();
    fetchPastes();
    fetchBannedIPs();
}
