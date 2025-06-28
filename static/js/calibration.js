let markingState = {
    frets: [1, 5, 7, 9, 12, 15],
    positions: {},
    dragging: null,
    offset: {x:0, y:0},
    moved: {}
};

async function checkCalibration() {
    const res = await fetch('/calibration_status');
    const data = await res.json();
    if (!data.calibrated) {
        showMarkingOverlay();
        document.getElementById('recalibrate-btn').style.display = 'none';
    } else {
        hideMarkingOverlay();
        document.getElementById('recalibrate-btn').style.display = '';
    }
}

function showMarkingOverlay() {
    const overlay = document.getElementById('marking-overlay');
    overlay.style.display = '';
    document.getElementById('marking-calibrate-btn').style.display = '';
    document.getElementById('recalibrate-btn').style.display = 'none';
    // Reset button positions
    setFretBtnPosition('fret-btn-1', 0.1, 0.5);
    setFretBtnPosition('fret-btn-5', 0.2, 0.5);
    setFretBtnPosition('fret-btn-7', 0.35, 0.5);
    setFretBtnPosition('fret-btn-9', 0.5, 0.5);
    setFretBtnPosition('fret-btn-12', 0.7, 0.5);
    setFretBtnPosition('fret-btn-15', 0.85, 0.5);
    markingState.moved = {};
}

function hideMarkingOverlay() {
    document.getElementById('marking-overlay').style.display = 'none';
    document.getElementById('marking-calibrate-btn').style.display = 'none';
}

function setFretBtnPosition(btnId, relX, relY) {
    const overlay = document.getElementById('marking-overlay');
    const btn = document.getElementById(btnId);
    const w = overlay.offsetWidth;
    const h = overlay.offsetHeight;
    btn.style.left = (w * relX - 14) + 'px';
    btn.style.top = (h * relY - 14) + 'px';
}

// Drag logic for fret buttons
window.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.fret-drag-btn').forEach(btn => {
        btn.onmousedown = function(e) {
            markingState.dragging = btn;
            const rect = btn.getBoundingClientRect();
            markingState.offset.x = e.clientX - rect.left;
            markingState.offset.y = e.clientY - rect.top;
            btn.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
            markingState.moved[btn.textContent] = true;
        };
    });
    document.addEventListener('mousemove', function(e) {
        if (markingState.dragging) {
            const overlay = document.getElementById('marking-overlay');
            const rect = overlay.getBoundingClientRect();
            let x = e.clientX - rect.left - markingState.offset.x + 14;
            let y = e.clientY - rect.top - markingState.offset.y + 14;
            // Clamp to overlay bounds
            x = Math.max(0, Math.min(x, overlay.offsetWidth-28));
            y = Math.max(0, Math.min(y, overlay.offsetHeight-28));
            markingState.dragging.style.left = x + 'px';
            markingState.dragging.style.top = y + 'px';
        }
    });
    document.addEventListener('mouseup', function(e) {
        if (markingState.dragging) {
            markingState.dragging.style.cursor = 'grab';
            document.body.style.userSelect = '';
            markingState.dragging = null;
        }
    });

    document.getElementById('marking-calibrate-btn').onclick = async function() {
        if (Object.keys(markingState.moved).length < markingState.frets.length) {
            alert('Please move all fret buttons to the correct positions before finishing calibration.');
            return;
        }
        const overlay = document.getElementById('marking-overlay');
        let fretPositions = {};
        markingState.frets.forEach(fret => {
            const btn = document.getElementById('fret-btn-' + fret);
            const x = btn.offsetLeft + 14;
            const y = btn.offsetTop + 14;
            fretPositions[fret] = {x: Math.round(x), y: Math.round(y)};
        });
        await fetch('/calibrate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(fretPositions)
        });
        hideMarkingOverlay();
        checkCalibration();
    };

    document.getElementById('recalibrate-btn').onclick = function() {
        showMarkingOverlay();
        document.getElementById('recalibrate-btn').style.display = 'none';
    };

    checkCalibration();
}); 