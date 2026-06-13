import { api } from '../api.js';
import { navigate, showToast } from '../app.js';

export const renderCreatePost = (container) => {
    const postContainer = document.createElement('div');
    postContainer.className = 'create-post-container';
    
    // Header
    const header = document.createElement('div');
    header.className = 'create-header';
    const title = document.createElement('span');
    title.textContent = 'Create new post';
    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn-primary';
    nextBtn.textContent = 'Share';
    nextBtn.style.display = 'none'; // Hidden until image is selected
    
    header.appendChild(title);
    header.appendChild(nextBtn);
    
    // Body
    const body = document.createElement('div');
    body.className = 'create-body';
    
    // File upload area
    const uploadBox = document.createElement('div');
    uploadBox.className = 'file-upload-box';
    const uploadIcon = document.createElement('div');
    uploadIcon.style.fontSize = '48px';
    uploadIcon.textContent = '📸';
    const uploadText = document.createElement('p');
    uploadText.textContent = 'Drag photos here or click to select';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    
    const preview = document.createElement('img');
    preview.className = 'file-preview';
    
    uploadBox.appendChild(uploadIcon);
    uploadBox.appendChild(uploadText);
    uploadBox.appendChild(fileInput);
    uploadBox.appendChild(preview);
    
    // Caption area
    const captionInput = document.createElement('textarea');
    captionInput.className = 'caption-input';
    captionInput.placeholder = 'Write a caption...';
    captionInput.style.display = 'none';
    
    body.appendChild(uploadBox);
    body.appendChild(captionInput);
    
    postContainer.appendChild(header);
    postContainer.appendChild(body);
    container.appendChild(postContainer);
    
    let selectedFile = null;
    
    // Handle File Selection
    uploadBox.addEventListener('click', () => {
        if (!selectedFile) fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            selectedFile = e.target.files[0];
            
            // Show preview
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
                preview.style.display = 'block';
                uploadIcon.style.display = 'none';
                uploadText.style.display = 'none';
                
                // Show next steps
                captionInput.style.display = 'block';
                nextBtn.style.display = 'block';
                uploadBox.style.height = 'auto';
                uploadBox.style.border = 'none';
                uploadBox.style.cursor = 'default';
            };
            reader.readAsDataURL(selectedFile);
        }
    });
    
    // Handle Submit
    nextBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        
        nextBtn.disabled = true;
        nextBtn.textContent = 'Sharing...';
        
        try {
            // 1. Upload to Media Service
            const formData = new FormData();
            formData.append('file', selectedFile);
            const mediaRes = await api.uploadMedia(formData);
            
            // Ensure media is uploaded and we get a URL
            const imageUrl = mediaRes.url || (mediaRes.data && mediaRes.data.url) || null;
            if (!imageUrl) {
                throw new Error("Failed to upload image. No URL returned.");
            }
            
            // 2. Create Post in Posts Service
            const caption = captionInput.value;
            await api.createPost({
                imageUrl,
                caption,
                media_type: 'image'
            });
            
            showToast('Post created successfully!');
            navigate('feed');
        } catch (error) {
            showToast('Failed to create post: ' + error.message, 'error');
            nextBtn.disabled = false;
            nextBtn.textContent = 'Share';
        }
    });
};
