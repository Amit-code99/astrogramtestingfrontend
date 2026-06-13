import { api, getCurrentUser } from '../api.js';
import { showToast } from '../app.js';
import { Room, RoomEvent, createLocalTracks, VideoPresets } from 'https://cdn.jsdelivr.net/npm/livekit-client@2.6.2/dist/livekit-client.esm.mjs';

// ── FIX 1: Hardcoded localhost ki jagah current window ka IP dynamically use karein ──
const currentIP = window.location.hostname; // Yeh automatic '192.168.1.23' ya 'localhost' utha lega
const LIVEKIT_URL =`ws://${currentIP}:7880`;


// ── Secure DOM helper — all text goes via textContent, no innerHTML ──
const el = (tag, className = '', text = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
};

// ── State ──
let refreshTimer = null;
let currentView = 'grid'; // 'grid' | 'create' | 'viewer' | 'history'
let currentSessionId = null;
let activeRoom = null;

// ── Cleanup on unmount ──
const cleanup = () => {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
    if (activeRoom) {
        activeRoom.disconnect();
        activeRoom = null;
    }
};

// ── Time formatting helpers ──
const formatElapsed = (startedAt) => {
    if (!startedAt) return '';
    const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    const hours = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    return `${hours}h ${mins}m`;
};

const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '—';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
};

const formatViewerCount = (count) => {
    if (!count && count !== 0) return '0';
    if (count >= 10000) return `${(count / 1000).toFixed(1)}K`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return String(count);
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};

// ══════════════════════════════════════════════════════════════════════
// ── MAIN ENTRY — renderLive ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════
export const renderLive = async (container) => {
    cleanup();
    currentView = 'grid';
    currentSessionId = null;

    const wrapper = el('div', 'live-container');
    wrapper.id = 'live-root';
    container.appendChild(wrapper);

    renderActiveStreamsView(wrapper);
};

// ══════════════════════════════════════════════════════════════════════
// ── VIEW 1: Active Streams Grid ──────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════
const renderActiveStreamsView = async (container) => {
    cleanup();
    currentView = 'grid';
    container.replaceChildren();

    // Header
    const header = el('div', 'live-header');

    const titleDiv = el('div', 'live-header-title');
    titleDiv.appendChild(el('span', '', '🔴'));
    titleDiv.appendChild(el('span', '', 'Live'));
    header.appendChild(titleDiv);

    const actions = el('div', 'live-header-actions');

    const activeTab = el('button', 'live-tab-btn active', 'Active');
    activeTab.id = 'live-tab-active';
    activeTab.addEventListener('click', () => renderActiveStreamsView(container));

    const historyTab = el('button', 'live-tab-btn', 'History');
    historyTab.id = 'live-tab-history';
    historyTab.addEventListener('click', () => renderHistoryView(container));

    const goLiveBtn = el('button', 'live-tab-btn go-live-btn', '📡 Go Live');
    goLiveBtn.id = 'live-go-live-btn';
    goLiveBtn.addEventListener('click', () => renderGoLiveView(container));

    actions.appendChild(activeTab);
    actions.appendChild(historyTab);
    actions.appendChild(goLiveBtn);
    header.appendChild(actions);

    container.appendChild(header);

    // Grid container
    const grid = el('div', 'live-grid');
    grid.id = 'live-streams-grid';
    container.appendChild(grid);

    // Loading spinner
    const spinner = el('div', 'spinner');
    grid.appendChild(spinner);

    // Fetch and render
    await loadActiveStreams(grid);

    // Auto-refresh every 15 seconds
    refreshTimer = setInterval(() => {
        if (currentView === 'grid') {
            loadActiveStreams(grid, true);
        }
    }, 15000);
};

const loadActiveStreams = async (grid, isRefresh = false) => {
    try {
        if (!isRefresh) {
            grid.replaceChildren();
            grid.appendChild(el('div', 'spinner'));
        }

        const response = await api.getActiveSessions(1, 20);
        const sessions = (response.data && response.data.items) || [];

        grid.replaceChildren();

        if (sessions.length === 0) {
            const emptyState = el('div', 'live-empty-state');
            emptyState.appendChild(el('div', 'live-empty-icon', '📡'));
            emptyState.appendChild(el('div', 'live-empty-text', 'No one is live right now'));
            emptyState.appendChild(el('div', 'live-empty-subtext', 'Start your own live stream or check back later!'));
            emptyState.style.gridColumn = '1 / -1';
            grid.appendChild(emptyState);
            return;
        }

        sessions.forEach(session => {
            grid.appendChild(createStreamCard(session, grid));
        });
    } catch (error) {
        grid.replaceChildren();
        const errDiv = el('div', 'live-empty-state');
        errDiv.appendChild(el('div', 'live-empty-icon', '⚠️'));
        errDiv.appendChild(el('div', 'live-empty-text', 'Could not load live streams'));
        errDiv.appendChild(el('div', 'live-empty-subtext', error.message || 'Please try again'));
        errDiv.style.gridColumn = '1 / -1';
        grid.appendChild(errDiv);
        if (!isRefresh) {
            showToast('Failed to load active streams', 'error');
        }
    }
};

const createStreamCard = (session, parentGrid) => {
    const card = el('div', 'live-card');
    card.id = `live-card-${session.id}`;

    // Thumbnail image
    const thumb = document.createElement('img');
    thumb.className = 'live-card-thumbnail';
    thumb.alt = 'Stream thumbnail';
    thumb.loading = 'lazy';
    if (session.thumbnailUrl) {
        thumb.src = session.thumbnailUrl;
    } else {
        thumb.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjUwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMxYTFhMmUiLz48c3RvcCBvZmZzZXQ9IjUwJSIgc3RvcC1jb2xvcj0iIzE2MjEzZSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzBmM2Q2MCIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMjUwIiBmaWxsPSJ1cmwoI2gpfSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIzNiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjE1KSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPvCfjqU8L3RleHQ+PC9zdmc+';
    }
    thumb.onerror = () => {
        thumb.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjUwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI1MCIgZmlsbD0iIzFhMWEyZSIvPjwvc3ZnPg==';
    };
    card.appendChild(thumb);

    // Overlay
    const overlay = el('div', 'live-card-overlay');

    // Top row: LIVE badge + viewer count
    const topRow = el('div', 'live-card-top');

    const badge = el('span', 'live-badge');
    badge.appendChild(el('span', 'live-badge-dot'));
    badge.appendChild(document.createTextNode(' LIVE'));
    topRow.appendChild(badge);

    const viewers = el('span', 'live-viewer-count');
    viewers.appendChild(document.createTextNode('👁 '));
    viewers.appendChild(document.createTextNode(formatViewerCount(session.viewerCount)));
    topRow.appendChild(viewers);

    overlay.appendChild(topRow);

    // Bottom row: title + host + elapsed
    const bottomRow = el('div', 'live-card-bottom');
    bottomRow.appendChild(el('div', 'live-card-title', session.title || 'Live Stream'));
    bottomRow.appendChild(el('div', 'live-card-host', `Host: ${session.hostId ? session.hostId.substring(0, 8) : 'Unknown'}...`));
    if (session.startedAt) {
        bottomRow.appendChild(el('div', 'live-card-elapsed', `Started ${formatElapsed(session.startedAt)}`));
    }
    overlay.appendChild(bottomRow);

    // Host actions
    const currentUser = getCurrentUser();
    const isHost = currentUser && (
        currentUser.id === session.hostId ||
        currentUser.userId === session.hostId ||
        currentUser._id === session.hostId ||
        currentUser.authUserId === session.hostId
    );

    if (isHost) {
        const endBtn = el('button', 'live-media-btn', '⏹ End Stream');
        endBtn.style.position = 'absolute';
        endBtn.style.top = '10px';
        endBtn.style.right = '10px';
        endBtn.style.zIndex = '10';
        endBtn.style.background = 'rgba(255,0,0,0.7)';
        endBtn.style.border = 'none';
        endBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            endBtn.disabled = true;
            endBtn.textContent = 'Ending...';
            try {
                await api.endLiveSession(session.id);
                showToast('Stuck session cleared', 'success');
                const root = document.getElementById('live-root');
                if (root) renderActiveStreamsView(root);
            } catch (err) {
                console.error('Failed to end session:', err);
                showToast('Failed to end: ' + err.message, 'error');
                endBtn.disabled = false;
                endBtn.textContent = '⏹ End Stream';
            }
        });
        overlay.appendChild(endBtn);
    }

    card.appendChild(overlay);

    card.addEventListener('click', () => {
        const root = document.getElementById('live-root');
        if (root) {
            renderViewerScreen(root, session.id);
        }
    });

    return card;
};

// ══════════════════════════════════════════════════════════════════════
// ── VIEW 2: Go Live Form ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════
const renderGoLiveView = (container) => {
    cleanup();
    currentView = 'create';
    container.replaceChildren();

    const formContainer = el('div', 'go-live-container');
    formContainer.appendChild(el('h2', '', '📡 Go Live'));
    formContainer.appendChild(el('p', 'go-live-subtitle', 'Start a live stream and share with your followers'));

    const form = el('div', 'go-live-form');

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'go-live-input';
    titleInput.id = 'go-live-title';
    titleInput.placeholder = 'Enter your stream title...';
    titleInput.maxLength = 150;
    titleInput.autocomplete = 'off';
    form.appendChild(titleInput);

    const charCount = el('div', 'go-live-char-count', '0 / 150');
    charCount.id = 'go-live-char-count';
    form.appendChild(charCount);

    titleInput.addEventListener('input', () => {
        charCount.textContent = `${titleInput.value.length} / 150`;
    });

    const thumbInput = document.createElement('input');
    thumbInput.type = 'url';
    thumbInput.className = 'go-live-input';
    thumbInput.id = 'go-live-thumbnail';
    thumbInput.placeholder = 'Thumbnail URL (optional)';
    thumbInput.autocomplete = 'off';
    form.appendChild(thumbInput);

    const submitBtn = el('button', 'go-live-submit', '🔴 Start Live Stream');
    submitBtn.id = 'go-live-submit-btn';
    submitBtn.type = 'button';
    form.appendChild(submitBtn);

    const backBtn = el('button', 'go-live-back', '← Back to Active Streams');
    backBtn.type = 'button';
    backBtn.addEventListener('click', () => renderActiveStreamsView(container));
    form.appendChild(backBtn);

    formContainer.appendChild(form);
    container.appendChild(formContainer);

    titleInput.focus();

    submitBtn.addEventListener('click', async () => {
        const title = titleInput.value.trim();
        if (!title) {
            showToast('Please enter a stream title', 'error');
            titleInput.focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating session...';

        try {
            const thumbnailUrl = thumbInput.value.trim() || null;
            const response = await api.createLiveSession(title, thumbnailUrl);
            const data = response.data || response;

            showToast('Live session created successfully!', 'success');
            renderSessionCreated(container, data);
        } catch (error) {
            showToast('Failed to create live session: ' + error.message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = '🔴 Start Live Stream';
        }
    });

    titleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            submitBtn.click();
        }
    });
};

const renderSessionCreated = (container, data) => {
    container.replaceChildren();

    const success = el('div', 'live-success');
    success.appendChild(el('div', 'live-success-icon', '🎉'));
    success.appendChild(el('h2', '', 'You Are Live!'));

    const session = data.session || data;

    success.appendChild(el('p', 'live-success-detail', `Title: ${session.title || 'Live Stream'}`));
    success.appendChild(el('p', 'live-success-detail', `Session ID: ${session.id}`));
    success.appendChild(el('p', 'live-success-detail', `Room: ${data.roomName || session.roomName}`));
    success.appendChild(el('p', 'live-success-detail', `Status: ${session.status}`));

    const note = el('div', 'live-success-note');
    note.textContent = '💡 Use the LiveKit token returned above with the LiveKit Client SDK in your mobile/desktop app to start broadcasting. The session will transition from "pending" to "live" once you connect to the LiveKit server.';
    success.appendChild(note);

    if (data.token) {
        const tokenLabel = el('p', 'live-success-detail');
        tokenLabel.textContent = `Token: ${data.token.substring(0, 40)}...`;
        success.appendChild(tokenLabel);
    }

    const btnRow = el('div', 'live-header-actions');
    btnRow.style.justifyContent = 'center';
    btnRow.style.marginTop = '16px';

    const viewBtn = el('button', 'live-tab-btn active', '📺 View Session');
    viewBtn.addEventListener('click', () => renderViewerScreen(container, session.id));
    btnRow.appendChild(viewBtn);

    const backBtn = el('button', 'live-tab-btn', '← Back');
    backBtn.addEventListener('click', () => renderActiveStreamsView(container));
    btnRow.appendChild(backBtn);

    success.appendChild(btnRow);
    container.appendChild(success);
};

// ══════════════════════════════════════════════════════════════════════
// ── VIEW 3: Live Viewer Screen ───────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════
const renderViewerScreen = async (container, sessionId) => {
    cleanup();
    currentView = 'viewer';
    currentSessionId = sessionId;
    container.replaceChildren();

    const screen = el('div', 'live-viewer-screen');
    screen.appendChild(el('div', 'spinner'));
    container.appendChild(screen);

    try {
        const joinRes = await api.joinLiveSession(sessionId);
        const joinData = joinRes.data || joinRes;
        const session = joinData.session || joinData;

        screen.replaceChildren();

        const videoArea = el('div', 'live-video-area');
        const topBar = el('div', 'live-video-top-bar');

        const badge = el('span', 'live-badge');
        badge.appendChild(el('span', 'live-badge-dot'));
        badge.appendChild(document.createTextNode(' LIVE'));
        topBar.appendChild(badge);

        const viewerBadge = el('span', 'live-viewer-count');
        viewerBadge.id = 'viewer-count-display';
        viewerBadge.appendChild(document.createTextNode('👁 '));
        viewerBadge.appendChild(document.createTextNode(formatViewerCount(session.viewerCount || joinData.viewerCount || 0)));
        topBar.appendChild(viewerBadge);

        videoArea.appendChild(topBar);

        const videoGrid = el('div', 'live-video-grid');
        videoArea.appendChild(videoGrid);

        const waitingPlaceholder = el('div', 'live-video-placeholder');
        waitingPlaceholder.id = 'live-waiting-placeholder';
        waitingPlaceholder.appendChild(el('div', '', '⏳'));
        const waitingText = el('div', '', 'Connecting to stream...');
        waitingText.style.fontSize = '16px';
        waitingText.style.fontWeight = '600';
        waitingText.style.marginTop = '8px';
        waitingPlaceholder.appendChild(waitingText);
        videoGrid.appendChild(waitingPlaceholder);

        screen.appendChild(videoArea);

        const currentUser = getCurrentUser();
        const isHost = currentUser && (
            currentUser.id === session.hostId ||
            currentUser.userId === session.hostId ||
            currentUser._id === session.hostId ||
            currentUser.authUserId === session.hostId
        );

        let localVideoTrack = null;
        let localAudioTrack = null;
        let isVideoMuted = false;
        let isAudioMuted = false;

        activeRoom = new Room({
            adaptiveStream: true,
            dynacast: true,
            videoCaptureDefaults: {
                resolution: VideoPresets.h720.resolution,
            },
        });

        const removeWaitingPlaceholder = () => {
            const ph = document.getElementById('live-waiting-placeholder');
            if (ph) ph.remove();
        };

        const attachTrack = (track) => {
            if (track.kind === 'video' || track.kind === 'audio') {
                removeWaitingPlaceholder();
                const element = track.attach();
                element.id = `track-${track.sid || Math.random()}`;
                if (track.kind === 'video') {
                    element.className = 'live-video-element';
                }
                videoGrid.appendChild(element);
            }
        };

        const detachTrack = (track) => {
            track.detach().forEach(el => el.remove());
        };

        activeRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            console.log('[LiveKit] TrackSubscribed:', track.kind, track.sid);
            attachTrack(track);
        });

        activeRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
            console.log('[LiveKit] TrackUnsubscribed:', track.kind, track.sid);
            detachTrack(track);
        });

        try {
            // FIX 2: Dynamic URL se connect karein taaki IP setup break na ho
            await activeRoom.connect(LIVEKIT_URL, joinData.token);
            console.log('[LiveKit] Connected to room:', activeRoom.name);
        } catch (e) {
            console.error('[LiveKit] Failed to connect:', e);
            showToast('Failed to connect to video stream: ' + e.message, 'error');
        }

        if (isHost) {
            try {
                const tracks = await createLocalTracks({
                    audio: true,
                    video: true,
                });
                for (const track of tracks) {
                    await activeRoom.localParticipant.publishTrack(track);
                    attachTrack(track);
                    if (track.kind === 'video') localVideoTrack = track;
                    if (track.kind === 'audio') localAudioTrack = track;
                }
                console.log('[LiveKit] Local tracks published successfully');
            } catch (err) {
                console.error('[LiveKit] Error accessing media devices:', err);
                showToast('Could not access camera/microphone. Please allow permissions.', 'error');

                // FIX 3: Status error ke baad bhi control element recovery mechanism implement kiya hai
                const ph = document.getElementById('live-waiting-placeholder');
                if (ph) {
                    ph.replaceChildren();
                    ph.appendChild(el('div', '', '📷'));
                    const errText = el('div', '', 'Camera access denied / Security Block');
                    errText.style.fontSize = '16px';
                    errText.style.fontWeight = '600';
                    errText.style.marginTop = '8px';
                    ph.appendChild(errText);
                    ph.appendChild(el('div', '', 'Please verify Chrome flag bypass and allow media permissions.'));

                    const errEndBtn = el('button', 'live-end-btn', '⏹ End Stream');
                    errEndBtn.style.marginTop = '20px';
                    errEndBtn.addEventListener('click', async () => {
                        errEndBtn.disabled = true;
                        errEndBtn.textContent = 'Ending...';
                        try {
                            await api.endLiveSession(sessionId);
                            showToast('Live stream ended', 'success');
                            renderActiveStreamsView(container);
                        } catch (error) {
                            showToast('Failed to end stream: ' + error.message, 'error');
                            errEndBtn.disabled = false;
                            errEndBtn.textContent = '⏹ End Stream';
                        }
                    });
                    ph.appendChild(errEndBtn);
                }
            }
        } else {
            waitingText.textContent = 'Waiting for host to start broadcasting...';
        }

        if (isHost) {
            const controlsBar = el('div', 'live-media-controls');

            const toggleVideoBtn = el('button', 'live-media-btn active', '📹 Camera On');
            toggleVideoBtn.id = 'live-toggle-video';
            toggleVideoBtn.addEventListener('click', () => {
                if (localVideoTrack) {
                    if (isVideoMuted) {
                        localVideoTrack.unmute();
                        isVideoMuted = false;
                        toggleVideoBtn.textContent = '📹 Camera On';
                        toggleVideoBtn.className = 'live-media-btn active';
                    } else {
                        localVideoTrack.mute();
                        isVideoMuted = true;
                        toggleVideoBtn.textContent = '📹 Camera Off';
                        toggleVideoBtn.className = 'live-media-btn';
                    }
                }
            });
            controlsBar.appendChild(toggleVideoBtn);

            const toggleAudioBtn = el('button', 'live-media-btn active', '🎤 Mic On');
            toggleAudioBtn.id = 'live-toggle-audio';
            toggleAudioBtn.addEventListener('click', () => {
                if (localAudioTrack) {
                    if (isAudioMuted) {
                        localAudioTrack.unmute();
                        isAudioMuted = false;
                        toggleAudioBtn.textContent = '🎤 Mic On';
                        toggleAudioBtn.className = 'live-media-btn active';
                    } else {
                        localAudioTrack.mute();
                        isAudioMuted = true;
                        toggleAudioBtn.textContent = '🎤 Mic Off';
                        toggleAudioBtn.className = 'live-media-btn';
                    }
                }
            });
            controlsBar.appendChild(toggleAudioBtn);

            screen.appendChild(controlsBar);
        }

        const infoBar = el('div', 'live-video-info');
        const meta = el('div', 'live-video-meta');
        meta.appendChild(el('div', 'live-video-title', session.title || 'Live Stream'));

        const hostText = `Host: ${session.hostId ? session.hostId.substring(0, 8) : 'Unknown'}...`;
        meta.appendChild(el('div', 'live-video-host-name', hostText));

        if (session.startedAt) {
            meta.appendChild(el('div', 'live-video-host-name', `Started ${formatElapsed(session.startedAt)}`));
        }
        infoBar.appendChild(meta);

        const actionsDiv = el('div', 'live-video-actions');

        if (isHost) {
            const endBtn = el('button', 'live-end-btn', '⏹ End Stream');
            endBtn.id = 'live-end-stream-btn';
            endBtn.addEventListener('click', async () => {
                endBtn.disabled = true;
                endBtn.textContent = 'Ending...';
                try {
                    await api.endLiveSession(sessionId);
                    showToast('Live stream ended', 'success');
                    renderActiveStreamsView(container);
                } catch (error) {
                    showToast('Failed to end stream: ' + error.message, 'error');
                    endBtn.disabled = false;
                    endBtn.textContent = '⏹ End Stream';
                }
            });
            actionsDiv.appendChild(endBtn);
        }

        const leaveBtn = el('button', 'live-leave-btn', '← Leave');
        leaveBtn.id = 'live-leave-btn';
        leaveBtn.addEventListener('click', async () => {
            leaveBtn.disabled = true;
            try {
                if (isHost) {
                    await api.endLiveSession(sessionId);
                    showToast('Live stream ended', 'success');
                } else {
                    await api.leaveLiveSession(sessionId);
                    showToast('Left the live stream', 'success');
                }
            } catch (error) {
                // Ignore error
            }
            renderActiveStreamsView(container);
        });
        actionsDiv.appendChild(leaveBtn);

        infoBar.appendChild(actionsDiv);
        screen.appendChild(infoBar);

        if (joinData.token) {
            const tokenNote = el('div', 'live-success-note');
            tokenNote.textContent = `🔗 LiveKit Room: ${joinData.roomName || session.roomName || 'N/A'} — Dynamic Link Activated.`;
            screen.appendChild(tokenNote);
        }

        refreshTimer = setInterval(async () => {
            if (currentView !== 'viewer') return;
            try {
                const detailRes = await api.getSessionDetails(sessionId);
                const detail = detailRes.data || detailRes;
                const countEl = document.getElementById('viewer-count-display');
                if (countEl) {
                    countEl.textContent = '';
                    countEl.appendChild(document.createTextNode('👁 '));
                    countEl.appendChild(document.createTextNode(formatViewerCount(detail.viewerCount || 0)));
                }
                if (detail.status === 'ended' || detail.status === 'cancelled') {
                    cleanup();
                    showToast('This live stream has ended', 'error');
                    renderActiveStreamsView(container);
                }
            } catch (e) {
                // Ignore
            }
        }, 10000);

    } catch (error) {
        screen.replaceChildren();
        const errDiv = el('div', 'live-empty-state');
        errDiv.appendChild(el('div', 'live-empty-icon', '😕'));
        errDiv.appendChild(el('div', 'live-empty-text', 'Could not join live stream'));
        errDiv.appendChild(el('div', 'live-empty-subtext', error.message || 'The stream may have ended'));

        const backBtn = el('button', 'live-tab-btn', '← Back to Active Streams');
        backBtn.style.marginTop = '16px';
        backBtn.addEventListener('click', () => renderActiveStreamsView(container));
        errDiv.appendChild(backBtn);

        screen.appendChild(errDiv);
    }
};

// ══════════════════════════════════════════════════════════════════════
// ── VIEW 4: Stream History ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════
const renderHistoryView = async (container) => {
    cleanup();
    currentView = 'history';
    container.replaceChildren();

    const header = el('div', 'live-header');

    const titleDiv = el('div', 'live-header-title');
    titleDiv.appendChild(el('span', '', '🔴'));
    titleDiv.appendChild(el('span', '', 'Live'));
    header.appendChild(titleDiv);

    const actions = el('div', 'live-header-actions');

    const activeTab = el('button', 'live-tab-btn', 'Active');
    activeTab.id = 'live-tab-active';
    activeTab.addEventListener('click', () => renderActiveStreamsView(container));

    const historyTab = el('button', 'live-tab-btn active', 'History');
    historyTab.id = 'live-tab-history';

    const goLiveBtn = el('button', 'live-tab-btn go-live-btn', '📡 Go Live');
    goLiveBtn.id = 'live-go-live-btn';
    goLiveBtn.addEventListener('click', () => renderGoLiveView(container));

    actions.appendChild(activeTab);
    actions.appendChild(historyTab);
    actions.appendChild(goLiveBtn);
    header.appendChild(actions);
    container.appendChild(header);

    const list = el('div', 'live-history-list');
    list.id = 'live-history-list';
    list.appendChild(el('div', 'spinner'));
    container.appendChild(list);

    try {
        const response = await api.getStreamHistory(1, 20);
        const sessions = (response.data && response.data.items) || [];

        list.replaceChildren();

        if (sessions.length === 0) {
            const emptyState = el('div', 'live-empty-state');
            emptyState.appendChild(el('div', 'live-empty-icon', '📼'));
            emptyState.appendChild(el('div', 'live-empty-text', 'No stream history yet'));
            emptyState.appendChild(el('div', 'live-empty-subtext', 'Your past live streams will appear here'));
            list.appendChild(emptyState);
            return;
        }

        sessions.forEach(session => {
            list.appendChild(createHistoryItem(session));
        });
    } catch (error) {
        list.replaceChildren();
        const errDiv = el('div', 'live-empty-state');
        errDiv.appendChild(el('div', 'live-empty-icon', '⚠️'));
        errDiv.appendChild(el('div', 'live-empty-text', 'Could not load stream history'));
        errDiv.appendChild(el('div', 'live-empty-subtext', error.message || 'Please try again'));
        list.appendChild(errDiv);
        showToast('Failed to load stream history', 'error');
    }
};

const createHistoryItem = (session) => {
    const item = el('div', 'live-history-item');
    item.id = `live-history-${session.id}`;

    const icon = el('div', 'live-history-icon');
    icon.textContent = session.status === 'ended' ? '📹' : '🚫';
    item.appendChild(icon);

    const info = el('div', 'live-history-info');

    const titleRow = el('div');
    titleRow.style.display = 'flex';
    titleRow.style.alignItems = 'center';
    titleRow.style.gap = '8px';

    titleRow.appendChild(el('span', 'live-history-title', session.title || 'Live Stream'));

    const statusBadge = el('span', `live-status-badge ${session.status || 'ended'}`);
    statusBadge.textContent = session.status || 'ended';
    titleRow.appendChild(statusBadge);

    info.appendChild(titleRow);

    const dateStr = session.endedAt
        ? `Ended: ${formatDate(session.endedAt)}`
        : session.startedAt
            ? `Started: ${formatDate(session.startedAt)}`
            : `Created: ${formatDate(session.createdAt)}`;
    info.appendChild(el('div', 'live-history-date', dateStr));

    item.appendChild(info);

    const stats = el('div', 'live-history-stats');

    const durationStat = el('div', 'live-history-stat');
    durationStat.appendChild(el('span', 'live-history-stat-value', formatDuration(session.durationSeconds)));
    durationStat.appendChild(el('span', '', 'Duration'));
    stats.appendChild(durationStat);

    const peakStat = el('div', 'live-history-stat');
    peakStat.appendChild(el('span', 'live-history-stat-value', formatViewerCount(session.peakViewerCount)));
    peakStat.appendChild(el('span', '', 'Peak'));
    stats.appendChild(peakStat);

    const finalStat = el('div', 'live-history-stat');
    finalStat.appendChild(el('span', 'live-history-stat-value', formatViewerCount(session.viewerCount)));
    finalStat.appendChild(el('span', '', 'Final'));
    stats.appendChild(finalStat);

    item.appendChild(stats);

    return item;
};