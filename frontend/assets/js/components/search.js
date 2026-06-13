import { api } from '../api.js';
import { showToast, navigate } from '../app.js';

const el = (tag, className = '', text = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
};

export const renderSearch = (container) => {
    const searchContainer = el('div', 'feed-container'); // reuse layout
    searchContainer.style.gap = '16px';
    
    // Search Bar
    const searchInput = el('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search users...';
    searchInput.style.width = '100%';
    searchInput.style.padding = '12px';
    searchInput.style.borderRadius = '8px';
    searchInput.style.border = '1px solid var(--border-color)';
    searchInput.style.backgroundColor = 'var(--bg-secondary)';
    searchInput.style.color = 'var(--text-primary)';
    
    // Results container
    const resultsContainer = el('div');
    resultsContainer.style.display = 'flex';
    resultsContainer.style.flexDirection = 'column';
    resultsContainer.style.gap = '16px';
    
    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(resultsContainer);
    container.appendChild(searchContainer);
    
    // Debounce search
    let timeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        const query = e.target.value.trim();
        
        if (!query) {
            resultsContainer.replaceChildren();
            return;
        }
        
        timeout = setTimeout(async () => {
            try {
                const res = await api.searchUsers(query);
                resultsContainer.replaceChildren();
                
                const users = res.data || res.users || [];
                
                if (users.length === 0) {
                    resultsContainer.appendChild(el('p', '', 'No users found.'));
                    return;
                }
                
                users.forEach(user => {
                    const userRow = el('div');
                    userRow.style.display = 'flex';
                    userRow.style.alignItems = 'center';
                    userRow.style.gap = '12px';
                    userRow.style.cursor = 'pointer';
                    
                    const avatar = el('img', 'avatar');
                    avatar.src = user.avatar || '/assets/img/default-avatar.png';
                    avatar.onerror = () => { avatar.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+PGNpcmNsZSBjeD0iMTIiIGN5PSI4IiByPSI1Ii8+PHBhdGggZD0iTTMgMjF2LThhOSA5IDAgMCAxIDE4IDB2OCIvPjwvc3ZnPg==' };
                    
                    const username = el('span', 'username', user.username);
                    username.style.fontWeight = '600';
                    
                    userRow.appendChild(avatar);
                    userRow.appendChild(username);
                    
                    userRow.addEventListener('click', () => {
                        navigate('profile', user.username);
                    });
                    
                    resultsContainer.appendChild(userRow);
                });
                
            } catch (error) {
                showToast('Search failed: ' + error.message, 'error');
            }
        }, 500);
    });
};
