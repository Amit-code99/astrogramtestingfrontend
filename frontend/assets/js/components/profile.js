import { api, getCurrentUser, setCurrentUser } from '../api.js';
import { showToast, navigate } from '../app.js';

// Safe DOM element helper
const el = (tag, className = '', text = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
};

// Modal showing follower/following lists
const showConnectionsModal = async (titleText, userId, type, currentUserId, onAction) => {
    // Modal Overlay with glassmorphism blur
    const overlay = el('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.backdropFilter = 'blur(10px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '2000';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';

    // Modal Box Container
    const modal = el('div');
    modal.style.width = '90%';
    modal.style.maxWidth = '400px';
    modal.style.backgroundColor = 'var(--bg-secondary)';
    modal.style.border = '1px solid var(--border-color)';
    modal.style.borderRadius = 'var(--border-radius-lg)';
    modal.style.padding = '20px';
    modal.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5)';
    modal.style.transform = 'translateY(-20px)';
    modal.style.transition = 'transform 0.3s ease';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.gap = '16px';
    modal.style.maxHeight = '80vh';

    // Modal Header
    const modalHeader = el('div');
    modalHeader.style.display = 'flex';
    modalHeader.style.justifyContent = 'space-between';
    modalHeader.style.alignItems = 'center';
    modalHeader.style.borderBottom = '1px solid var(--border-color)';
    modalHeader.style.paddingBottom = '12px';

    const title = el('h3', '', titleText);
    title.style.fontSize = '18px';
    title.style.fontWeight = '600';
    modalHeader.appendChild(title);

    const closeBtn = el('button', '', '✕');
    closeBtn.style.fontSize = '18px';
    closeBtn.style.color = 'var(--text-secondary)';
    closeBtn.addEventListener('click', () => closeModal());
    modalHeader.appendChild(closeBtn);
    modal.appendChild(modalHeader);

    // List Container
    const listContainer = el('div');
    listContainer.style.overflowY = 'auto';
    listContainer.style.flex = '1';
    listContainer.style.display = 'flex';
    listContainer.style.flexDirection = 'column';
    listContainer.style.gap = '12px';
    listContainer.style.minHeight = '150px';

    const spinner = el('div', 'spinner');
    listContainer.appendChild(spinner);
    modal.appendChild(listContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        modal.style.transform = 'translateY(0)';
    });

    const closeModal = () => {
        overlay.style.opacity = '0';
        modal.style.transform = 'translateY(-20px)';
        setTimeout(() => overlay.remove(), 300);
    };

    try {
        // Fetch follower/following UUIDs from connection service
        const res = type === 'followers' ? await api.getFollowers(userId) : await api.getFollowing(userId);
        spinner.remove();

        const ids = res?.data || [];
        if (ids.length === 0) {
            const emptyMsg = el('p', '', `No ${type} yet.`);
            emptyMsg.style.textAlign = 'center';
            emptyMsg.style.color = 'var(--text-secondary)';
            emptyMsg.style.padding = '20px 0';
            listContainer.appendChild(emptyMsg);
            return;
        }

        // Concurrently resolve all profile details via our new lookup endpoint
        const profiles = await Promise.all(
            ids.map(async (id) => {
                try {
                    const profileRes = await api.resolveUserById(id);
                    if (profileRes && profileRes.success) {
                        return profileRes.data;
                    }
                } catch (err) {
                    console.error(`Failed to resolve profile for ${id}:`, err);
                }
                return { authUserId: id, username: null, email: null };
            })
        );

        // Fetch my own following list to determine if I follow them
        let myFollowingIds = [];
        if (currentUserId) {
            try {
                const myFollowingRes = await api.getFollowing(currentUserId);
                myFollowingIds = myFollowingRes?.data || [];
            } catch (err) {
                console.error('Failed to fetch my following list:', err);
            }
        }

        profiles.forEach((profile) => {
            const row = el('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.gap = '12px';

            const userDetails = el('div');
            userDetails.style.display = 'flex';
            userDetails.style.alignItems = 'center';
            userDetails.style.gap = '8px';
            userDetails.style.cursor = 'pointer';

            const rowAvatar = el('img');
            let avatarUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+PGNpcmNsZSBjeD0iMTIiIGN5PSI4IiByPSI1Ii8+PHBhdGggZD0iTTMgMjF2LThhOSA5IDAgMCAxIDE4IDB2OCIvPjwvc3ZnPg==';
            if (profile.profile && profile.profile.avatar) {
                avatarUrl = profile.profile.avatar.small || profile.profile.avatar.medium || profile.profile.avatar.thumbnail || avatarUrl;
            }
            rowAvatar.src = avatarUrl;
            rowAvatar.style.width = '36px';
            rowAvatar.style.height = '36px';
            rowAvatar.style.borderRadius = '50%';
            rowAvatar.style.objectFit = 'cover';
            userDetails.appendChild(rowAvatar);

            const textWrap = el('div');
            textWrap.style.display = 'flex';
            textWrap.style.flexDirection = 'column';

            const nameText = profile.username ? `@${profile.username}` : (profile.email ? profile.email.split('@')[0] : 'astrogram_user');
            const usernameEl = el('span', '', nameText);
            usernameEl.style.fontWeight = '600';
            usernameEl.style.fontSize = '14px';
            textWrap.appendChild(usernameEl);

            if (profile.profile && profile.profile.fullName) {
                const fullNameEl = el('span', '', profile.profile.fullName);
                fullNameEl.style.fontSize = '12px';
                fullNameEl.style.color = 'var(--text-secondary)';
                textWrap.appendChild(fullNameEl);
            }
            userDetails.appendChild(textWrap);
            row.appendChild(userDetails);

            // Clicking on user row navigates to their profile page and closes modal
            userDetails.addEventListener('click', () => {
                closeModal();
                if (profile.username) {
                    navigate('profile', profile.username);
                } else {
                    showToast('Profile username not configured yet');
                }
            });

            // Follow / Unfollow Action Button next to their name (if not current user)
            if (profile.authUserId !== currentUserId) {
                const isFollowing = myFollowingIds.includes(profile.authUserId);
                const actionBtn = el('button', 'btn-primary', isFollowing ? 'Unfollow' : 'Follow');
                actionBtn.style.padding = '4px 12px';
                actionBtn.style.fontSize = '12px';
                if (isFollowing) {
                    actionBtn.style.backgroundColor = 'var(--bg-elevated)';
                    actionBtn.style.color = 'var(--text-primary)';
                    actionBtn.style.border = '1px solid var(--border-color)';
                }

                actionBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    actionBtn.disabled = true;
                    try {
                        if (actionBtn.textContent === 'Follow') {
                            await api.followUser(profile.authUserId);
                            showToast(`Followed ${nameText}`);
                            actionBtn.textContent = 'Unfollow';
                            actionBtn.style.backgroundColor = 'var(--bg-elevated)';
                            actionBtn.style.color = 'var(--text-primary)';
                            actionBtn.style.border = '1px solid var(--border-color)';
                        } else {
                            await api.unfollowUser(profile.authUserId);
                            showToast(`Unfollowed ${nameText}`);
                            actionBtn.textContent = 'Follow';
                            actionBtn.style.backgroundColor = 'var(--accent-color)';
                            actionBtn.style.color = '#fff';
                            actionBtn.style.border = 'none';
                        }
                        if (onAction) onAction();
                    } catch (err) {
                        console.error('Follow action failed:', err);
                        showToast(err.message || 'Action failed', 'error');
                    } finally {
                        actionBtn.disabled = false;
                    }
                });

                row.appendChild(actionBtn);
            }

            listContainer.appendChild(row);
        });
    } catch (err) {
        console.error('Failed to load list details:', err);
        spinner.remove();
        const errMsg = el('p', '', 'Failed to load list details.');
        errMsg.style.color = 'var(--error-color)';
        errMsg.style.textAlign = 'center';
        listContainer.appendChild(errMsg);
    }
};

// Modal for editing profile details
const showEditProfileModal = (user, onSave) => {
    // Modal Overlay with blur
    const overlay = el('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.backdropFilter = 'blur(10px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '2000';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';

    // Modal Container Box
    const modal = el('div');
    modal.style.width = '90%';
    modal.style.maxWidth = '500px';
    modal.style.backgroundColor = 'var(--bg-secondary)';
    modal.style.border = '1px solid var(--border-color)';
    modal.style.borderRadius = 'var(--border-radius-lg)';
    modal.style.padding = '24px';
    modal.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5)';
    modal.style.transform = 'translateY(-20px)';
    modal.style.transition = 'transform 0.3s ease';
    modal.style.maxHeight = '90vh';
    modal.style.overflowY = 'auto';

    const title = el('h3', '', 'Edit Profile');
    title.style.fontSize = '20px';
    title.style.fontWeight = '600';
    title.style.marginBottom = '20px';
    title.style.textAlign = 'center';
    modal.appendChild(title);

    // Form element
    const form = el('form');
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '16px';

    // Dynamic Input Field Helper
    const createInputGroup = (labelText, inputElement) => {
        const group = el('div');
        group.style.display = 'flex';
        group.style.flexDirection = 'column';
        group.style.gap = '6px';
        const label = el('label', '', labelText);
        label.style.fontSize = '12px';
        label.style.fontWeight = '600';
        label.style.color = 'var(--text-secondary)';
        group.appendChild(label);
        group.appendChild(inputElement);
        return group;
    };

    // Username Field
    const usernameInput = el('input');
    usernameInput.type = 'text';
    usernameInput.value = user.username || '';
    usernameInput.placeholder = 'Username';
    usernameInput.style.width = '100%';
    usernameInput.style.backgroundColor = 'var(--bg-primary)';
    usernameInput.style.border = '1px solid var(--border-color)';
    usernameInput.style.borderRadius = 'var(--border-radius-md)';
    usernameInput.style.padding = '10px 12px';
    usernameInput.style.color = 'var(--text-primary)';
    form.appendChild(createInputGroup('Username (Required for profile setup)', usernameInput));

    // Full Name Field
    const fullNameInput = el('input');
    fullNameInput.type = 'text';
    fullNameInput.value = (user.profile && user.profile.fullName) || '';
    fullNameInput.placeholder = 'Full Name';
    fullNameInput.style.width = '100%';
    fullNameInput.style.backgroundColor = 'var(--bg-primary)';
    fullNameInput.style.border = '1px solid var(--border-color)';
    fullNameInput.style.borderRadius = 'var(--border-radius-md)';
    fullNameInput.style.padding = '10px 12px';
    fullNameInput.style.color = 'var(--text-primary)';
    form.appendChild(createInputGroup('Full Name', fullNameInput));

    // Bio Field
    const bioInput = document.createElement('textarea');
    bioInput.value = (user.profile && user.profile.bio) || '';
    bioInput.placeholder = 'Write something about yourself...';
    bioInput.style.width = '100%';
    bioInput.style.minHeight = '80px';
    bioInput.style.backgroundColor = 'var(--bg-primary)';
    bioInput.style.border = '1px solid var(--border-color)';
    bioInput.style.borderRadius = 'var(--border-radius-md)';
    bioInput.style.padding = '10px 12px';
    bioInput.style.color = 'var(--text-primary)';
    bioInput.style.resize = 'vertical';
    form.appendChild(createInputGroup('Bio', bioInput));

    // Website Field
    const websiteInput = el('input');
    websiteInput.type = 'text';
    websiteInput.value = (user.profile && user.profile.website) || '';
    websiteInput.placeholder = 'https://example.com';
    websiteInput.style.width = '100%';
    websiteInput.style.backgroundColor = 'var(--bg-primary)';
    websiteInput.style.border = '1px solid var(--border-color)';
    websiteInput.style.borderRadius = 'var(--border-radius-md)';
    websiteInput.style.padding = '10px 12px';
    websiteInput.style.color = 'var(--text-primary)';
    form.appendChild(createInputGroup('Website', websiteInput));

    // Gender Field
    const genderSelect = document.createElement('select');
    genderSelect.style.width = '100%';
    genderSelect.style.backgroundColor = 'var(--bg-primary)';
    genderSelect.style.border = '1px solid var(--border-color)';
    genderSelect.style.borderRadius = 'var(--border-radius-md)';
    genderSelect.style.padding = '10px 12px';
    genderSelect.style.color = 'var(--text-primary)';
    
    const genders = ['Male', 'Female', 'Other', 'Prefer Not To Say'];
    genders.forEach(g => {
        const opt = el('option', '', g);
        opt.value = g;
        if (user.profile && user.profile.gender === g) {
            opt.selected = true;
        }
        genderSelect.appendChild(opt);
    });
    form.appendChild(createInputGroup('Gender', genderSelect));

    // Avatar Upload Field
    const avatarInput = el('input');
    avatarInput.type = 'file';
    avatarInput.accept = 'image/*';
    avatarInput.style.display = 'none';

    const avatarBtn = el('button', 'btn-primary', 'Change Profile Picture');
    avatarBtn.type = 'button';
    avatarBtn.style.backgroundColor = 'var(--bg-elevated)';
    avatarBtn.style.color = 'var(--text-primary)';
    avatarBtn.style.alignSelf = 'flex-start';
    avatarBtn.addEventListener('click', () => avatarInput.click());

    const avatarFileLabel = el('span', '', 'No file selected');
    avatarFileLabel.style.fontSize = '12px';
    avatarFileLabel.style.color = 'var(--text-secondary)';
    avatarFileLabel.style.marginLeft = '8px';

    avatarInput.addEventListener('change', () => {
        if (avatarInput.files && avatarInput.files[0]) {
            avatarFileLabel.textContent = avatarInput.files[0].name;
        } else {
            avatarFileLabel.textContent = 'No file selected';
        }
    });

    const avatarUploadGroup = el('div');
    avatarUploadGroup.style.display = 'flex';
    avatarUploadGroup.style.alignItems = 'center';
    avatarUploadGroup.appendChild(avatarBtn);
    avatarUploadGroup.appendChild(avatarInput);
    avatarUploadGroup.appendChild(avatarFileLabel);
    form.appendChild(createInputGroup('Profile Picture', avatarUploadGroup));

    // Buttons actions
    const btnContainer = el('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.justifyContent = 'flex-end';
    btnContainer.style.gap = '12px';
    btnContainer.style.marginTop = '8px';

    const cancelBtn = el('button', 'btn-primary', 'Cancel');
    cancelBtn.type = 'button';
    cancelBtn.style.backgroundColor = 'transparent';
    cancelBtn.style.color = 'var(--text-secondary)';
    cancelBtn.addEventListener('click', () => closeModal());

    const saveBtn = el('button', 'btn-primary', 'Save changes');
    saveBtn.type = 'submit';
    
    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(saveBtn);
    form.appendChild(btnContainer);

    modal.appendChild(form);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Fade in
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        modal.style.transform = 'translateY(0)';
    });

    const closeModal = () => {
        overlay.style.opacity = '0';
        modal.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            overlay.remove();
        }, 300);
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            // 1. Handle Profile Picture (Avatar)
            if (avatarInput.files && avatarInput.files[0]) {
                const formData = new FormData();
                formData.append('avatar', avatarInput.files[0]);
                await api.updateAvatar(formData);
            }

            // 2. Handle Username Update
            const newUsername = usernameInput.value.trim().toLowerCase();
            if (newUsername && newUsername !== user.username) {
                // Input validation matching Instagram profile username regex
                if (!/^[a-z0-9._]+$/.test(newUsername)) {
                    throw new Error('Username can only contain letters, numbers, dots, and underscores.');
                }
                await api.updateUsername(newUsername);
            }

            // 3. Handle Other Profile Details
            const fullName = fullNameInput.value.trim();
            const bio = bioInput.value.trim();
            const website = websiteInput.value.trim();
            const gender = genderSelect.value;

            await api.updateProfile({ fullName, bio, website, gender });
            
            showToast('Profile updated successfully!');
            closeModal();
            if (onSave) onSave();
        } catch (error) {
            console.error('Failed to update profile:', error);
            showToast(error.message || 'Failed to update profile', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save changes';
        }
    });
};

// Render user profile view
export const renderProfile = async (container, targetUsername = null) => {
    // Clear container securely
    container.replaceChildren();

    // Create Main Profile UI Wrapper
    const profileContainer = el('div');
    profileContainer.style.width = '100%';
    profileContainer.style.maxWidth = '900px';
    profileContainer.style.margin = '0 auto';
    profileContainer.style.display = 'flex';
    profileContainer.style.flexDirection = 'column';
    profileContainer.style.gap = '32px';
    profileContainer.style.padding = '0 16px';

    // Loading State Spinner
    const spinner = el('div', 'spinner');
    container.appendChild(spinner);

    let user = null;
    let isOwnProfile = true;

    try {
        if (targetUsername) {
            // Fetch own profile to check if targetUsername is actually the currently logged in user
            const meRes = await api.getMe();
            const meData = meRes?.data;
            
            if (meData && meData.username === targetUsername) {
                user = meData;
                isOwnProfile = true;
            } else {
                // Load other user's public profile
                const targetRes = await api.getProfile(targetUsername);
                if (targetRes && targetRes.success && targetRes.data) {
                    user = targetRes.data;
                    isOwnProfile = false;
                } else {
                    throw new Error('User profile not found');
                }
            }
        } else {
            // Load own profile directly
            const response = await api.getMe();
            if (response && response.success && response.data) {
                user = response.data;
                isOwnProfile = true;
            } else {
                throw new Error('Profile response was not successful');
            }
        }

        if (isOwnProfile) {
            setCurrentUser(user); // Cache own profile user locally
        }
    } catch (err) {
        console.error('Error fetching profile:', err);
        spinner.remove();
        
        // Show auth failure message or fallback
        const errBox = el('div');
        errBox.style.textAlign = 'center';
        errBox.style.marginTop = '40px';
        const errMsg = el('h3', '', 'Unable to load profile. Please make sure you are logged in.');
        errMsg.style.color = 'var(--error-color)';
        errMsg.style.marginBottom = '16px';
        
        const loginBtn = el('button', 'btn-primary', 'Go to Login');
        loginBtn.addEventListener('click', () => {
            window.location.reload(); // Re-trigger initial auth state
        });

        errBox.appendChild(errMsg);
        errBox.appendChild(loginBtn);
        container.appendChild(errBox);
        return;
    }

    spinner.remove();

    // Profile Setup Reminder Banner (if username is missing and it is our own profile)
    if (isOwnProfile && !user.username) {
        const setupBanner = el('div');
        setupBanner.style.backgroundColor = 'rgba(240, 148, 51, 0.15)';
        setupBanner.style.border = '1px solid #f09433';
        setupBanner.style.borderRadius = 'var(--border-radius-md)';
        setupBanner.style.padding = '12px var(--spacing-md)';
        setupBanner.style.fontSize = '14px';
        setupBanner.style.color = '#f09433';
        setupBanner.style.display = 'flex';
        setupBanner.style.justifyContent = 'space-between';
        setupBanner.style.alignItems = 'center';
        setupBanner.style.gap = '16px';
        setupBanner.style.marginBottom = '-16px';
        
        const bannerText = el('span', '', 'Please set up a username to complete your profile setup.');
        setupBanner.appendChild(bannerText);

        const setupBtn = el('button', 'btn-primary', 'Setup Username');
        setupBtn.style.padding = '6px 12px';
        setupBtn.style.fontSize = '12px';
        setupBtn.style.backgroundColor = '#f09433';
        setupBtn.addEventListener('click', () => showEditProfileModal(user, () => renderProfile(container, targetUsername)));
        setupBanner.appendChild(setupBtn);

        profileContainer.appendChild(setupBanner);
    }

    // --- Header Section ---
    const header = el('div');
    header.style.display = 'flex';
    header.style.gap = '32px';
    header.style.alignItems = 'center';
    header.style.flexWrap = 'wrap';
    
    // Avatar
    const avatarContainer = el('div');
    avatarContainer.style.position = 'relative';
    const avatar = el('img');
    
    // Set fallback avatar if not configured
    let avatarUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+PGNpcmNsZSBjeD0iMTIiIGN5PSI4IiByPSI1Ii8+PHBhdGggZD0iTTMgMjF2LThhOSA5IDAgMCAxIDE4IDB2OCIvPjwvc3ZnPg==';
    if (user.profile && user.profile.avatar) {
        avatarUrl = user.profile.avatar.small || user.profile.avatar.medium || user.profile.avatar.thumbnail || avatarUrl;
    }
    
    avatar.src = avatarUrl;
    avatar.style.width = '150px';
    avatar.style.height = '150px';
    avatar.style.borderRadius = '50%';
    avatar.style.objectFit = 'cover';
    avatar.style.border = '1px solid var(--border-color)';
    avatarContainer.appendChild(avatar);
    
    // Info Container
    const info = el('div');
    info.style.display = 'flex';
    info.style.flexDirection = 'column';
    info.style.gap = '16px';
    info.style.flex = '1';
    info.style.minWidth = '250px';
    
    // Row 1: Username & Edit/Follow button
    const usernameRow = el('div');
    usernameRow.style.display = 'flex';
    usernameRow.style.alignItems = 'center';
    usernameRow.style.gap = '16px';
    usernameRow.style.flexWrap = 'wrap';
    
    const displayUsername = user.username ? `@${user.username}` : (user.email ? user.email.split('@')[0] : 'astrogram_user');
    const username = el('h2', '', displayUsername);
    username.style.fontWeight = '300';
    username.style.fontSize = '28px';
    
    // Dynamic Action Button based on relationship
    let actionBtn;
    let myAuthUserId = '';
    
    if (isOwnProfile) {
        // Own profile -> Edit button
        actionBtn = el('button', 'btn-primary', 'Edit Profile');
        actionBtn.style.backgroundColor = 'var(--bg-secondary)';
        actionBtn.style.color = 'var(--text-primary)';
        actionBtn.style.border = '1px solid var(--border-color)';
        actionBtn.style.padding = '6px 16px';
        actionBtn.addEventListener('click', () => showEditProfileModal(user, () => renderProfile(container, targetUsername)));
        myAuthUserId = user.authUserId;
    } else {
        // Other user's profile -> Follow/Unfollow button
        let myFollowingIds = [];
        try {
            const meRes = await api.getMe();
            if (meRes && meRes.success && meRes.data) {
                myAuthUserId = meRes.data.authUserId;
                const myFollowingRes = await api.getFollowing(myAuthUserId);
                myFollowingIds = myFollowingRes?.data || [];
            }
        } catch (err) {
            console.error('Failed to get my following state:', err);
        }

        const isFollowing = myFollowingIds.includes(user.authUserId);
        actionBtn = el('button', 'btn-primary', isFollowing ? 'Unfollow' : 'Follow');
        actionBtn.style.padding = '6px 20px';
        if (isFollowing) {
            actionBtn.style.backgroundColor = 'var(--bg-secondary)';
            actionBtn.style.color = 'var(--text-primary)';
            actionBtn.style.border = '1px solid var(--border-color)';
        }

        actionBtn.addEventListener('click', async () => {
            actionBtn.disabled = true;
            try {
                if (actionBtn.textContent === 'Follow') {
                    await api.followUser(user.authUserId);
                    showToast(`Followed ${displayUsername}`);
                    actionBtn.textContent = 'Unfollow';
                    actionBtn.style.backgroundColor = 'var(--bg-secondary)';
                    actionBtn.style.color = 'var(--text-primary)';
                    actionBtn.style.border = '1px solid var(--border-color)';
                } else {
                    await api.unfollowUser(user.authUserId);
                    showToast(`Unfollowed ${displayUsername}`);
                    actionBtn.textContent = 'Follow';
                    actionBtn.style.backgroundColor = 'var(--accent-color)';
                    actionBtn.style.color = '#fff';
                    actionBtn.style.border = 'none';
                }
                // Refresh profile details after relationship change
                renderProfile(container, targetUsername);
            } catch (err) {
                console.error('Follow/Unfollow action failed:', err);
                showToast(err.message || 'Action failed', 'error');
            } finally {
                actionBtn.disabled = false;
            }
        });
    }
    
    usernameRow.appendChild(username);
    usernameRow.appendChild(actionBtn);
    
    // Row 2: Stats (with Followers / Following lists integration)
    const stats = user.stats || { postsCount: 0, followersCount: 0, followingCount: 0 };
    const statsRow = el('div');
    statsRow.style.display = 'flex';
    statsRow.style.gap = '32px';
    
    const postsSpan = el('span');
    const postsCountEl = el('strong', '', `${stats.postsCount || 0}`);
    postsSpan.appendChild(postsCountEl);
    postsSpan.appendChild(document.createTextNode(' posts'));

    // Followers Stat (Click to open list modal)
    const followersSpan = el('span');
    followersSpan.style.cursor = 'pointer';
    const followersCountEl = el('strong', '', `${stats.followersCount || 0}`);
    followersSpan.appendChild(followersCountEl);
    followersSpan.appendChild(document.createTextNode(' followers'));
    followersSpan.addEventListener('click', () => {
        showConnectionsModal('Followers', user.authUserId, 'followers', myAuthUserId, () => renderProfile(container, targetUsername));
    });

    // Following Stat (Click to open list modal)
    const followingSpan = el('span');
    followingSpan.style.cursor = 'pointer';
    const followingCountEl = el('strong', '', `${stats.followingCount || 0}`);
    followingSpan.appendChild(followingCountEl);
    followingSpan.appendChild(document.createTextNode(' following'));
    followingSpan.addEventListener('click', () => {
        showConnectionsModal('Following', user.authUserId, 'following', myAuthUserId, () => renderProfile(container, targetUsername));
    });

    statsRow.appendChild(postsSpan);
    statsRow.appendChild(followersSpan);
    statsRow.appendChild(followingSpan);
    
    // Row 3: Biography and Personal Info
    const bioDetails = el('div');
    bioDetails.style.display = 'flex';
    bioDetails.style.flexDirection = 'column';
    bioDetails.style.gap = '4px';
    bioDetails.style.fontSize = '14px';

    if (user.profile && user.profile.fullName) {
        const fullNameEl = el('div', '', user.profile.fullName);
        fullNameEl.style.fontWeight = '600';
        bioDetails.appendChild(fullNameEl);
    }
    
    if (user.profile && user.profile.bio) {
        const bioEl = el('div', '', user.profile.bio);
        bioEl.style.whiteSpace = 'pre-wrap';
        bioDetails.appendChild(bioEl);
    }

    if (user.profile && user.profile.website) {
        const webLink = el('a', '', user.profile.website);
        webLink.href = user.profile.website.startsWith('http') ? user.profile.website : `https://${user.profile.website}`;
        webLink.target = '_blank';
        webLink.rel = 'noopener noreferrer';
        webLink.style.color = 'var(--accent-color)';
        webLink.style.fontWeight = '600';
        bioDetails.appendChild(webLink);
    }
    
    info.appendChild(usernameRow);
    info.appendChild(statsRow);
    info.appendChild(bioDetails);
    
    header.appendChild(avatarContainer);
    header.appendChild(info);
    profileContainer.appendChild(header);
    
    profileContainer.appendChild(el('hr', '', ''));
    
    // --- Posts Grid Section ---
    const grid = el('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    grid.style.gap = '4px';
    grid.style.marginTop = '16px';
    
    const loadingPostsMsg = el('p', '', 'Loading posts...');
    loadingPostsMsg.style.gridColumn = '1 / -1';
    loadingPostsMsg.style.textAlign = 'center';
    loadingPostsMsg.style.color = 'var(--text-secondary)';
    grid.appendChild(loadingPostsMsg);
    profileContainer.appendChild(grid);
    container.appendChild(profileContainer);

    // Async Fetch User Posts in Grid
    try {
        const postsRes = await api.getUserPosts(user.authUserId);
        grid.replaceChildren(); // clear loader

        if (postsRes && postsRes.success && postsRes.data && postsRes.data.length > 0) {
            postsRes.data.forEach(post => {
                const gridItem = el('div');
                gridItem.style.aspectRatio = '1 / 1';
                gridItem.style.position = 'relative';
                gridItem.style.overflow = 'hidden';
                gridItem.style.backgroundColor = 'var(--bg-elevated)';
                gridItem.style.cursor = 'pointer';

                const img = el('img');
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                
                // Get media thumbnail URL
                let postMediaUrl = '';
                if (post.media && post.media.length > 0) {
                    postMediaUrl = post.media[0].thumbnailUrl || post.media[0].url || '';
                }
                img.src = postMediaUrl || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiLz48Y2lyY2xlIGN4PSI4LjUiIGN5PSI4LjUiIHI9IjEuNSIvPjxwYXRoIGQ9Ik0yMSAxNWwtNS01TC01IDUgMTIgMTVsLTUtNSIvPjwvc3ZnPg==';
                gridItem.appendChild(img);

                // Overlay showing engagement metrics on hover
                const overlay = el('div');
                overlay.style.position = 'absolute';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
                overlay.style.opacity = '0';
                overlay.style.display = 'flex';
                overlay.style.alignItems = 'center';
                overlay.style.justifyContent = 'center';
                overlay.style.gap = '16px';
                overlay.style.transition = 'opacity 0.2s ease';
                overlay.style.color = '#fff';
                overlay.style.fontWeight = 'bold';

                const likesCount = el('span', '', `❤️ ${post.likesCount || 0}`);
                const commentsCount = el('span', '', `💬 ${post.commentsCount || 0}`);
                overlay.appendChild(likesCount);
                overlay.appendChild(commentsCount);
                gridItem.appendChild(overlay);

                gridItem.addEventListener('mouseenter', () => overlay.style.opacity = '1');
                gridItem.addEventListener('mouseleave', () => overlay.style.opacity = '0');

                grid.appendChild(gridItem);
            });
        } else {
            const noPosts = el('p', '', 'No posts yet.');
            noPosts.style.gridColumn = '1 / -1';
            noPosts.style.textAlign = 'center';
            noPosts.style.color = 'var(--text-secondary)';
            noPosts.style.marginTop = '32px';
            grid.appendChild(noPosts);
        }
    } catch (postsErr) {
        console.error('Error fetching user posts:', postsErr);
        grid.replaceChildren(); // clear loader
        const errPosts = el('p', '', 'Failed to load posts.');
        errPosts.style.gridColumn = '1 / -1';
        errPosts.style.textAlign = 'center';
        errPosts.style.color = 'var(--error-color)';
        errPosts.style.marginTop = '32px';
        grid.appendChild(errPosts);
    }
};
