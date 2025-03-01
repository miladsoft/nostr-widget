const { SimplePool, nip19 } = window.NostrTools;
const notesSection = document.getElementById('notes');
const statusText = document.querySelector('.status-text');
const statusIndicator = document.querySelector('.status-indicator');

// Initialize configuration
const pool = new SimplePool();
const relays = new Set([
    'wss://relay.nostr.band/',
    'wss://nostr-pub.wellorder.net/',
    'wss://relay.damus.io/'
]);

let pk = localStorage.getItem('pk');
let npub = null;
let follows = new Set();
let ev = new Map();
let profiles = new Map();

const YEAR_AGO = 365 * 24 * 60 * 60;
const since = parseInt((Date.now() - YEAR_AGO) / 1000) || 0;

// Add Set to track unique post IDs
const seenPosts = new Set();

// Function declarations
async function getNotes() {
    try {
        updateStatus('Getting notes...', false);
        notesSection.innerHTML = ''; // Clear existing notes
        notesSection.ariaBusy = true;
        
        // Use list instead of querySync
        const events = await Promise.all([...relays].map(async relay => {
            try {
                return await pool.querySync([relay], {
                    kinds: [1],
                    authors: [...follows],
                    limit: 50
                });
            } catch (err) {
                console.warn(`Failed to fetch from ${relay}:`, err);
                return [];
            }
        }));

        // Flatten and deduplicate events
        const uniqueEvents = Array.from(
            new Map(events.flat().map(event => [event.id, event])).values()
        );

        uniqueEvents
            .sort((a, b) => b.created_at - a.created_at)
            .forEach(event => {
                if (!seenPosts.has(event.id)) {
                    addNote(event);
                }
            });

        notesSection.ariaBusy = false;
        updateStatus('Connected', true);
    } catch (err) {
        handleError(err);
    }
}

async function subscribeToRelays() {
    const events = [...ev.values()] || [];
    const _since = events.length ? 
        events.sort((a, b) => b.created_at - a.created_at)[0].created_at : 
        since;

    pool.subscribeMany([...relays], [{
        authors: [...follows],
        kinds: [1],
        since: _since
    }], {
        onevent(event) {
            if (event.kind === 1 && !ev.has(event.id)) {
                ev.set(event.id, event);
                addNote(event);
            }
        },
        oneose() {
            updateStatus('Connected', true);
        }
    });
}

async function getInitial() {
    updateStatus('Getting initial data...', false);
    notesSection.innerHTML = '<div class="loading-state"><i class="mdi mdi-loading mdi-spin"></i></div>';
    
    const events = await pool.querySync([...relays], {
        kinds: [0, 3, 10002],
        authors: [pk]
    });

    events.forEach(event => {
        if (event.kind === 0) profiles.set(event.id, event);
        if (event.kind === 3) {
            event.tags.forEach(tag => {
                if (tag[0] === 'p') follows.add(tag[1]);
            });
        }
        if (event.kind === 10002) {
            event.tags.forEach(tag => {
                if (tag[0] === 'r' && tag[2] !== 'write') relays.add(tag[1]);
            });
        }
    });

    const _profiles = await pool.querySync([...relays], {
        kinds: [0],
        authors: [...follows]
    });
    
    _profiles.forEach(profile => profiles.set(profile.pubkey, profile));
    
    const profile = profiles.get(pk);
    if (profile) {
        try {
            const content = JSON.parse(profile.content);
            updateProfileUI(content);
        } catch (err) {
            console.error('Failed to parse profile:', err);
        }
    }
    
    updateStatus('Connected', true);
}

// Add error handler function
function handleError(err) {
    console.error('Connection error:', err);
    updateStatus('Connection failed', false);
    notesSection.innerHTML = `
        <div class="note error">
            <div class="note-content">
                ${err.message || 'Failed to connect. Please check your connection.'}
                <button onclick="init()" class="retry-button">
                    <i class="mdi mdi-refresh"></i> Retry
                </button>
            </div>
        </div>
    `;
}

function getDefaultAvatar(pubkey) {
    // Take only first 8 characters of pubkey as seed
    const seed = pubkey.slice(0, 8);
    return `https://api.dicebear.com/6.x/identicon/svg?seed=${seed}&radius=50&backgroundColor=random&backgroundType=gradientLinear`;
}

function addNote(event) {
    if (!event || seenPosts.has(event.id)) return;
    try {
        seenPosts.add(event.id);

        const note = document.createElement('div');
        note.className = 'note';
        
        const profile = getProfile(event.pubkey || '');
        const content = event.content ? sanitizeContent(event.content) : '';
        const time = new Date(event.created_at * 1000).toLocaleString();
        const defaultAvatar = getDefaultAvatar(event.pubkey);

        note.innerHTML = `
            <div class="note-header">
                <div class="profile-info">
                    <img 
                        src="${profile.picture || defaultAvatar}" 
                        alt="" 
                        class="profile-picture"
                        onerror="this.src='${defaultAvatar}'"
                    >
                    <div class="profile-text">
                        <span class="profile-name">${profile.name}</span>
                        <span class="pubkey">${event.pubkey?.slice(0, 8) || ''}...</span>
                    </div>
                </div>
            </div>
            <div class="note-content-wrapper">
                <div class="note-content">${content}</div>
            </div>
            <div class="note-footer">${time}</div>
        `;
        
        if (notesSection.firstChild) {
            notesSection.insertBefore(note, notesSection.firstChild);
        } else {
            notesSection.appendChild(note);
        }
    } catch (err) {
        console.error('Error adding note:', err);
    }
}

function getProfile(id) {
    try {
        const profile = profiles.get(id);
        if (!profile) return {
            name: id.slice(0, 8),
            picture: getDefaultAvatar(id)
        };
        
        const content = JSON.parse(profile?.content || '{}');
        // Use picture URL directly if it's valid, otherwise generate avatar
        const picture = content?.picture || getDefaultAvatar(id);
        
        return {
            name: content?.name || id.slice(0, 8),
            picture: picture.startsWith('http') ? picture : getDefaultAvatar(id)
        };
    } catch {
        return {
            name: id.slice(0, 8),
            picture: getDefaultAvatar(id)
        };
    }
}

function sanitizeContent(content) {
    // Parse URLs and media
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    const imageRegex = /(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp))/gi;
    const videoRegex = /(https?:\/\/\S+\.(?:mp4|webm|ogg))/gi;

    // Replace image links with actual images
    content = content.replace(imageRegex, url => 
        `<img src="${url}" alt="media" loading="lazy" class="note-media"/>`
    );

    // Replace video links with video players
    content = content.replace(videoRegex, url => 
        `<video src="${url}" controls class="note-media">
            <a href="${url}" target="_blank">${url}</a>
        </video>`
    );

    // Replace remaining URLs with clickable links
    content = content.replace(urlRegex, url => 
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );

    // Sanitize HTML and handle line breaks
    return content
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/&lt;img/g, '<img')
        .replace(/&lt;video/g, '<video')
        .replace(/&lt;a/g, '<a')
        .replace(/\/a&gt;/g, '/a>')
        .replace(/\/img&gt;/g, '/img>')
        .replace(/\/video&gt;/g, '/video>')
        .replace(/\n/g, '<br>');
}

function updateStatus(message, isConnected) {
    statusText.textContent = message;
    statusIndicator.classList.toggle('offline', !isConnected);
}

function updateStatusBar() {
    const timeElement = document.querySelector('.status-bar-time');
    const updateTime = () => {
        timeElement.textContent = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    updateTime();
    setInterval(updateTime, 1000);
}

// Modal handlers
window.toggleModal = (event) => {
    const modal = document.getElementById('pubkey-modal');
    if (event.target.closest('button')?.type === 'submit') {
        const input = document.querySelector('[name="pubkey"]');
        if (input.value) {
            pk = input.value;
            localStorage.setItem('pk', pk);
            init();
            modal.close();
        }
    } else if (event.target.closest('button')?.type === 'button') {
        modal.close(); // Close on cancel
    } else {
        modal.showModal();
    }
};

window.showProfileModal = () => {
    // Profile modal implementation
    console.log('Show profile for:', pk);
    // You can implement profile view here
};

function showModal() {
    const modal = document.getElementById('pubkey-modal');
    modal.showModal();
}

function sanitizePK(key) {
    if (key.startsWith('npub')) {
        npub = key;
        const { data } = nip19.decode(npub);
        key = data;
    } else {
        npub = nip19.npubEncode(key);
    }
    follows.add(key); // follow self
    return key;
}

async function init() {
    try {
        updateStatus('Connecting...', false);
        seenPosts.clear();
        
        // Use correct method from SimplePool
        const sub = pool.subscribeMany([...relays], [{
            kinds: [1],
            authors: Array.from(follows),
            limit: 50
        }], {
            onevent(event) {
                if (!seenPosts.has(event.id)) {
                    addNote(event);
                }
            },
            oneose() {
                updateStatus('Connected', true);
            }
        });

    } catch (err) {
        handleError(err);
    }
}

// Add modal input handling
document.querySelectorAll('.input-method').forEach(method => {
    method.addEventListener('click', () => {
        // Remove active class from all methods
        document.querySelectorAll('.input-method').forEach(m => 
            m.classList.remove('active'));
        // Add active class to clicked method
        method.classList.add('active');
        
        // Show corresponding input section
        const methodType = method.dataset.method;
        document.querySelectorAll('.input-section').forEach(section => 
            section.classList.remove('active'));
        document.getElementById(`${methodType}-input`).classList.add('active');
    });
});

// Handle public key saving
window.savePublicKey = async () => {
    const activeMethod = document.querySelector('.input-method.active').dataset.method;
    let publicKey;

    try {
        switch (activeMethod) {
            case 'npub':
                publicKey = document.querySelector('#npub-input input').value;
                break;
            case 'hex':
                const hexKey = document.querySelector('#hex-input input').value;
                publicKey = nip19.npubEncode(hexKey);
                break;
            case 'extension':
                if (window.nostr) {
                    publicKey = await window.nostr.getPublicKey();
                } else {
                    throw new Error('No Nostr extension found');
                }
                break;
        }

        if (publicKey) {
            pk = publicKey;
            localStorage.setItem('pk', pk);
            document.getElementById('pubkey-modal').close();
            init();
        }
    } catch (err) {
        console.error('Failed to save public key:', err);
        // Show error in modal
        const hint = document.querySelector('.input-hint');
        hint.style.color = '#EF4444';
        hint.textContent = err.message;
    }
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    updateStatusBar();
    if (!pk) {
        showModal();
    } else {
        pk = sanitizePK(pk);
        try {
            await getInitial();
            await getNotes();
            subscribeToRelays();
        } catch (err) {
            handleError(err);
        }
    }
});

// Window-level functions
window.init = init;
window.toggleModal = (event) => {
    const modal = document.getElementById('pubkey-modal');
    if (event.target.closest('button')?.type === 'submit') {
        const input = document.querySelector('[name="pubkey"]');
        if (input.value) {
            pk = sanitizePK(input.value);
            localStorage.setItem('pk', pk);
            init();
            modal.close();
        }
    } else {
        modal.showModal();
    }
};

function updateProfileUI(profile) {
    const profileImg = document.getElementById('nav-profile-img');
    const defaultAvatar = getDefaultAvatar(pk);
    if (profileImg) {
        profileImg.src = profile?.picture || defaultAvatar;
        profileImg.onerror = () => {
            profileImg.src = defaultAvatar;
        };
    }
}
