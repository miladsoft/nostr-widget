function sanitizeContent(content) {
    const urlPattern = /(https?:\/\/[^\s<]+)/g;
    const mediaPattern = /(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp|mp4|webm))/gi;

    // First escape HTML
    content = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Then handle media and links
    content = content.replace(mediaPattern, url => {
        if (url.match(/\.(mp4|webm)$/i)) {
            return `<video src="${url}" controls class="note-media"></video>`;
        }
        return `<img src="${url}" loading="lazy" class="note-media">`;
    });

    return content.replace(urlPattern, url => 
        `<a href="${url}" target="_blank" rel="noopener">${url}</a>`
    ).replace(/\n/g, '<br>');
}

function getDefaultAvatar() {
    return '/icon.png';
}

function updateTime() {
    const timeEl = document.querySelector('.status-bar-time');
    timeEl.textContent = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}
