import { api } from '../api.js';
import { showToast } from '../app.js';

const el = (tag, className = '', text = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
};

export const renderChat = async (container) => {
    const chatLayout = el('div');
    chatLayout.style.display = 'flex';
    chatLayout.style.width = '100%';
    chatLayout.style.height = 'calc(100vh - 100px)';
    chatLayout.style.border = '1px solid var(--border-color)';
    chatLayout.style.borderRadius = 'var(--border-radius-lg)';
    chatLayout.style.overflow = 'hidden';
    
    // Sidebar (Chat List)
    const sidebar = el('div');
    sidebar.style.width = '350px';
    sidebar.style.borderRight = '1px solid var(--border-color)';
    sidebar.style.display = 'flex';
    sidebar.style.flexDirection = 'column';
    
    const sidebarHeader = el('div');
    sidebarHeader.style.padding = '20px';
    sidebarHeader.style.borderBottom = '1px solid var(--border-color)';
    sidebarHeader.style.fontWeight = 'bold';
    sidebarHeader.style.fontSize = '1.2rem';
    sidebarHeader.textContent = 'Messages';
    
    const chatList = el('div');
    chatList.style.flex = '1';
    chatList.style.overflowY = 'auto';
    
    sidebar.appendChild(sidebarHeader);
    sidebar.appendChild(chatList);
    
    // Main Chat Area
    const mainChat = el('div');
    mainChat.style.flex = '1';
    mainChat.style.display = 'flex';
    mainChat.style.flexDirection = 'column';
    
    const emptyState = el('div');
    emptyState.style.flex = '1';
    emptyState.style.display = 'flex';
    emptyState.style.alignItems = 'center';
    emptyState.style.justifyContent = 'center';
    emptyState.style.color = 'var(--text-secondary)';
    emptyState.textContent = 'Select a message to start chatting';
    
    mainChat.appendChild(emptyState);
    
    chatLayout.appendChild(sidebar);
    chatLayout.appendChild(mainChat);
    
    container.appendChild(chatLayout);
    
    // Load chats
    try {
        const res = await api.getChats();
        const chats = res.data || res.chats || [];
        
        if (chats.length === 0) {
            const noChats = el('p', '', 'No messages yet.');
            noChats.style.padding = '20px';
            noChats.style.color = 'var(--text-secondary)';
            noChats.style.textAlign = 'center';
            chatList.appendChild(noChats);
        } else {
            // Render chats here
        }
    } catch (error) {
        showToast('Failed to load chats: ' + error.message, 'error');
    }
};
