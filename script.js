const imageInput = document.getElementById('imageInput');
const dropzone = document.getElementById('dropzone');
const dropzoneTitle = document.getElementById('dropzoneTitle');
const dropzoneHint = document.getElementById('dropzoneHint');
const notice = document.getElementById('notice');
const viewer = document.getElementById('viewer');
const emptyState = document.getElementById('emptyState');
const emptyTitle = document.getElementById('emptyTitle');
const emptyHint = document.getElementById('emptyHint');
const viewerChip = document.getElementById('viewerChip');
const viewerIndex = document.getElementById('viewerIndex');
const viewerWhen = document.getElementById('viewerWhen');
const sliderContainer = document.getElementById('sliderContainer');
const progressSlider = document.getElementById('progressSlider');
const mainDisplay = document.getElementById('mainDisplay');
const thumbnailsContainer = document.getElementById('thumbnails');
const countChip = document.getElementById('countChip');
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
const clearAllBtn = document.getElementById('clearAllBtn');
const ghostOpacityControl = document.getElementById('ghostOpacityControl');
const ghostOpacitySlider = document.getElementById('ghostOpacity');
const ghostOpacityValue = document.getElementById('ghostOpacityValue');
const gifResult = document.getElementById('gifResult');
const compositeResult = document.getElementById('compositeResult');
const gifSize = document.getElementById('gifSize');
const compositeSize = document.getElementById('compositeSize');

const MAX_FILES = 6;
const MAX_BYTES = 20 * 1024 * 1024;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i;
const THEME_NAMES = { plain: 'Plain', signal: 'Signal', studio: 'Studio', diamond: 'Diamond', stamp: 'Stamp' };

let images = [];
let loadToken = 0;
let exportToken = 0;
let exportBusy = false;
let activeGif = null;
let noticeTimer = 0;
let drag = null;
let suppressClick = false;

function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function normRotation(deg) {
    return ((Math.round(deg || 0) % 360) + 360) % 360;
}

function sanitizeFilename(filename) {
    return String(filename)
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80) || 'fitlapse';
}

function isImageFile(file) {
    const type = (file.type || '').toLowerCase();
    if (type.startsWith('image/')) return true;
    if ((!type || type === 'application/octet-stream') && IMAGE_EXT.test(file.name || '')) return true;
    return false;
}

function showNotice(message, kind) {
    notice.textContent = message;
    notice.classList.remove('hidden', 'ok');
    if (kind === 'ok') notice.classList.add('ok');
    notice.setAttribute('role', kind === 'ok' ? 'status' : 'alert');
    clearTimeout(noticeTimer);
    if (kind === 'ok') {
        noticeTimer = setTimeout(() => notice.classList.add('hidden'), 4200);
    }
}

function clearNotice() {
    clearTimeout(noticeTimer);
    notice.classList.add('hidden');
    notice.textContent = '';
}

function selectedTheme() {
    const checked = document.querySelector('input[name="exportTheme"]:checked');
    return checked ? checked.value : 'plain';
}

function selectedLayout() {
    const checked = document.querySelector('input[name="compositeLayout"]:checked');
    return checked ? checked.value : 'horizontal';
}

function paintSliderFill(slider) {
    const max = Number(slider.max);
    const val = Number(slider.value);
    const pct = max <= 0 ? 0 : (val / max) * 100;
    slider.style.setProperty('--pct', pct + '%');
}

function setActionsDisabled(disabled) {
    createGifBtn.disabled = disabled;
    createCompositeBtn.disabled = disabled;
}

function releaseImages() {
    const old = images;
    images = [];
    mainDisplay.replaceChildren();
    old.forEach((img) => {
        if (img.src) URL.revokeObjectURL(img.src);
        if (img.decoded) img.decoded.removeAttribute('src');
    });
}

function showEmpty() {
    viewer.classList.remove('has-photos', 'is-loading');
    emptyState.hidden = false;
    emptyTitle.textContent = 'No photos yet';
    emptyHint.textContent = 'Your timeline shows up here. Oldest photo first.';
    viewerChip.classList.add('hidden');
    mainDisplay.replaceChildren();
}

function showLoading() {
    viewer.classList.remove('has-photos');
    viewer.classList.add('is-loading');
    emptyState.hidden = false;
    emptyTitle.textContent = 'Reading photos…';
    emptyHint.textContent = 'Keeping everything on this device.';
    viewerChip.classList.add('hidden');
}

function hideResult(container) {
    if (container.dataset.objectUrl) {
        URL.revokeObjectURL(container.dataset.objectUrl);
        delete container.dataset.objectUrl;
    }
    container.classList.add('hidden');
    container.replaceChildren();
}

function showProgress(container, label) {
    if (container.dataset.objectUrl) {
        URL.revokeObjectURL(container.dataset.objectUrl);
        delete container.dataset.objectUrl;
    }
    container.classList.remove('hidden');
    container.replaceChildren();
    const p = document.createElement('p');
    p.className = 'progress-label';
    p.append(document.createTextNode(label + ' '));
    const pct = document.createElement('span');
    pct.className = 'progress-pct';
    pct.textContent = '0%';
    p.appendChild(pct);
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    bar.appendChild(fill);
    container.append(p, bar);
    container.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
}

function setProgress(container, percent) {
    const pct = container.querySelector('.progress-pct');
    const fill = container.querySelector('.progress-fill');
    const value = Math.max(0, Math.min(100, percent));
    if (pct) pct.textContent = value + '%';
    if (fill) fill.style.width = value + '%';
}

function showDownload(container, blob, filename, kind, theme) {
    hideResult(container);
    container.classList.remove('hidden');
    const url = URL.createObjectURL(blob);
    container.dataset.objectUrl = url;

    const label = document.createElement('p');
    label.className = 'result-label';
    label.textContent = (THEME_NAMES[theme] || theme) + ' · ' + kind;

    const img = document.createElement('img');
    img.src = url;
    img.alt = kind + ' preview, ' + (THEME_NAMES[theme] || theme) + ' theme';

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.className = 'btn btn-download';
    link.textContent = kind === 'GIF' ? 'Download GIF' : 'Download composite';

    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = 'Ready on this device. Nothing was uploaded.';

    container.append(label, img, link, note);
    container.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
}

function exportFilename(theme, ext) {
    const title = compositeTitleInput.value.trim();
    const base = title ? sanitizeFilename(title) : 'fitlapse';
    return base + '-' + theme + '.' + ext;
}

function finishExport(token) {
    if (token !== exportToken) return;
    exportBusy = false;
    activeGif = null;
    setActionsDisabled(false);
}

function decodeImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            if (!img.naturalWidth || !img.naturalHeight) reject(new Error('empty'));
            else resolve(img);
        };
        img.onerror = () => reject(new Error('decode'));
        img.src = src;
    });
}

function readAscii(view, offset, length) {
    if (offset < 0 || offset + length > view.byteLength) return null;
    let text = '';
    const max = Math.min(length, 64);
    for (let i = 0; i < max; i++) {
        const code = view.getUint8(offset + i);
        if (code === 0) break;
        text += String.fromCharCode(code);
    }
    return text;
}

function parseExifDate(raw) {
    if (!raw) return null;
    const match = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
    return isNaN(date.getTime()) ? null : date;
}

function tiffDate(view, base) {
    if (base + 8 > view.byteLength) return null;
    const order = view.getUint16(base);
    const le = order === 0x4949;
    if (!le && order !== 0x4d4d) return null;
    const u16 = (offset) => (offset >= 0 && offset + 2 <= view.byteLength ? view.getUint16(offset, le) : 0);
    const u32 = (offset) => (offset >= 0 && offset + 4 <= view.byteLength ? view.getUint32(offset, le) : 0);
    if (u16(base + 2) !== 42) return null;

    function asciiTag(ifd, tagWanted) {
        if (ifd < base || ifd + 2 > view.byteLength) return null;
        const count = u16(ifd);
        if (count > 80 || ifd + 2 + count * 12 > view.byteLength) return null;
        for (let i = 0; i < count; i++) {
            const entry = ifd + 2 + i * 12;
            const tag = u16(entry);
            const type = u16(entry + 2);
            const num = u32(entry + 4);
            if (tag === tagWanted && type === 2 && num >= 10 && num < 64) {
                let valueOffset = entry + 8;
                if (num > 4) valueOffset = base + u32(entry + 8);
                return readAscii(view, valueOffset, num);
            }
        }
        return null;
    }

    function pointer(ifd, tagWanted) {
        if (ifd < base || ifd + 2 > view.byteLength) return null;
        const count = u16(ifd);
        if (count > 80 || ifd + 2 + count * 12 > view.byteLength) return null;
        for (let i = 0; i < count; i++) {
            const entry = ifd + 2 + i * 12;
            if (u16(entry) === tagWanted) return base + u32(entry + 8);
        }
        return null;
    }

    const ifd0 = base + u32(base + 4);
    const exifIfd = pointer(ifd0, 0x8769);
    const raw = (exifIfd && (asciiTag(exifIfd, 0x9003) || asciiTag(exifIfd, 0x9004))) || asciiTag(ifd0, 0x0132);
    return parseExifDate(raw);
}

function readExifDate(buffer) {
    const view = new DataView(buffer);
    if (view.byteLength < 12 || view.getUint16(0) !== 0xffd8) return null;
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
        if (view.getUint8(offset) !== 0xff) return null;
        let marker = view.getUint8(offset + 1);
        while (marker === 0xff && offset + 2 < view.byteLength) {
            offset += 1;
            marker = view.getUint8(offset + 1);
        }
        if (marker === 0xda || marker === 0xd9) return null;
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
            offset += 2;
            continue;
        }
        const size = view.getUint16(offset + 2);
        if (size < 2 || offset + 2 + size > view.byteLength) return null;
        if (marker === 0xe1) {
            const start = offset + 4;
            if (start + 14 <= view.byteLength && view.getUint32(start) === 0x45786966 && view.getUint16(start + 4) === 0) {
                return tiffDate(view, start + 6);
            }
        }
        offset += 2 + size;
    }
    return null;
}

async function fileCapturedAt(file) {
    const fallback = new Date(file.lastModified || Date.now());
    const type = (file.type || '').toLowerCase();
    const isJpeg = type === 'image/jpeg' || type === 'image/jpg' || /\.jpe?g$/i.test(file.name || '');
    if (!isJpeg) return fallback;
    try {
        const buffer = await file.slice(0, 512 * 1024).arrayBuffer();
        const exif = readExifDate(buffer);
        if (exif && !isNaN(exif.getTime())) return exif;
    } catch (error) {
        console.error(error);
    }
    return isNaN(fallback.getTime()) ? new Date() : fallback;
}

async function loadFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file && typeof file.size === 'number');
    if (!files.length) return;

    const tooBig = files.filter((file) => file.size > MAX_BYTES);
    const notImage = files.filter((file) => file.size <= MAX_BYTES && !isImageFile(file));
    if (tooBig.length || notImage.length) {
        const reasons = [];
        if (tooBig.length) reasons.push('each photo must be under 20MB');
        if (notImage.length) reasons.push('use JPEG, PNG, or WebP');
        showNotice("Couldn't add those files — " + reasons.join(', and ') + '.');
        return;
    }
    if (files.length > MAX_FILES) {
        showNotice('Choose up to 6 photos at a time.');
        return;
    }

    const token = ++loadToken;
    showLoading();
    clearNotice();

    const decoded = await Promise.all(files.map(async (file) => {
        const capturedAt = await fileCapturedAt(file);
        const src = URL.createObjectURL(file);
        try {
            const image = await decodeImage(src);
            return { ok: true, file: file, src: src, image: image, capturedAt: capturedAt };
        } catch (error) {
            URL.revokeObjectURL(src);
            return { ok: false, name: file.name || 'photo' };
        }
    }));

    if (token !== loadToken) {
        decoded.forEach((item) => {
            if (item.ok) URL.revokeObjectURL(item.src);
        });
        return;
    }

    const ready = decoded.filter((item) => item.ok);
    const failed = decoded.filter((item) => !item.ok);
    if (!ready.length) {
        showNotice("This browser couldn't read those photos. If they're HEIC, export a JPEG and try again.");
        if (images.length) initializeViewer(Number(progressSlider.value) || 0);
        else showEmpty();
        return;
    }

    ready.sort((a, b) => {
        const delta = a.capturedAt - b.capturedAt;
        if (delta) return delta;
        return a.file.name.localeCompare(b.file.name);
    });

    releaseImages();
    images = ready.map((item, index) => ({
        src: item.src,
        decoded: item.image,
        name: item.file.name,
        nameWithoutExt: item.file.name.replace(/\.[^/.]+$/, ''),
        capturedAt: item.capturedAt,
        sortIndex: index,
        rotation: 0,
        flipped: false
    }));

    hideResult(gifResult);
    hideResult(compositeResult);
    initializeViewer(0);

    if (failed.length) {
        showNotice('Skipped ' + failed.map((item) => item.name).join(', ') + " — this browser couldn't read them.");
    }
}

function paintThumb(canvas, imgData) {
    const size = canvas.width;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#07090f';
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    ctx.clip();
    FitThemes.drawImageFitted(ctx, imgData.decoded, imgData.rotation || 0, imgData.flipped, 0, 0, size, size, 'cover');
    ctx.restore();
}

function initializeViewer(activeIndex) {
    mainDisplay.replaceChildren();
    thumbnailsContainer.replaceChildren();
    viewer.classList.add('has-photos');
    viewer.classList.remove('is-loading');
    emptyState.hidden = true;

    images.forEach((imgData, idx) => {
        const img = imgData.decoded;
        img.id = 'img-' + idx;
        img.alt = imgData.name || ('Photo ' + (idx + 1));
        img.draggable = false;
        img.className = '';
        mainDisplay.appendChild(img);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'thumbnail';
        button.dataset.index = String(idx);
        button.setAttribute('role', 'option');
        const when = imgData.capturedAt ? FitThemes.formatShortDate(imgData.capturedAt) : '';
        button.setAttribute('aria-label', 'Photo ' + (idx + 1) + (when ? ', ' + when : '') + ', ' + (imgData.name || ''));
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 160;
        paintThumb(canvas, imgData);
        button.appendChild(canvas);
        thumbnailsContainer.appendChild(button);
    });

    sliderContainer.classList.remove('hidden');
    progressSlider.max = String(Math.max(0, images.length - 1));
    progressSlider.disabled = images.length < 2;
    countChip.textContent = images.length === 1 ? '1 photo' : images.length + ' photos';
    dropzoneTitle.textContent = 'Choose photos';
    dropzoneHint.textContent = 'Replaces the current set · up to 6';
    const index = Math.max(0, Math.min(activeIndex || 0, images.length - 1));
    updateView(index);
}

function scrollThumb(el) {
    const left = el.offsetLeft - thumbnailsContainer.clientWidth / 2 + el.offsetWidth / 2;
    thumbnailsContainer.scrollTo({ left: Math.max(0, left), behavior: reducedMotion() ? 'auto' : 'smooth' });
}

function updateView(index) {
    if (!images.length) return;
    index = Math.max(0, Math.min(images.length - 1, index));
    const boxW = mainDisplay.clientWidth || viewer.clientWidth;
    const boxH = mainDisplay.clientHeight || viewer.clientHeight;
    const ghostOn = ghostModeCheckbox.checked && index !== 0;
    mainDisplay.style.setProperty('--ghost-opacity', ghostOpacitySlider.value);

    images.forEach((imgData, idx) => {
        const el = imgData.decoded;
        const rotation = normRotation(imgData.rotation || 0);
        const quarter = rotation % 180 === 90;
        el.classList.toggle('active', idx === index);
        el.classList.toggle('ghost', ghostOn && idx === 0);
        el.style.maxWidth = (quarter ? boxH : boxW) + 'px';
        el.style.maxHeight = (quarter ? boxW : boxH) + 'px';
        el.style.setProperty('--rot', rotation + 'deg');
        el.style.setProperty('--sx', imgData.flipped ? '-1' : '1');
    });

    thumbnailsContainer.querySelectorAll('.thumbnail').forEach((thumb, idx) => {
        const on = idx === index;
        thumb.classList.toggle('active', on);
        thumb.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on) scrollThumb(thumb);
    });

    const current = images[index];
    const caption = typeof current.customLabel === 'string' ? current.customLabel : (current.nameWithoutExt || '');
    if (document.activeElement !== imageLabel) imageLabel.value = caption;
    const when = current.capturedAt ? FitThemes.formatShortDate(current.capturedAt) : '';
    fileNameDisplay.textContent = when ? current.name + ' · ' + when : current.name;
    viewerIndex.textContent = (index + 1) + ' / ' + images.length;
    viewerWhen.textContent = when;
    viewerChip.classList.remove('hidden');
    progressSlider.value = String(index);
    progressSlider.setAttribute('aria-valuemin', '0');
    progressSlider.setAttribute('aria-valuemax', String(images.length - 1));
    progressSlider.setAttribute('aria-valuenow', String(index));
    progressSlider.setAttribute('aria-valuetext', 'Photo ' + (index + 1) + ' of ' + images.length + (when ? ', ' + when : ''));
    paintSliderFill(progressSlider);
}

function reorderImages(from, to) {
    const [item] = images.splice(from, 1);
    images.splice(to, 0, item);
    images.forEach((img, idx) => { img.sortIndex = idx; });
    initializeViewer(to);
}

function clearDragStyles() {
    thumbnailsContainer.querySelectorAll('.thumbnail').forEach((el) => {
        el.classList.remove('dragging', 'drop-target');
    });
}

function thumbIndexAt(x, y) {
    const thumbs = Array.from(thumbnailsContainer.querySelectorAll('.thumbnail'));
    let best = null;
    let bestDist = Infinity;
    thumbs.forEach((thumb, idx) => {
        const rect = thumb.getBoundingClientRect();
        if (y < rect.top - 28 || y > rect.bottom + 28) return;
        const dist = Math.abs(x - (rect.left + rect.width / 2));
        if (dist < bestDist) {
            bestDist = dist;
            best = idx;
        }
    });
    return best;
}

function onThumbPointerDown(event) {
    const thumb = event.target.closest('.thumbnail');
    if (!thumb || event.button > 0) return;
    drag = {
        pointerId: event.pointerId,
        index: Number(thumb.dataset.index),
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
        active: event.pointerType === 'mouse',
        timer: null,
        el: thumb
    };
    if (event.pointerType !== 'mouse') {
        drag.timer = setTimeout(() => {
            if (!drag || drag.moved) return;
            drag.active = true;
            thumb.classList.add('dragging');
        }, 260);
    }
    thumb.setPointerCapture(event.pointerId);
}

function onThumbPointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (!drag.moved && Math.hypot(dx, dy) > 8) {
        drag.moved = true;
        if (drag.active) drag.el.classList.add('dragging');
        else clearTimeout(drag.timer);
    }
    if (!drag.active || !drag.moved) return;
    event.preventDefault();
    const target = thumbIndexAt(event.clientX, event.clientY);
    thumbnailsContainer.querySelectorAll('.thumbnail').forEach((el, idx) => {
        el.classList.toggle('drop-target', target !== null && idx === target && idx !== drag.index);
    });
}

function finishDrag(x, y) {
    if (!drag) return;
    const from = drag.index;
    const moved = drag.active && drag.moved;
    clearTimeout(drag.timer);
    const target = moved ? thumbIndexAt(x, y) : null;
    clearDragStyles();
    drag = null;
    if (target !== null && target !== from) {
        suppressClick = true;
        reorderImages(from, target);
        setTimeout(() => { suppressClick = false; }, 50);
    }
}

function onThumbPointerUp(event) {
    if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    const x = event.clientX || drag.lastX;
    const y = event.clientY || drag.lastY;
    finishDrag(x, y);
}

function onThumbTouchEnd(event) {
    if (!drag) return;
    const touch = event.changedTouches && event.changedTouches[0];
    const x = (touch && touch.clientX) || drag.lastX;
    const y = (touch && touch.clientY) || drag.lastY;
    if (x == null || y == null) return;
    finishDrag(x, y);
}

function onThumbClick(event) {
    const thumb = event.target.closest('.thumbnail');
    if (!thumb || suppressClick) return;
    updateView(Number(thumb.dataset.index));
}

function rotateImage(deg) {
    const index = Number(progressSlider.value);
    if (!images[index]) return;
    images[index].rotation = normRotation((images[index].rotation || 0) + deg);
    const canvas = thumbnailsContainer.querySelectorAll('.thumbnail canvas')[index];
    if (canvas) paintThumb(canvas, images[index]);
    updateView(index);
}

function flipImage() {
    const index = Number(progressSlider.value);
    if (!images[index]) return;
    images[index].flipped = !images[index].flipped;
    const canvas = thumbnailsContainer.querySelectorAll('.thumbnail canvas')[index];
    if (canvas) paintThumb(canvas, images[index]);
    updateView(index);
}

function resetAllTransforms() {
    images.forEach((img) => {
        img.rotation = 0;
        img.flipped = false;
    });
    thumbnailsContainer.querySelectorAll('.thumbnail canvas').forEach((canvas, idx) => {
        paintThumb(canvas, images[idx]);
    });
    updateView(Number(progressSlider.value) || 0);
}

function clearAll() {
    if (!images.length && sliderContainer.classList.contains('hidden')) return;
    if (!confirm('Clear all photos and start over?')) return;
    exportToken += 1;
    if (activeGif) {
        try { activeGif.abort(); } catch (error) { /* already finished */ }
        activeGif = null;
    }
    exportBusy = false;
    setActionsDisabled(false);
    releaseImages();
    showEmpty();
    thumbnailsContainer.replaceChildren();
    sliderContainer.classList.add('hidden');
    hideResult(gifResult);
    hideResult(compositeResult);
    imageInput.value = '';
    compositeTitleInput.value = '';
    imageLabel.value = '';
    fileNameDisplay.textContent = '';
    progressSlider.value = '0';
    ghostModeCheckbox.checked = false;
    ghostOpacityControl.classList.add('hidden');
    dropzoneHint.textContent = 'or drop them here · up to 6 · JPEG, PNG, WebP';
    clearNotice();
}

function themeItems() {
    return images.map((img) => ({
        img: img.decoded,
        data: {
            rotation: img.rotation || 0,
            flipped: !!img.flipped,
            customLabel: img.customLabel,
            nameWithoutExt: img.nameWithoutExt,
            capturedAt: img.capturedAt,
            name: img.name
        }
    }));
}

async function createGif() {
    if (exportBusy || !images.length) return;
    const token = ++exportToken;
    exportBusy = true;
    setActionsDisabled(true);
    const theme = selectedTheme();
    showProgress(gifResult, 'Rendering GIF');

    try {
        await FitThemes.ensureFonts();
        if (token !== exportToken) return finishExport(token);

        const visual = FitThemes.getVisualSize(images[0].decoded, images[0].rotation);
        let photoW = visual.width;
        let photoH = visual.height;
        if (!photoW || !photoH) throw new Error('size');
        if (gifSize.value !== 'original') {
            const target = parseInt(gifSize.value, 10);
            if (photoW > target) {
                const scale = target / photoW;
                photoW = target;
                photoH = Math.max(2, Math.round(photoH * scale));
            }
        }
        photoW = Math.max(2, Math.round(photoW));
        photoH = Math.max(2, Math.round(photoH));
        const layout = FitThemes.gifLayout(photoW, photoH, theme);
        if (layout.width > 4096 || layout.height > 4096) {
            hideResult(gifResult);
            showNotice('That GIF is too large. Choose a smaller GIF size.');
            return finishExport(token);
        }

        const gif = new GIF({
            workers: 2,
            quality: 10,
            width: layout.width,
            height: layout.height,
            workerScript: 'gif.worker.js',
            background: FitThemes.background(theme)
        });
        activeGif = gif;
        const canvas = document.createElement('canvas');
        canvas.width = layout.width;
        canvas.height = layout.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        gif.on('progress', (p) => {
            if (token !== exportToken) return;
            setProgress(gifResult, Math.round(p * 100));
        });
        gif.on('finished', (blob) => {
            if (token !== exportToken) return;
            showDownload(gifResult, blob, exportFilename(theme, 'gif'), 'GIF', theme);
            finishExport(token);
        });

        images.forEach((imgData, index) => {
            FitThemes.paintGifFrame(ctx, imgData.decoded, themeItems()[index].data, index, themeItems().map((item) => item.data), theme, photoW, photoH);
            gif.addFrame(ctx, { copy: true, delay: 800 });
        });
        gif.render();
    } catch (error) {
        console.error(error);
        hideResult(gifResult);
        showNotice('The GIF could not be created. Try a smaller size.');
        finishExport(token);
    }
}

async function createComposite() {
    if (exportBusy || !images.length) return;
    const token = ++exportToken;
    exportBusy = true;
    setActionsDisabled(true);
    const theme = selectedTheme();
    showProgress(compositeResult, 'Rendering composite');

    try {
        await FitThemes.ensureFonts();
        if (token !== exportToken) return finishExport(token);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        setProgress(compositeResult, 35);
        const result = FitThemes.renderComposite(themeItems(), theme, {
            layout: selectedLayout(),
            scale: parseFloat(compositeSize.value),
            title: compositeTitleInput.value.trim()
        });
        if (!result || result.error) {
            hideResult(compositeResult);
            showNotice('That composite is too large for the browser. Pick a smaller composite size and try again.');
            return finishExport(token);
        }
        setProgress(compositeResult, 75);
        const blob = await new Promise((resolve, reject) => {
            result.canvas.toBlob((value) => {
                if (value) resolve(value);
                else reject(new Error('blob'));
            }, 'image/jpeg', 0.93);
        });
        if (token !== exportToken) return finishExport(token);
        showDownload(compositeResult, blob, exportFilename(theme, 'jpg'), 'Composite', theme);
        finishExport(token);
    } catch (error) {
        console.error(error);
        hideResult(compositeResult);
        showNotice('The composite could not be created. Try a smaller size.');
        finishExport(token);
    }
}

imageInput.addEventListener('change', () => {
    const files = Array.from(imageInput.files || []);
    imageInput.value = '';
    if (files.length) loadFiles(files);
});

emptyState.addEventListener('click', () => imageInput.click());

['dragenter', 'dragover'].forEach((type) => {
    document.addEventListener(type, (event) => {
        event.preventDefault();
        dropzone.classList.add('is-dragover');
    });
});
document.addEventListener('dragleave', (event) => {
    if (!event.relatedTarget) dropzone.classList.remove('is-dragover');
});
document.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragover');
    const files = event.dataTransfer && event.dataTransfer.files;
    if (files && files.length) loadFiles(files);
});

progressSlider.addEventListener('input', () => updateView(Number(progressSlider.value)));
ghostModeCheckbox.addEventListener('change', () => {
    ghostOpacityControl.classList.toggle('hidden', !ghostModeCheckbox.checked);
    updateView(Number(progressSlider.value) || 0);
});
ghostOpacitySlider.addEventListener('input', () => {
    const value = parseFloat(ghostOpacitySlider.value);
    ghostOpacityValue.textContent = Math.round(value * 100) + '%';
    mainDisplay.style.setProperty('--ghost-opacity', String(value));
    paintSliderFill(ghostOpacitySlider);
});
imageLabel.addEventListener('input', () => {
    const index = Number(progressSlider.value);
    if (images[index]) images[index].customLabel = imageLabel.value;
});

createGifBtn.addEventListener('click', createGif);
createCompositeBtn.addEventListener('click', createComposite);
rotateLeftBtn.addEventListener('click', () => rotateImage(-90));
rotateRightBtn.addEventListener('click', () => rotateImage(90));
flipBtn.addEventListener('click', flipImage);
resetAllBtn.addEventListener('click', resetAllTransforms);
clearAllBtn.addEventListener('click', clearAll);

thumbnailsContainer.addEventListener('pointerdown', onThumbPointerDown);
thumbnailsContainer.addEventListener('pointermove', onThumbPointerMove);
thumbnailsContainer.addEventListener('pointerup', onThumbPointerUp);
thumbnailsContainer.addEventListener('pointercancel', onThumbPointerUp);
document.addEventListener('touchend', onThumbTouchEnd, true);
thumbnailsContainer.addEventListener('click', onThumbClick);
thumbnailsContainer.addEventListener('contextmenu', (event) => {
    if (event.target.closest('.thumbnail')) event.preventDefault();
});

document.addEventListener('keydown', (event) => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') return;
    if (!images.length) return;
    const index = Number(progressSlider.value) || 0;
    switch (event.key) {
        case 'ArrowLeft':
            event.preventDefault();
            if (index > 0) updateView(index - 1);
            break;
        case 'ArrowRight':
            event.preventDefault();
            if (index < images.length - 1) updateView(index + 1);
            break;
        case 'r':
        case 'R':
            event.preventDefault();
            rotateImage(90);
            break;
        case 'l':
        case 'L':
            event.preventDefault();
            rotateImage(-90);
            break;
        case 'f':
        case 'F':
            event.preventDefault();
            flipImage();
            break;
        case 'g':
        case 'G':
            event.preventDefault();
            if (!createGifBtn.disabled) createGif();
            break;
        case 'c':
        case 'C':
            event.preventDefault();
            if (!createCompositeBtn.disabled) createComposite();
            break;
        default:
            break;
    }
});

if (window.ResizeObserver) {
    const observer = new ResizeObserver(() => {
        if (!images.length) return;
        updateView(Number(progressSlider.value) || 0);
    });
    observer.observe(viewer);
}

paintSliderFill(progressSlider);
paintSliderFill(ghostOpacitySlider);
FitThemes.ensureFonts();
