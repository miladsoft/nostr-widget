// Global error handler
window.onerror = function(msg, url, line) {
    console.error('Global Error:', msg, 'at', url, ':', line);
    
    // Don't handle syntax errors here
    if (msg.includes('SyntaxError')) {
        return false;
    }
    
    const statusText = document.querySelector('.status-text');
    if (statusText) {
        statusText.textContent = 'Error occurred';
        statusText.style.color = '#EF4444';
    }
    return false;
};

// Add unhandledrejection handler for promises
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled Promise Rejection:', event.reason);
    const statusText = document.querySelector('.status-text');
    if (statusText) {
        statusText.textContent = 'Connection error';
        statusText.style.color = '#EF4444';
    }
});

// Move click handlers here
document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            if (this.dataset.action === 'settings') {
                toggleModal();
            }
        });
    });

    // Check for content overflow
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.target.classList.contains('note-content-wrapper')) {
                const wrapper = mutation.target;
                wrapper.classList.toggle('overflowing', 
                    wrapper.scrollHeight > wrapper.clientHeight);
            }
        });
    });

    observer.observe(document.getElementById('notes'), {
        childList: true,
        subtree: true
    });
});
