// API Service wrapper
const currentHost = window.location.hostname;
const API_BASE = `http://${currentHost}:8000/api/v1`;

// TODO(security): Storing sensitive authentication tokens in localStorage is vulnerable to XSS theft.
// For a production deployment, use secure, HttpOnly, SameSite=Strict cookies set directly by the Auth Service backend.
let memToken = localStorage.getItem('astrogram_token') || null;
let currentUser = null;
try {
    const cachedUser = localStorage.getItem('astrogram_user');
    if (cachedUser) {
        currentUser = JSON.parse(cachedUser);
    }
} catch (e) {
    console.error('Failed to parse cached user:', e);
}

export const setToken = (token) => {
    memToken = token;
    if (token) {
        localStorage.setItem('astrogram_token', token);
    } else {
        localStorage.removeItem('astrogram_token');
    }
};

export const setCurrentUser = (user) => {
    currentUser = user;
    if (user) {
        localStorage.setItem('astrogram_user', JSON.stringify(user));
    } else {
        localStorage.removeItem('astrogram_user');
    }
};

export const getCurrentUser = () => currentUser;

export const isAuthenticated = () => {
    return !!memToken;
};

export const logout = () => {
    memToken = null;
    currentUser = null;
    localStorage.removeItem('astrogram_token');
    localStorage.removeItem('astrogram_user');
};

// Generic fetch wrapper
const request = async (endpoint, options = {}) => {
    const url = `${API_BASE}${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (memToken) {
        headers['Authorization'] = `Bearer ${memToken}`;
    }

    // Omit Content-Type if we are sending FormData
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    const config = {
        ...options,
        headers,
        credentials: 'omit' // use omit or include based on CORS, for local testing without cookies usually omit or same-origin
    };

    try {
        const response = await fetch(url, config);
        
        // Let empty responses pass
        if (response.status === 204) return null;

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error(`API Error [${endpoint}]:`, error.message);
        throw error;
    }
};

export const api = {
    // Auth Service
    sendOtp: (email) => request('/auth/send-email-otp', { method: 'POST', body: JSON.stringify({ email }) }),
    verifyOtp: (email, otp) => request('/auth/verify-email-otp', { method: 'POST', body: JSON.stringify({ email, otp }) }),
    
    // User Service
    getMe: () => request('/users/me'),
    getProfile: (username) => request(`/users/${username}/profile`),
    resolveUserById: (userId) => request(`/users/id/${userId}`),
    updateProfile: (profileData) => request('/users/profile', { method: 'PATCH', body: JSON.stringify(profileData) }),
    updateUsername: (username) => request('/users/profile/username', { method: 'PATCH', body: JSON.stringify({ username }) }),
    updateAvatar: (formData) => request('/users/profile/avatar', { method: 'PATCH', body: formData }),
    searchUsers: (query) => request(`/search?q=${encodeURIComponent(query)}&type=user`),
    
    // Connection Service
    followUser: (targetUserId) => request('/connections/follow', { method: 'POST', body: JSON.stringify({ targetUserId }) }),
    unfollowUser: (targetUserId) => request('/connections/unfollow', { method: 'POST', body: JSON.stringify({ targetUserId }) }),
    getFollowers: (userId) => request(`/connections/followers/${userId}`),
    getFollowing: (userId) => request(`/connections/following/${userId}`),
    
    // Feed Service
    getFeed: (page = 1) => request(`/feed?page=${page}`),
    
    // Posts Service
    createPost: (postData) => request('/posts', { method: 'POST', body: JSON.stringify(postData) }),
    getPost: (postId) => request(`/posts/${postId}`),
    getUserPosts: (userId) => request(`/posts/users/${userId}`),
    
    // Media Service
    uploadMedia: (formData) => request('/media/upload', { method: 'POST', body: formData }),
    
    // Engagement Service
    likePost: (postId) => request(`/engagement/like/${postId}`, { method: 'POST' }),
    
    // Comment Service
    getComments: (postId) => request(`/comments/post/${postId}`),
    addComment: (postId, text) => request('/comments', { method: 'POST', body: JSON.stringify({ postId, text }) }),
    
    // Chat Service
    getChats: () => request('/chats'),
    sendMessage: (chatId, text) => request(`/chats/${chatId}/messages`, { method: 'POST', body: JSON.stringify({ text }) }),

    // Live Service
    createLiveSession: (title, thumbnailUrl) => request('/live/create', { method: 'POST', body: JSON.stringify({ title, thumbnailUrl }) }),
    joinLiveSession: (sessionId) => request(`/live/join/${encodeURIComponent(sessionId)}`, { method: 'POST' }),
    leaveLiveSession: (sessionId) => request(`/live/leave/${encodeURIComponent(sessionId)}`, { method: 'POST' }),
    endLiveSession: (sessionId) => request(`/live/end/${encodeURIComponent(sessionId)}`, { method: 'POST' }),
    getActiveSessions: (page = 1, limit = 20) => request(`/live/active?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`),
    getStreamHistory: (page = 1, limit = 20) => request(`/live/history?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`),
    getSessionDetails: (sessionId) => request(`/live/${encodeURIComponent(sessionId)}`),
};
