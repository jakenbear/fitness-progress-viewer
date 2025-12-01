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
const gifResult = document.getElementById('gifResult');
const compositeResult = document.getElementById('compositeResult');

let images = [];

imageInput.addEventListener('change', handleFiles);
progressSlider.addEventListener('input', handleSlider);
ghostModeCheckbox.addEventListener('change', () => updateView(parseInt(progressSlider.value)));
createGifBtn.addEventListener('click', createGif);
createCompositeBtn.addEventListener('click', createComposite);

imageLabel.addEventListener('input', (e) => {
    const index = parseInt(progressSlider.value);
    if (images[index]) {
        images[index].customLabel = e.target.value;
    }
});

function handleFiles(e) {
    const files = Array.from(e.target.files);
    
    if (files.length === 0) return;

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

    files.forEach((file, index) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const dateObj = new Date(file.lastModified);
            const monthYear = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            
            const imgObj = {
                src: event.target.result,
                name: file.name,
                nameWithoutExt: nameWithoutExt,
                date: dateObj.toLocaleDateString(),
                monthYear: monthYear,
                sortIndex: index
            };
            
            images.push(imgObj);

            loadedCount++;
            if (loadedCount === files.length) {
                images.sort((a, b) => a.sortIndex - b.sortIndex);
                initializeViewer();
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

function updateView(index) {
    const allImages = mainDisplay.querySelectorAll('img');
    allImages.forEach(img => img.classList.remove('active'));
    const activeImg = document.getElementById(`img-${index}`);
    if (activeImg) activeImg.classList.add('active');

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
    gifResult.innerHTML = '<p>Generating GIF... Please wait.</p>';

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
                
                // Draw Image
                ctx.drawImage(img, 0, 0, width, height);
                
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
    const targetHeight = loadedImages[0].img.height;
    let totalWidth = 0;

    loadedImages.forEach(item => {
        const scaleFactor = targetHeight / item.img.height;
        item.width = item.img.width * scaleFactor;
        item.height = targetHeight;
        totalWidth += item.width;
    });

    // Title setup
    const titleText = compositeTitleInput.value.trim();
    const titleFontSize = Math.max(80, Math.floor(targetHeight / 15));
    const titlePadding = titleFontSize;
    const titleAreaHeight = titleText ? (titleFontSize + (titlePadding * 2)) : 0;

    const canvas = document.createElement('canvas');
    canvas.width = totalWidth;
    canvas.height = targetHeight + titleAreaHeight;
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
        ctx.fillText(titleText, totalWidth / 2, titleAreaHeight / 2);
    }

    // Draw images
    let currentX = 0;
    loadedImages.forEach(item => {
        ctx.drawImage(item.img, currentX, titleAreaHeight, item.width, item.height);
        
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
        const labelX = currentX + (item.width - bgWidth) / 2;
        const labelY = titleAreaHeight + item.height - bgHeight - 20; 

        ctx.fillRect(labelX, labelY, bgWidth, bgHeight);
        
        ctx.fillStyle = 'white';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, labelX + padding, labelY + (bgHeight / 2));

        currentX += item.width;
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
