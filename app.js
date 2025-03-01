
// Initialize app
async function initializeNostr(pubkey) {
    try {
        updateStatus('Connecting...', false);
        
        if (!pubkey) {
            showLoginModal();
            return;
        }

        const sanitizedKey = sanitizePK(pubkey);
        localStorage.setItem('pk', sanitizedKey);
        
        await getInitial();
        await getNotes();
        subscribeToRelays();
    } catch (err) {
        console.error('Failed to initialize:', err);
        updateStatus('Connection failed', false);
    }
}

// Start app
document.addEventListener('DOMContentLoaded', () => {
    const savedKey = localStorage.getItem('pk');
    if (savedKey) {
        initializeNostr(savedKey);
    } else {
        showLoginModal();
    }
});

// Make functions available globally
window.refreshFeed = refreshFeed;
window.showLoginModal = showLoginModal;
window.closeModal = closeModal;
