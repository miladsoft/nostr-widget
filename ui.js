
// UI Elements
const notesSection = document.getElementById('notes');
const statusText = document.querySelector('.status-text');
const statusIndicator = document.querySelector('.status-indicator');
const loginModal = document.getElementById('login-modal');

function updateStatus(message, isConnected) {
    statusText.textContent = message;
    statusIndicator.classList.toggle('offline', !isConnected);
}

function showLoginModal() {
    loginModal.showModal();
}

function closeModal() {
    loginModal.close();
}

function refreshFeed() {
    const refreshBtn = document.querySelector('.header-buttons button');
    refreshBtn.disabled = true;
    refreshBtn.querySelector('i').classList.add('mdi-spin');
    
    // Reset feed
    notesSection.innerHTML = '';
    seenPosts.clear();
    
    // Refresh data
    getNotes().finally(() => {
        refreshBtn.disabled = false;
        refreshBtn.querySelector('i').classList.remove('mdi-spin');
    });
}

// Initialize UI components
document.addEventListener('DOMContentLoaded', () => {
    // Start clock updates
    updateTime();
    setInterval(updateTime, 1000);
    
    // Handle modal form submission
    loginModal.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = e.target.querySelector('input');
        if (input.value) {
            initializeNostr(input.value);
            loginModal.close();
        }
    });
});
