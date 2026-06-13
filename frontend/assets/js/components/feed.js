import { api } from '../api.js';
import { showToast } from '../app.js';

// Helper to create safe elements
const el = (tag, className = '', text = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
};

export const renderFeed = async (container) => {
    const feedContainer = el('div', 'feed-container');
    container.appendChild(feedContainer);
    
    // Add spinner
    const spinner = el('div', 'spinner');
    feedContainer.appendChild(spinner);
    
    try {
        const response = await api.getFeed(1);
        feedContainer.removeChild(spinner);
        
        // Assume response structure is { data: [ { id, user: { username, avatar }, image_url, caption, likes, created_at }, ... ] }
        const posts = response.data || response.posts || [];
        
        if (posts.length === 0) {
            feedContainer.appendChild(el('p', '', 'No posts to show right now. Follow some friends!'));
            return;
        }
        
        posts.forEach(post => {
            const card = createPostCard(post);
            feedContainer.appendChild(card);
        });
        
    } catch (error) {
        feedContainer.removeChild(spinner);
        showToast('Failed to load feed: ' + error.message, 'error');
        feedContainer.appendChild(el('p', '', 'Could not load feed.'));
    }
};

const createPostCard = (post) => {
    const card = el('div', 'post-card');
    
    // Header
    const header = el('div', 'post-header');
    const avatar = el('img', 'avatar');
    avatar.src = (post.user && post.user.avatar) ? post.user.avatar : '/assets/img/default-avatar.png';
    avatar.alt = 'avatar';
    // Fallback if image fails
    avatar.onerror = () => { avatar.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+PGNpcmNsZSBjeD0iMTIiIGN5PSI4IiByPSI1Ii8+PHBhdGggZD0iTTMgMjF2LThhOSA5IDAgMCAxIDE4IDB2OCIvPjwvc3ZnPg==' };
    
    const username = el('span', 'username', (post.user && post.user.username) ? post.user.username : 'Unknown User');
    header.appendChild(avatar);
    header.appendChild(username);
    
    // Image Container
    const imgContainer = el('div', 'post-image-container');
    const img = el('img');
    img.src = post.image_url || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmMmYyZjIiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjRweCIgZmlsbD0iI2FhYSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
    img.alt = 'Post image';
    // Lazy load
    img.loading = 'lazy';
    imgContainer.appendChild(img);
    
    // Actions
    const actions = el('div', 'post-actions');
    const actionsLeft = el('div', 'post-actions-left');
    
    const likeBtn = el('button', 'action-btn');
    likeBtn.textContent = post.isLiked ? '❤️' : '🤍'; // Using emoji for simplicity without importing icons
    if (post.isLiked) likeBtn.classList.add('liked');
    
    const commentBtn = el('button', 'action-btn', '💬');
    const shareBtn = el('button', 'action-btn', '✈️');
    
    actionsLeft.appendChild(likeBtn);
    actionsLeft.appendChild(commentBtn);
    actionsLeft.appendChild(shareBtn);
    
    const saveBtn = el('button', 'action-btn', '🔖');
    
    actions.appendChild(actionsLeft);
    actions.appendChild(saveBtn);
    
    // Likes count
    const likes = el('div', 'post-likes', `${post.likes_count || 0} likes`);
    
    // Caption
    const captionContainer = el('div', 'post-caption');
    const captionUsername = el('span', 'username', (post.user && post.user.username) ? post.user.username : 'Unknown User');
    const captionText = document.createTextNode(` ${post.caption || ''}`);
    captionContainer.appendChild(captionUsername);
    captionContainer.appendChild(captionText);
    
    // Time
    const time = el('div', 'post-time', '2 HOURS AGO'); // Mock time for now
    
    // Interactions handling
    likeBtn.addEventListener('click', async () => {
        try {
            await api.likePost(post.id || post._id);
            const isNowLiked = !likeBtn.classList.contains('liked');
            likeBtn.textContent = isNowLiked ? '❤️' : '🤍';
            if (isNowLiked) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }
        } catch (error) {
            showToast('Could not like post', 'error');
        }
    });

    // Assembly
    card.appendChild(header);
    card.appendChild(imgContainer);
    card.appendChild(actions);
    card.appendChild(likes);
    card.appendChild(captionContainer);
    card.appendChild(time);
    
    return card;
};
