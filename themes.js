/* Themed GIF and composite rendering. Visual language matches the DDPY Spinner. */
(function () {
    const LEVELS = ['#3ddc6a', '#3aa0ff', '#ffd15a', '#ff8a2a', '#ff3b4e'];

    const SPEC = {
        signal: { pad: 0.05, caption: 0, topBar: false, sideBar: false },
        studio: { pad: 0.055, caption: 0.22, topBar: false, sideBar: false },
        diamond: { pad: 0.05, caption: 0, topBar: true, sideBar: true },
        stamp: { pad: 0.072, caption: 0.1, topBar: false, sideBar: false }
    };

    function clamp(n, min, max) {
        return Math.max(min, Math.min(max, n));
    }

    function even(n) {
        n = Math.max(2, Math.round(n));
        return n % 2 === 0 ? n : n + 1;
    }

    function normRotation(deg) {
        return ((Math.round(deg || 0) % 360) + 360) % 360;
    }

    function isQuarterTurn(rotation) {
        return normRotation(rotation) % 180 === 90;
    }

    function getVisualSize(img, rotation) {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (isQuarterTurn(rotation)) return { width: h, height: w };
        return { width: w, height: h };
    }

    function drawImageFitted(ctx, img, rotation, flipped, dx, dy, destW, destH, mode) {
        const rot = normRotation(rotation);
        const visual = getVisualSize(img, rot);
        const scale = mode === 'cover'
            ? Math.max(destW / visual.width, destH / visual.height)
            : Math.min(destW / visual.width, destH / visual.height);
        const drawW = visual.width * scale;
        const drawH = visual.height * scale;

        ctx.save();
        ctx.translate(dx + destW / 2, dy + destH / 2);
        ctx.rotate(rot * Math.PI / 180);
        if (flipped) ctx.scale(-1, 1);
        if (isQuarterTurn(rot)) {
            ctx.drawImage(img, -drawH / 2, -drawW / 2, drawH, drawW);
        } else {
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        }
        ctx.restore();
    }

    function roundRect(ctx, x, y, w, h, r) {
        const radius = Math.max(0, Math.min(r || 0, w / 2, h / 2));
        ctx.beginPath();
        if (radius === 0) {
            ctx.rect(x, y, w, h);
        } else {
            ctx.moveTo(x + radius, y);
            ctx.arcTo(x + w, y, x + w, y + h, radius);
            ctx.arcTo(x + w, y + h, x, y + h, radius);
            ctx.arcTo(x, y + h, x, y, radius);
            ctx.arcTo(x, y, x + w, y, radius);
            ctx.closePath();
        }
    }

    function fontString(weight, size, family) {
        return `${weight} ${Math.round(size)}px "${family}", sans-serif`;
    }

    function setType(ctx, weight, size, family, spacingEm) {
        ctx.font = fontString(weight, size, family);
        if ('letterSpacing' in ctx) {
            ctx.letterSpacing = spacingEm ? `${spacingEm}em` : '0px';
        }
    }

    function ellipsize(ctx, text, maxWidth) {
        if (ctx.measureText(text).width <= maxWidth) return text;
        const ell = '…';
        let lo = 0;
        let hi = text.length;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            if (ctx.measureText(text.slice(0, mid) + ell).width <= maxWidth) lo = mid;
            else hi = mid - 1;
        }
        return lo < 1 ? ell : text.slice(0, lo) + ell;
    }

    function layoutText(ctx, text, maxWidth, opts) {
        const content = text || '';
        const min = opts.min || 8;
        let size = opts.size;
        if (!content) return { text: '', size };
        while (size > min) {
            setType(ctx, opts.weight, size, opts.family, opts.spacing);
            if (ctx.measureText(content).width <= maxWidth) return { text: content, size };
            size -= Math.max(1, size * 0.06);
        }
        setType(ctx, opts.weight, min, opts.family, opts.spacing);
        return { text: ellipsize(ctx, content, maxWidth), size: min };
    }

    function background(theme) {
        if (theme === 'studio') return '#e9eef3';
        if (theme === 'stamp') return '#14110e';
        return '#07090f';
    }

    function levelColor(index) {
        return LEVELS[Math.min(Math.max(index, 0), LEVELS.length - 1)];
    }

    function startOfDay(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    }

    function formatMonthYear(date) {
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    function formatShortDate(date) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatStamp(date) {
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const yy = String(date.getFullYear()).slice(2);
        return `${mm} ${dd} '${yy}`;
    }

    function captionFor(data) {
        if (data && typeof data.customLabel === 'string') return data.customLabel.trim();
        return ((data && data.nameWithoutExt) || '').trim();
    }

    function dayOffset(dates, index) {
        if (!dates || !dates[index] || !dates[0]) return null;
        const offsets = dates.map((d) => (d ? Math.round((startOfDay(d) - startOfDay(dates[0])) / 86400000) : 0));
        if (offsets.every((d) => d === 0)) return null;
        return offsets[index];
    }

    function dayText(offset) {
        if (offset === null || offset === undefined) return '';
        return offset <= 0 ? 'Start' : `Day ${offset}`;
    }

    function metaLine(date, offset) {
        const parts = [];
        if (date && !isNaN(date.getTime())) parts.push(formatShortDate(date));
        const day = dayText(offset);
        if (day) parts.push(day);
        return parts.join('   ·   ');
    }

    function buildStats(items) {
        const n = items.length;
        const noun = n === 1 ? '1 photo' : `${n} photos`;
        const dates = items.map((item) => item.data.capturedAt).filter((d) => d && !isNaN(d.getTime()));
        if (!dates.length) return noun;
        const first = new Date(Math.min.apply(null, dates.map((d) => d.getTime())));
        const last = new Date(Math.max.apply(null, dates.map((d) => d.getTime())));
        const days = Math.round((startOfDay(last) - startOfDay(first)) / 86400000);
        const range = formatMonthYear(first) === formatMonthYear(last)
            ? formatMonthYear(first)
            : `${formatMonthYear(first)} – ${formatMonthYear(last)}`;
        return days > 0 ? `${noun}   ·   ${range}   ·   ${days} days` : `${noun}   ·   ${range}`;
    }

    function metricsFor(photoW, photoH, theme, padBasis) {
        const spec = SPEC[theme] || SPEC.signal;
        const basis = padBasis || Math.min(photoW, photoH);
        const pad = Math.max(2, Math.round(basis * spec.pad));
        const caption = spec.caption ? Math.max(1, Math.round(photoH * spec.caption)) : 0;
        const bar = spec.topBar ? Math.max(3, Math.round(basis * 0.012)) : 0;
        const side = spec.sideBar ? Math.max(5, Math.round(basis * 0.02)) : 0;
        return {
            pad: pad,
            caption: caption,
            bar: bar,
            side: side,
            photoW: photoW,
            photoH: photoH,
            outerW: side + pad * 2 + photoW,
            outerH: bar + pad * 2 + photoH + caption,
            photoX: side + pad,
            photoY: bar + pad
        };
    }

    function radiusFor(theme, photoW, photoH) {
        const m = Math.min(photoW, photoH);
        if (theme === 'stamp') return 0;
        if (theme === 'studio') return Math.min(18, m * 0.025);
        if (theme === 'diamond') return m * 0.04;
        return m * 0.05;
    }

    function drawDiamond(ctx, cx, cy, size, fill) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = fill;
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.restore();
    }

    function strokeRound(ctx, x, y, w, h, r, color, width) {
        ctx.save();
        roundRect(ctx, x, y, w, h, r);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
        ctx.restore();
    }

    function drawPhoto(ctx, img, data, x, y, w, h, radius, mat) {
        ctx.save();
        roundRect(ctx, x, y, w, h, radius);
        ctx.clip();
        ctx.fillStyle = mat;
        ctx.fillRect(x, y, w, h);
        drawImageFitted(ctx, img, data.rotation || 0, !!data.flipped, x, y, w, h, 'contain');
        ctx.restore();
    }

    function drawPill(ctx, right, top, text, size, fill, color, stroke) {
        setType(ctx, 600, size, 'Outfit', 0.04);
        const tw = ctx.measureText(text).width;
        const padX = size * 0.72;
        const h = Math.round(size * 1.85);
        const w = Math.round(tw + padX * 2);
        const x = Math.round(right - w);
        const y = Math.round(top);
        roundRect(ctx, x, y, w, h, h / 2);
        ctx.fillStyle = fill;
        ctx.fill();
        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = Math.max(1, size * 0.06);
            ctx.stroke();
        }
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w / 2, y + h / 2 + size * 0.04);
        return w;
    }

    function drawOverlayCopy(ctx, px, py, photoW, photoH, lines, reserveRight) {
        const inset = Math.round(Math.min(photoW, photoH) * 0.05);
        const visible = lines.filter((line) => line.text);
        if (!visible.length) return;
        const gap = visible[0].size * 0.28;
        const blockH = visible.reduce((sum, line, i) => sum + line.size + (i ? gap : 0), 0);
        let cursor = py + photoH - inset - blockH;
        visible.forEach((line) => {
            const maxW = Math.max(20, photoW - inset * 2 - (reserveRight || 0) - (line.indent || 0));
            const laid = layoutText(ctx, line.text, maxW, line);
            const cy = cursor + laid.size / 2;
            ctx.fillStyle = line.color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const textX = px + inset + (line.indent || 0);
            ctx.fillText(laid.text, textX, cy);
            line._cy = cy;
            line._size = laid.size;
            cursor += laid.size + gap;
        });
    }

    function drawSignal(ctx, x, y, m, img, data, meta) {
        const px = x + m.photoX;
        const py = y + m.photoY;
        const radius = radiusFor('signal', m.photoW, m.photoH);
        ctx.fillStyle = '#07090f';
        ctx.fillRect(x, y, m.outerW, m.outerH);
        drawPhoto(ctx, img, data, px, py, m.photoW, m.photoH, radius, '#05070c');

        ctx.save();
        roundRect(ctx, px, py, m.photoW, m.photoH, radius);
        ctx.clip();
        const scrim = ctx.createLinearGradient(0, py + m.photoH * 0.55, 0, py + m.photoH);
        scrim.addColorStop(0, 'rgba(7, 9, 15, 0)');
        scrim.addColorStop(1, 'rgba(7, 9, 15, 0.88)');
        ctx.fillStyle = scrim;
        ctx.fillRect(px, py + m.photoH * 0.48, m.photoW, m.photoH * 0.52);
        ctx.restore();

        const stroke = Math.max(2, Math.round(Math.min(m.photoW, m.photoH) * 0.007));
        strokeRound(ctx, px, py, m.photoW, m.photoH, radius, 'rgba(142, 200, 255, 0.9)', stroke);

        const inset = Math.round(Math.min(m.photoW, m.photoH) * 0.045);
        const pillSize = clamp(m.photoH * 0.042, 11, 32);
        const progress = `${String(meta.index + 1).padStart(2, '0')}  /  ${String(meta.total).padStart(2, '0')}`;
        const pillW = drawPill(
            ctx,
            px + m.photoW - inset,
            py + inset,
            progress,
            pillSize,
            'rgba(7, 9, 15, 0.62)',
            '#8ec8ff',
            'rgba(142, 200, 255, 0.45)'
        );

        const labelSize = clamp(m.photoH * 0.07, 13, 64);
        const metaSize = clamp(m.photoH * 0.038, 11, 32);
        drawOverlayCopy(ctx, px, py, m.photoW, m.photoH, [
            {
                text: captionFor(data).toUpperCase(),
                size: labelSize,
                min: 11,
                weight: 500,
                family: 'Oswald',
                spacing: 0.04,
                color: '#f4f7fb'
            },
            {
                text: metaLine(data.capturedAt, meta.dayOffset),
                size: metaSize,
                min: 10,
                weight: 600,
                family: 'Outfit',
                spacing: 0.01,
                color: '#c5d4e4'
            }
        ], pillW * 0.15);
    }

    function drawStudio(ctx, x, y, m, img, data, meta) {
        const px = x + m.photoX;
        const py = y + m.photoY;
        const radius = radiusFor('studio', m.photoW, m.photoH);
        ctx.fillStyle = '#e9eef3';
        ctx.fillRect(x, y, m.outerW, m.outerH);
        drawPhoto(ctx, img, data, px, py, m.photoW, m.photoH, radius, '#d5dde6');
        strokeRound(ctx, px, py, m.photoW, m.photoH, radius, 'rgba(16, 21, 31, 0.16)', Math.max(1, Math.round(m.pad * 0.06)));

        const bandTop = py + m.photoH;
        const bandH = m.caption;
        const labelSize = clamp(bandH * 0.32, 8, 46);
        const metaSize = clamp(bandH * 0.2, 8, 26);
        const progress = `${meta.index + 1} of ${meta.total}`;
        const caption = captionFor(data);
        const left = px;
        const right = px + m.photoW;

        setType(ctx, 700, labelSize, 'Outfit', -0.01);
        const progressW = ctx.measureText(progress).width;
        const captionMax = m.photoW - progressW - labelSize;
        const laid = layoutText(ctx, caption || formatShortDate(data.capturedAt), Math.max(20, captionMax), {
            weight: 650,
            size: labelSize,
            min: 8,
            family: 'Outfit',
            spacing: -0.015
        });
        ctx.fillStyle = '#10151f';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(laid.text, left, bandTop + bandH * 0.36);

        setType(ctx, 700, labelSize * 0.72, 'Outfit', 0.02);
        ctx.fillStyle = '#3aa0ff';
        ctx.textAlign = 'right';
        ctx.fillText(progress, right, bandTop + bandH * 0.36);

        const sub = caption
            ? metaLine(data.capturedAt, meta.dayOffset)
            : dayText(meta.dayOffset);
        if (sub) {
            const subLaid = layoutText(ctx, sub, m.photoW, {
                weight: 500,
                size: metaSize,
                min: 8,
                family: 'Outfit',
                spacing: 0.01
            });
            ctx.fillStyle = '#5c6b80';
            ctx.textAlign = 'left';
            ctx.fillText(subLaid.text, left, bandTop + bandH * 0.72);
        }
    }

    function drawDiamondTheme(ctx, x, y, m, img, data, meta) {
        const px = x + m.photoX;
        const py = y + m.photoY;
        const radius = radiusFor('diamond', m.photoW, m.photoH);
        const accent = levelColor(meta.index);
        ctx.fillStyle = '#07090f';
        ctx.fillRect(x, y, m.outerW, m.outerH);
        ctx.fillStyle = accent;
        ctx.fillRect(x, y, m.side, m.outerH);
        ctx.fillStyle = '#ffd15a';
        ctx.fillRect(x, y, m.outerW, m.bar);

        drawPhoto(ctx, img, data, px, py, m.photoW, m.photoH, radius, '#05070c');
        ctx.save();
        roundRect(ctx, px, py, m.photoW, m.photoH, radius);
        ctx.clip();
        const scrim = ctx.createLinearGradient(0, py + m.photoH * 0.58, 0, py + m.photoH);
        scrim.addColorStop(0, 'rgba(7, 9, 15, 0)');
        scrim.addColorStop(1, 'rgba(7, 9, 15, 0.9)');
        ctx.fillStyle = scrim;
        ctx.fillRect(px, py + m.photoH * 0.5, m.photoW, m.photoH * 0.5);
        const topScrim = ctx.createLinearGradient(0, py, 0, py + m.photoH * 0.22);
        topScrim.addColorStop(0, 'rgba(7, 9, 15, 0.55)');
        topScrim.addColorStop(1, 'rgba(7, 9, 15, 0)');
        ctx.fillStyle = topScrim;
        ctx.fillRect(px, py, m.photoW, m.photoH * 0.24);
        ctx.restore();

        strokeRound(ctx, px, py, m.photoW, m.photoH, radius, 'rgba(255, 209, 90, 0.8)', Math.max(2, Math.round(Math.min(m.photoW, m.photoH) * 0.006)));

        const inset = Math.round(Math.min(m.photoW, m.photoH) * 0.048);
        const wordSize = clamp(m.photoH * 0.034, 10, 26);
        const word = layoutText(ctx, 'DDP YOGA', m.photoW * 0.6, {
            weight: 600,
            size: wordSize,
            min: 9,
            family: 'Oswald',
            spacing: 0.22
        });
        ctx.fillStyle = '#ffd15a';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(word.text, px + inset, py + inset + word.size * 0.7);

        const pillSize = clamp(m.photoH * 0.04, 11, 30);
        drawPill(
            ctx,
            px + m.photoW - inset,
            py + inset,
            `${meta.index + 1} / ${meta.total}`,
            pillSize,
            'rgba(7, 9, 15, 0.6)',
            accent,
            accent
        );

        const labelSize = clamp(m.photoH * 0.064, 13, 58);
        const mark = labelSize * 0.46;
        const caption = captionFor(data).toUpperCase();
        const lines = [];
        if (caption) {
            lines.push({
                text: caption,
                size: labelSize,
                min: 11,
                weight: 500,
                family: 'Oswald',
                spacing: 0.05,
                color: '#f4f7fb',
                indent: mark + labelSize * 0.38
            });
        }
        lines.push({
            text: metaLine(data.capturedAt, meta.dayOffset),
            size: clamp(m.photoH * 0.036, 11, 30),
            min: 10,
            weight: 600,
            family: 'Outfit',
            spacing: 0.02,
            color: '#ffd15a'
        });
        drawOverlayCopy(ctx, px, py, m.photoW, m.photoH, lines, 0);
        const captionLine = lines[0] && lines[0]._cy && caption ? lines[0] : null;
        if (captionLine) {
            drawDiamond(ctx, px + inset + mark / 2, captionLine._cy, mark, accent);
        }
    }

    function drawStamp(ctx, x, y, m, img, data, meta) {
        const px = x + m.photoX;
        const py = y + m.photoY;
        ctx.fillStyle = '#f3efe6';
        ctx.fillRect(x, y, m.outerW, m.outerH);
        drawPhoto(ctx, img, data, px, py, m.photoW, m.photoH, 0, '#1a1612');

        const inset = Math.round(Math.min(m.photoW, m.photoH) * 0.045);
        const caption = captionFor(data);
        if (caption) {
            const size = clamp(m.photoH * 0.04, 11, 32);
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
            ctx.shadowBlur = size * 0.45;
            ctx.shadowOffsetY = size * 0.08;
            const laid = layoutText(ctx, caption.toUpperCase(), m.photoW - inset * 2, {
                weight: 600,
                size: size,
                min: 10,
                family: 'Oswald',
                spacing: 0.08
            });
            ctx.fillStyle = '#f7f4ee';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(laid.text, px + inset, py + inset);
            ctx.restore();
        }

        if (data.capturedAt && !isNaN(data.capturedAt.getTime())) {
            const size = clamp(m.photoH * 0.055, 12, 42);
            const stamp = formatStamp(data.capturedAt);
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
            ctx.shadowBlur = size * 0.35;
            setType(ctx, 600, size, 'Oswald', 0.08);
            ctx.fillStyle = '#ff6a1a';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(stamp, px + m.photoW - inset, py + m.photoH - inset);
            const w = ctx.measureText(stamp).width;
            ctx.shadowBlur = 0;
            ctx.fillRect(px + m.photoW - inset - w, py + m.photoH - inset + size * 0.12, w, Math.max(2, size * 0.07));
            ctx.restore();
        }

        const tickY = y + m.photoY + m.photoH + m.pad + Math.max(0, (m.caption - m.pad) * 0.15);
        const tickH = clamp(m.caption * 0.28, 4, 14);
        const tickW = tickH * 1.7;
        const gap = tickW * 0.45;
        const totalW = meta.total * tickW + (meta.total - 1) * gap;
        let tickX = x + (m.outerW - totalW) / 2;
        for (let i = 0; i < meta.total; i++) {
            ctx.fillStyle = i === meta.index ? '#ff6a1a' : 'rgba(20, 17, 14, 0.28)';
            ctx.fillRect(tickX, tickY, tickW, tickH);
            tickX += tickW + gap;
        }

        const day = dayText(meta.dayOffset);
        if (day) {
            const size = clamp(m.caption * 0.42, 8, 22);
            const laid = layoutText(ctx, day, m.photoW * 0.34, {
                weight: 600,
                size: size,
                min: 8,
                family: 'Outfit',
                spacing: 0.04
            });
            const textW = ctx.measureText(laid.text).width;
            const ticksRight = x + (m.outerW + totalW) / 2;
            const textLeft = px + m.photoW - textW;
            if (textLeft > ticksRight + tickW) {
                ctx.fillStyle = '#8a8175';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText(laid.text, px + m.photoW, tickY + tickH / 2);
            }
        }
    }

    function drawThemeCell(ctx, x, y, metrics, img, data, meta, theme) {
        ctx.save();
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        if (theme === 'studio') drawStudio(ctx, x, y, metrics, img, data, meta);
        else if (theme === 'diamond') drawDiamondTheme(ctx, x, y, metrics, img, data, meta);
        else if (theme === 'stamp') drawStamp(ctx, x, y, metrics, img, data, meta);
        else drawSignal(ctx, x, y, metrics, img, data, meta);
        ctx.restore();
    }

    function displayTitle(theme, title) {
        const text = (title || '').trim() || 'Progress';
        return theme === 'studio' ? text : text.toUpperCase();
    }

    function drawHeader(ctx, width, height, theme, title, stats) {
        const eyebrow = theme === 'diamond' ? 'DDP YOGA' : theme === 'stamp' ? 'CONTACT SHEET' : 'FITLAPSE';
        const ink = theme === 'studio' ? '#10151f' : '#f4f7fb';
        const muted = theme === 'studio' ? '#5c6b80' : theme === 'stamp' ? '#c8b8a2' : '#9aa8bd';
        const accent = theme === 'diamond' || theme === 'stamp' ? '#ffd15a' : theme === 'studio' ? '#0c66d6' : '#8ec8ff';
        const rule = theme === 'diamond' || theme === 'stamp' ? '#ffd15a' : '#3aa0ff';
        const cx = width / 2;
        const maxW = width * 0.86;

        const eye = layoutText(ctx, eyebrow, maxW, {
            weight: 600,
            size: height * 0.16,
            min: 8,
            family: 'Oswald',
            spacing: 0.28
        });
        ctx.fillStyle = theme === 'diamond' ? '#ffd15a' : muted;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const eyeY = height * 0.24;
        if (theme === 'diamond') {
            const mark = eye.size * 0.55;
            const textW = ctx.measureText(eye.text).width;
            drawDiamond(ctx, cx - textW / 2 - mark * 0.9, eyeY, mark, '#ffd15a');
        }
        ctx.fillText(eye.text, cx, eyeY);

        const heading = layoutText(ctx, displayTitle(theme, title), maxW, {
            weight: theme === 'studio' ? 650 : 500,
            size: height * (theme === 'studio' ? 0.34 : 0.38),
            min: 10,
            family: theme === 'studio' ? 'Outfit' : 'Oswald',
            spacing: theme === 'studio' ? -0.02 : 0.06
        });
        ctx.fillStyle = ink;
        ctx.fillText(heading.text, cx, height * 0.52);

        const stat = layoutText(ctx, stats, maxW, {
            weight: 600,
            size: height * 0.16,
            min: 8,
            family: 'Outfit',
            spacing: 0.02
        });
        ctx.fillStyle = accent;
        ctx.fillText(stat.text, cx, height * 0.78);

        if (theme !== 'stamp') {
            const ruleW = Math.min(width * 0.16, height * 1.4);
            const g = ctx.createLinearGradient(cx - ruleW, 0, cx + ruleW, 0);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(0.5, rule);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(cx - ruleW, height - Math.max(2, height * 0.025), ruleW * 2, Math.max(2, height * 0.02));
        }
    }

    function cellMeta(items, index) {
        const dates = items.map((item) => item.data.capturedAt);
        return {
            index: index,
            total: items.length,
            dayOffset: dayOffset(dates, index)
        };
    }

    function gifLayout(photoW, photoH, theme) {
        const metrics = metricsFor(photoW, photoH, theme, photoH);
        const margin = theme === 'stamp' ? Math.max(2, Math.round(metrics.pad * 0.7)) : 0;
        return {
            metrics: metrics,
            margin: margin,
            width: even(metrics.outerW + margin * 2),
            height: even(metrics.outerH + margin * 2)
        };
    }

    function paintGifFrame(ctx, img, data, index, all, theme, photoW, photoH) {
        const layout = gifLayout(photoW, photoH, theme);
        const items = all.map((entry) => ({ data: entry }));
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = background(theme);
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        drawThemeCell(ctx, layout.margin, layout.margin, layout.metrics, img, data, cellMeta(items, index), theme);
    }

    function renderComposite(items, theme, options) {
        const first = items[0];
        const base = getVisualSize(first.img, first.data.rotation);
        const scale = options.scale || 1;
        const targetH = Math.max(2, Math.round(base.height * scale));
        const cells = items.map((item) => {
            const visual = getVisualSize(item.img, item.data.rotation);
            const photoH = targetH;
            const photoW = Math.max(2, Math.round(visual.width * (targetH / visual.height)));
            return {
                img: item.img,
                data: item.data,
                metrics: metricsFor(photoW, photoH, theme, targetH)
            };
        });

        const vertical = options.layout === 'vertical';
        const gap = Math.max(4, Math.round(cells[0].metrics.pad * 0.7));
        const margin = Math.max(6, Math.round(cells[0].metrics.pad));
        const headerH = Math.max(36, Math.round(targetH * 0.26));
        const contentW = vertical
            ? Math.max.apply(null, cells.map((cell) => cell.metrics.outerW))
            : cells.reduce((sum, cell) => sum + cell.metrics.outerW, 0) + gap * (cells.length - 1);
        const contentH = vertical
            ? cells.reduce((sum, cell) => sum + cell.metrics.outerH, 0) + gap * (cells.length - 1)
            : Math.max.apply(null, cells.map((cell) => cell.metrics.outerH));
        const canvasW = Math.round(contentW + margin * 2);
        const canvasH = Math.round(headerH + contentH + margin * 2);
        const limit = 16384;
        if (canvasW > limit || canvasH > limit || canvasW * canvasH > 48000000) {
            return { error: 'too-large' };
        }

        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = background(theme);
        ctx.fillRect(0, 0, canvasW, canvasH);
        drawHeader(ctx, canvasW, headerH, theme, options.title, buildStats(items));

        let cursorX = margin;
        let cursorY = headerH + margin;
        cells.forEach((cell, index) => {
            const ox = vertical ? margin + (contentW - cell.metrics.outerW) / 2 : cursorX;
            drawThemeCell(ctx, ox, cursorY, cell.metrics, cell.img, cell.data, cellMeta(items, index), theme);
            if (vertical) cursorY += cell.metrics.outerH + gap;
            else cursorX += cell.metrics.outerW + gap;
        });
        return { canvas: canvas };
    }

    function ensureFonts() {
        if (!document.fonts || !document.fonts.load) return Promise.resolve();
        const loads = [
            document.fonts.load('600 64px Oswald'),
            document.fonts.load('500 64px Oswald'),
            document.fonts.load('700 32px Outfit'),
            document.fonts.load('600 32px Outfit'),
            document.fonts.load('500 32px Outfit')
        ];
        return Promise.race([
            Promise.all(loads).then(() => document.fonts.ready),
            new Promise((resolve) => setTimeout(resolve, 2500))
        ]).catch(() => undefined);
    }

    window.FitThemes = {
        background: background,
        getVisualSize: getVisualSize,
        drawImageFitted: drawImageFitted,
        gifLayout: gifLayout,
        paintGifFrame: paintGifFrame,
        renderComposite: renderComposite,
        ensureFonts: ensureFonts,
        formatShortDate: formatShortDate
    };
})();
