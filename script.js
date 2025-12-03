const imageInput = document.getElementById('imageInput');
const sliderContainer = document.getElementById('sliderContainer');
const progressSlider = document.getElementById('progressSlider');
const mainDisplay = document.getElementById('mainDisplay');
const thumbnailsContainer = document.getElementById('thumbnails');
const imageLabel = document.getElementById('imageLabel');
const compositeTitleInput = document.getElementById('compositeTitle');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const ghostModeCheckbox = document.getElementById('ghostMode');
const createGifBtn = document.getElementById('createGifBtn');
const createCompositeBtn = document.getElementById('createCompositeBtn');
const rotateLeftBtn = document.getElementById('rotateLeftBtn');
const rotateRightBtn = document.getElementById('rotateRightBtn');
const flipBtn = document.getElementById('flipBtn');
const resetAllBtn = document.getElementById('resetAllBtn');
const themeToggle = document.getElementById('themeToggle');
const gifResult = document.getElementById('gifResult');
const compositeResult = document.getElementById('compositeResult');

let images = [];

// Theme handling
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.toggle('light-theme', savedTheme === 'light');
    updateThemeIcon();
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeIcon();
}

function updateThemeIcon() {
    const isLight = document.body.classList.contains('light-theme');
    themeToggle.textContent = isLight ? '☀️' : '🌙';
    themeToggle.title = isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode';
}

themeToggle.addEventListener('click', toggleTheme);
initTheme();

imageInput.addEventListener('change', handleFiles);
progressSlider.addEventListener('input', handleSlider);
ghostModeCheckbox.addEventListener('change', () => updateView(parseInt(progressSlider.value)));
createGifBtn.addEventListener('click', createGif);
createCompositeBtn.addEventListener('click', createComposite);
rotateLeftBtn.addEventListener('click', () => rotateImage(-90));
rotateRightBtn.addEventListener('click', () => rotateImage(90));
flipBtn.addEventListener('click', flipImage);
resetAllBtn.addEventListener('click', resetAllTransforms);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; // Ignore if typing in inputs
    
    const index = parseInt(progressSlider.value);
    switch (e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            if (index > 0) {
                progressSlider.value = index - 1;
                updateView(index - 1);
            }
            break;
        case 'ArrowRight':
            e.preventDefault();
            if (index < images.length - 1) {
                progressSlider.value = index + 1;
                updateView(index + 1);
            }
            break;
        case 'r':
        case 'R':
            e.preventDefault();
            rotateImage(90);
            break;
        case 'l':
        case 'L':
            e.preventDefault();
            rotateImage(-90);
            break;
        case 'f':
        case 'F':
            e.preventDefault();
            flipImage();
            break;
        case 'g':
        case 'G':
            e.preventDefault();
            if (!createGifBtn.disabled) createGif();
            break;
        case 'c':
        case 'C':
            e.preventDefault();
            if (!createCompositeBtn.disabled) createComposite();
            break;
        case 't':
        case 'T':
            e.preventDefault();
            toggleTheme();
            break;
    }
});

imageLabel.addEventListener('input', (e) => {
    const index = parseInt(progressSlider.value);
    if (images[index]) {
        images[index].customLabel = e.target.value;
    }
});

function handleFiles(e) {
    const files = Array.from(e.target.files);
    
    if (files.length === 0) return;

    // Validate files
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const invalidFiles = files.filter(file => file.size > maxFileSize || !allowedTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
        alert(`Some files are invalid:\n- Max size: 10MB\n- Allowed types: JPEG, PNG, WebP\n\nPlease check and try again.`);
        return;
    }

    if (files.length > 6) {
        alert('Please select up to 6 images.');
        return;
    }

    // Sort files by last modified date (oldest first)
    files.sort((a, b) => a.lastModified - b.lastModified);

    // Clear previous
    images = [];
    mainDisplay.innerHTML = '';
    thumbnailsContainer.innerHTML = '';
    gifResult.classList.add('hidden');
    gifResult.innerHTML = '';
    compositeResult.classList.add('hidden');
    compositeResult.innerHTML = '';

    let loadedCount = 0;
    let failedCount = 0;

    files.forEach((file, index) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            try {
                const dateObj = new Date(file.lastModified);
                const monthYear = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                
                const imgObj = {
                    src: event.target.result,
                    name: file.name,
                    nameWithoutExt: nameWithoutExt,
                    date: dateObj.toLocaleDateString(),
                    monthYear: monthYear,
                    sortIndex: index,
                    rotation: 0,
                    flipped: false
                };
                
                images.push(imgObj);
                loadedCount++;
                if (loadedCount === files.length - failedCount) {
                    images.sort((a, b) => a.sortIndex - b.sortIndex);
                    initializeViewer();
                }
            } catch (error) {
                console.error('Error processing image:', error);
                failedCount++;
                if (loadedCount + failedCount === files.length) {
                    if (loadedCount > 0) {
                        images.sort((a, b) => a.sortIndex - b.sortIndex);
                        initializeViewer();
                    } else {
                        alert('Failed to load any images. Please try different files.');
                    }
                }
            }
        };

        reader.onerror = () => {
            console.error('File read error for:', file.name);
            failedCount++;
            if (loadedCount + failedCount === files.length) {
                if (loadedCount > 0) {
                    images.sort((a, b) => a.sortIndex - b.sortIndex);
                    initializeViewer();
                } else {
                    alert('Failed to load any images. Please try different files.');
                }
            }
        };

        reader.readAsDataURL(file);
    });
}

function initializeViewer() {
    if (images.length === 0) return;

    // Clear containers to prevent duplication on re-render
    mainDisplay.innerHTML = '';
    thumbnailsContainer.innerHTML = '';

    sliderContainer.classList.remove('hidden');
    progressSlider.max = images.length - 1;
    progressSlider.value = 0;

    images.forEach((imgData, idx) => {
        const img = document.createElement('img');
        img.src = imgData.src;
        img.id = `img-${idx}`;
        if (idx === 0) img.classList.add('active');
        mainDisplay.appendChild(img);

        const thumb = document.createElement('img');
        thumb.src = imgData.src;
        thumb.classList.add('thumbnail');
        thumb.draggable = true; // Enable drag
        thumb.dataset.index = idx; // Store index

        if (idx === 0) thumb.classList.add('active');
        
        thumb.addEventListener('click', () => {
            progressSlider.value = idx;
            updateView(idx);
        });

        // Drag Events
        thumb.addEventListener('dragstart', handleDragStart);
        thumb.addEventListener('dragover', handleDragOver);
        thumb.addEventListener('drop', handleDrop);
        thumb.addEventListener('dragenter', handleDragEnter);
        thumb.addEventListener('dragleave', handleDragLeave);

        thumbnailsContainer.appendChild(thumb);
    });

    updateView(0);
}

let draggedItemIndex = null;

function handleDragStart(e) {
    draggedItemIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.stopPropagation(); // stops the browser from redirecting.
    e.preventDefault();

    const dropTargetIndex = parseInt(this.dataset.index);

    if (draggedItemIndex !== null && draggedItemIndex !== dropTargetIndex) {
        // Reorder array
        const itemToMove = images[draggedItemIndex];
        images.splice(draggedItemIndex, 1);
        images.splice(dropTargetIndex, 0, itemToMove);

        // Re-initialize viewer with new order
        // We need to update sortIndex if we want to persist this order logic, 
        // but for now just re-rendering based on the array order is enough.
        // However, initializeViewer relies on the array order.
        
        // Update sortIndex to match new array order just in case
        images.forEach((img, idx) => img.sortIndex = idx);

        initializeViewer();
        
        // Restore view to the dropped item
        progressSlider.value = dropTargetIndex;
        updateView(dropTargetIndex);
    }
    
    return false;
}

function handleSlider(e) {
    const index = parseInt(e.target.value);
    updateView(index);
}

function rotateImage(deg) {
    const index = parseInt(progressSlider.value);
    if (images[index]) {
        images[index].rotation = (images[index].rotation + deg) % 360;
        updateView(index);
    }
}

function flipImage() {
    const index = parseInt(progressSlider.value);
    if (images[index]) {
        images[index].flipped = !images[index].flipped;
        updateView(index);
    }
}

function resetAllTransforms() {
    images.forEach(img => {
        img.rotation = 0;
        img.flipped = false;
    });
    const index = parseInt(progressSlider.value);
    updateView(index);
}

function updateView(index) {
    const allImages = mainDisplay.querySelectorAll('img');
    allImages.forEach(img => {
        img.classList.remove('active');
        // Reset transform for inactive images to avoid weird transitions if we want, 
        // but keeping it might be better. 
        // Actually, we should set the transform based on the data.
    });
    
    const activeImg = document.getElementById(`img-${index}`);
    if (activeImg) {
        activeImg.classList.add('active');
        if (images[index]) {
            const rotation = images[index].rotation || 0;
            const scaleX = images[index].flipped ? -1 : 1;
            activeImg.style.transform = `rotate(${rotation}deg) scaleX(${scaleX})`;
        }
    }

    const allThumbs = thumbnailsContainer.querySelectorAll('.thumbnail');
    allThumbs.forEach(thumb => thumb.classList.remove('active'));
    if (allThumbs[index]) allThumbs[index].classList.add('active');

    if (images[index]) {
        imageLabel.value = images[index].customLabel || images[index].nameWithoutExt;
        fileNameDisplay.textContent = images[index].name;
    }

    updateGhost(index);
}

function updateGhost(currentIndex) {
    const isGhost = ghostModeCheckbox.checked;
    const firstImg = document.getElementById('img-0');
    
    if (!firstImg) return;

    // Reset ghost class first
    firstImg.classList.remove('ghost');

    // If Ghost Mode is ON and we are NOT on the first image
    if (isGhost && currentIndex !== 0) {
        firstImg.classList.add('ghost');
    } else {
        // If we are not in ghost mode, or we are on the first image,
        // ensure the first image behaves normally (handled by updateView's active class logic)
        // But we need to make sure we didn't leave it in a weird state if it was previously ghosted
        if (currentIndex !== 0) {
             // It's already handled by updateView removing 'active'
        }
    }
}

function createGif() {
    if (images.length === 0) return;

    gifResult.classList.remove('hidden');
    gifResult.innerHTML = '<p>Generating GIF... <span id="gifProgress">0%</span></p><div class="progress-bar"><div id="progressFill" class="progress-fill"></div></div>';

    const sizeOption = document.getElementById('gifSize').value;

    // Determine dimensions from the first image
    const firstImg = new Image();
    firstImg.src = images[0].src;
    
    firstImg.onload = () => {
        let width = firstImg.width;
        let height = firstImg.height;

        if (sizeOption !== 'original') {
            const targetWidth = parseInt(sizeOption);
            if (width > targetWidth) { // Only scale down, don't scale up
                const scaleFactor = targetWidth / width;
                width = targetWidth;
                height = Math.round(height * scaleFactor);
            }
        }

        const gif = new GIF({
            workers: 2,
            quality: 10,
            width: width,
            height: height,
            workerScript: 'gif.worker.js'
        });

        gif.on('progress', (p) => {
            const percent = Math.round(p * 100);
            document.getElementById('gifProgress').textContent = `${percent}%`;
            document.getElementById('progressFill').style.width = `${percent}%`;
        });

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        processImagesForGif(gif, canvas, ctx, width, height);
    };
}

async function processImagesForGif(gif, canvas, ctx, width, height) {
    for (const imgData of images) {
        await new Promise((resolve) => {
            const img = new Image();
            img.src = imgData.src;
            img.onload = () => {
                // Clear canvas
                ctx.clearRect(0, 0, width, height);
                
                // Draw Image with Rotation and Flip
                ctx.save();
                ctx.translate(width / 2, height / 2);
                ctx.rotate((imgData.rotation || 0) * Math.PI / 180);
                if (imgData.flipped) {
                    ctx.scale(-1, 1);
                }
                
                if (Math.abs((imgData.rotation || 0) % 180) === 90) {
                    // If rotated 90 or 270, swap dimensions for drawing to fill the box
                    ctx.drawImage(img, -height / 2, -width / 2, height, width);
                } else {
                    ctx.drawImage(img, -width / 2, -height / 2, width, height);
                }
                ctx.restore();
                
                // Draw Label Background
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                // Calculate text width to size background
                ctx.font = 'bold 40px Arial'; // Larger font for high res images
                const text = imgData.customLabel || imgData.nameWithoutExt;
                const textMetrics = ctx.measureText(text);
                const padding = 20;
                const bgWidth = textMetrics.width + (padding * 2);
                const bgHeight = 60;
                
                ctx.fillRect(20, 20, bgWidth, bgHeight);
                
                // Draw Text
                ctx.fillStyle = 'white';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, 20 + padding, 20 + (bgHeight / 2));

                gif.addFrame(ctx, {copy: true, delay: 800}); // 800ms per frame
                resolve();
            };
        });
    }

    gif.on('finished', function(blob) {
        const url = URL.createObjectURL(blob);
        gifResult.innerHTML = '';
        
        const resultImg = document.createElement('img');
        resultImg.src = url;
        gifResult.appendChild(resultImg);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = 'fitness-progress.gif';
        downloadLink.textContent = 'Download GIF';
        downloadLink.className = 'btn';
        downloadLink.style.display = 'block';
        downloadLink.style.marginTop = '10px';
        gifResult.appendChild(downloadLink);
    });

    gif.render();
}

async function createComposite() {
    if (images.length === 0) return;

    compositeResult.classList.remove('hidden');
    compositeResult.innerHTML = '<p>Generating Composite... Please wait.</p>';

    // Load all images first to get dimensions
    const loadedImages = await Promise.all(images.map(imgData => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = imgData.src;
            img.onload = () => resolve({ img, data: imgData });
        });
    }));

    // Calculate dimensions based on the first image's height
    // If first image is rotated 90/270, its visual height is its width
    const firstItem = loadedImages[0];
    const firstRotation = firstItem.data.rotation || 0;
    const isFirstRotated = Math.abs(firstRotation % 180) === 90;
    const targetHeight = isFirstRotated ? firstItem.img.width : firstItem.img.height;
    
    let totalWidth = 0;
    let maxWidth = 0;

    loadedImages.forEach(item => {
        const rotation = item.data.rotation || 0;
        const isRotated = Math.abs(rotation % 180) === 90;
        
        // Visual dimensions of the source image
        const visualHeight = isRotated ? item.img.width : item.img.height;
        const visualWidth = isRotated ? item.img.height : item.img.width;
        
        const scaleFactor = targetHeight / visualHeight;
        
        item.finalWidth = visualWidth * scaleFactor;
        item.finalHeight = targetHeight;
        
        totalWidth += item.finalWidth;
        if (item.finalWidth > maxWidth) maxWidth = item.finalWidth;
    });

    // Get user-selected layout
    const selectedLayout = document.querySelector('input[name="compositeLayout"]:checked').value;
    const isVertical = selectedLayout === 'vertical' || totalWidth > 8192; // Fallback to vertical if too wide
    
    let canvasWidth, canvasHeight;
    if (isVertical) {
        canvasWidth = maxWidth;
        canvasHeight = targetHeight * loadedImages.length;
    } else {
        canvasWidth = totalWidth;
        canvasHeight = targetHeight;
    }

    // Title setup
    const titleText = compositeTitleInput.value.trim();
    const titleFontSize = Math.max(80, Math.floor(targetHeight / 15));
    const titlePadding = titleFontSize;
    const titleAreaHeight = titleText ? (titleFontSize + (titlePadding * 2)) : 0;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight + titleAreaHeight;
    const ctx = canvas.getContext('2d');

    // Fill background white
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Title if exists
    if (titleText) {
        ctx.fillStyle = 'black';
        ctx.font = `bold ${titleFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(titleText, canvasWidth / 2, titleAreaHeight / 2);
    }

    // Draw images
    let currentX = 0, currentY = titleAreaHeight;
    loadedImages.forEach(item => {
        const rotation = item.data.rotation || 0;
        const w = item.finalWidth;
        const h = item.finalHeight;
        const x = isVertical ? (canvasWidth - w) / 2 : currentX; // Center horizontally if vertical
        const y = currentY;
        
        ctx.save();
        ctx.translate(x + w/2, y + h/2);
        ctx.rotate(rotation * Math.PI / 180);
        if (item.data.flipped) {
            ctx.scale(-1, 1);
        }
        
        if (Math.abs(rotation % 180) === 90) {
             // Draw swapped
             ctx.drawImage(item.img, -h/2, -w/2, h, w);
        } else {
             ctx.drawImage(item.img, -w/2, -h/2, w, h);
        }
        ctx.restore();
        
        // Draw Label
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'left'; // Reset alignment
        
        const text = item.data.customLabel || item.data.nameWithoutExt;
        const textMetrics = ctx.measureText(text);
        const padding = 20;
        const bgWidth = textMetrics.width + (padding * 2);
        const bgHeight = 60;
        
        // Draw label at bottom center of this image segment
        const labelX = x + (w - bgWidth) / 2;
        const labelY = y + h - bgHeight - 20; 

        ctx.fillRect(labelX, labelY, bgWidth, bgHeight);
        
        ctx.fillStyle = 'white';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, labelX + padding, labelY + (bgHeight / 2));

        if (isVertical) {
            currentY += h;
        } else {
            currentX += w;
        }
    });

    // Output
    const url = canvas.toDataURL('image/jpeg', 0.9);
    compositeResult.innerHTML = '';
    
    const resultImg = document.createElement('img');
    resultImg.src = url;
    resultImg.style.maxWidth = '100%';
    compositeResult.appendChild(resultImg);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'fitness-progress-composite.jpg';
    downloadLink.textContent = 'Download Composite Image';
    downloadLink.className = 'btn';
    downloadLink.style.display = 'block';
    downloadLink.style.marginTop = '10px';
    compositeResult.appendChild(downloadLink);
}
