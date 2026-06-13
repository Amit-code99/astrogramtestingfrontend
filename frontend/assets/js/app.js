import { api, isAuthenticated, logout } from './api.js';

// DOM Elements
const appContainer = document.getElementById('app-container');
const mainContent = document.getElementById('main-content');
const mainNav = document.getElementById('main-nav');
const toastContainer = document.getElementById('toast-container');
const navLinks = document.querySelectorAll('.nav-item[data-route]');
const logoutBtn = document.getElementById('logout-btn');

// State
let currentRoute = 'feed';

// Simple Toast Notification System
export const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message; // Using textContent as per security guidelines
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// Router
export const navigate = async (route, targetParam = null) => {
    if (!isAuthenticated() && route !== 'auth') {
        route = 'auth';
    } else if (isAuthenticated() && route === 'auth') {
        route = 'feed';
    }

    currentRoute = route;
    updateNavSelection(route);
    
    // Clear main content securely
    mainContent.replaceChildren();
    
    if (route === 'auth') {
        mainNav.classList.add('hidden');
        mainContent.classList.add('full-width');
        // Lazy load auth module
        const { renderAuth } = await import('./components/auth.js');
        renderAuth(mainContent);
    } else {
        mainNav.classList.remove('hidden');
        mainContent.classList.remove('full-width');
        
        switch (route) {
            case 'feed':
                const { renderFeed } = await import('./components/feed.js');
                renderFeed(mainContent);
                break;
            case 'post':
                const { renderCreatePost } = await import('./components/post.js');
                renderCreatePost(mainContent);
                break;
            case 'search':
                const { renderSearch } = await import('./components/search.js');
                renderSearch(mainContent);
                break;
            case 'profile':
                const { renderProfile } = await import('./components/profile.js');
                renderProfile(mainContent, targetParam);
                break;
            case 'live':
                const { renderLive } = await import('./components/live.js');
                renderLive(mainContent);
                break;
            case 'chat':
                const { renderChat } = await import('./components/chat.js');
                renderChat(mainContent);
                break;
            default:
                const msg = document.createElement('h2');
                msg.textContent = 'Coming soon...';
                mainContent.appendChild(msg);
        }
    }
};

const updateNavSelection = (route) => {
    navLinks.forEach(link => {
        if (link.dataset.route === route) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
};

// Event Listeners
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const route = link.dataset.route;
        navigate(route);
    });
});

logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    logout(); // Clears memory state securely
    showToast('Logged out successfully');
    navigate('auth');
});

// Initialization
const init = () => {
    // Check initial auth state on page reload
    if (isAuthenticated()) {
        navigate('feed');
    } else {
        navigate('auth');
    }
};

document.addEventListener('DOMContentLoaded', init);
