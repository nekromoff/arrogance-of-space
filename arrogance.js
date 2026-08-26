var grid_width = 900;
var grid_height = 900;
var grid_block_size = 40;
var prev_grid_block_size = 40;
var grid_block_number_x = grid_width / grid_block_size;
var grid_block_number_y = grid_width / grid_block_size;
var current_opacity = 0.5;
var background_img = new Image();
var grid = [];
var markers = [];
var tools = {
    cars: {
        color: 'rgba(209,34,38,0.5)',
        desc: 'Cars',
        markers: true // allow markers for this tool?
    },
    pedestrians: {
        color: 'rgba(22,169,227,0.5)',
        desc: 'Pedestrians',
        markers: true
    },
    cyclists: {
        color: 'rgba(150,79,160,0.5)',
        desc: 'Cyclists',
        markers: true
    },
    publictransport: {
        color: 'rgba(0,85,255,0.5)',
        desc: 'Public transport',
        markers: true
    },
    buildings: {
        color: 'rgba(255,255,100,0.5)',
        desc: 'Buildings',
        markers: false
    },
    green: {
        color: 'rgba(0,255,0,0.5)',
        desc: 'Green',
        markers: true
    },
    dead_space: {
        color: 'rgba(148,148,153,0.5)',
        desc: '"Dead" space',
        markers: false
    },
    eraser: {
        color: 'rgba(255,255,255,0.5)',
        desc: 'Eraser',
        markers: false
    }
};
var tools_keys = Object.keys(tools);
var tools_length = Object.keys(tools).length;
var selected_tool = tools_keys[0];
var erase_key = tools_length - 1;
/* ------------------------------------------------------------------ *
 * Small DOM helpers, in place of jQuery
 * ------------------------------------------------------------------ */

var FADE_MS = 200;

function byId(id) {
    return document.getElementById(id);
}

function all(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
}

function elementWidth(element) {
    return parseInt(window.getComputedStyle(element).width, 10) || 0;
}

/** Fades an element in, then calls done. Opacity itself lives in the CSS. */
function fadeIn(element, done) {
    element.style.display = 'block';
    void element.offsetWidth; // force a reflow so the transition runs
    element.classList.add('visible');
    if (done) {
        window.setTimeout(done, FADE_MS);
    }
}

function fadeOut(element, done) {
    element.classList.remove('visible');
    window.setTimeout(function() {
        element.style.display = 'none';
        if (done) {
            done();
        }
    }, FADE_MS);
}

/** Click handler that survives elements being recreated, like jQuery's on(). */
function onClick(selector, handler) {
    document.addEventListener('click', function(e) {
        var match = e.target.closest(selector);
        if (match) {
            handler.call(match, e);
        }
    });
}

var canvas = document.getElementById('canvas');
var context = canvas.getContext("2d");
var virtual_canvas = document.getElementById('virtual');
var virtual_context = virtual_canvas.getContext('2d');

/**
 * The canvas resolution to work at: the editor column, capped at 900. The
 * canvas keeps this pixel size for its whole life and CSS scales it to
 * whatever room there is, so resizing the window never disturbs the grid.
 */
function editorSize() {
    return Math.min(elementWidth(byId('editor')) || 900, 900);
}

function initialize() {
    grid_width = editorSize();
    grid_height = editorSize();
    canvas.width = grid_width;
    canvas.height = grid_height;
    setup();
}

function setup() {
    canvas.width = grid_width;
    canvas.height = grid_height;
    grid_block_size = byId('gridblocksize').value * 1;
    grid_block_number_x = Math.floor(grid_width / grid_block_size);
    grid_block_number_y = Math.floor(grid_height / grid_block_size);
    grid = [];
    for (var x = 0; x <= grid_block_number_x; x++) {
        grid[x] = [];
        for (var y = 0; y <= grid_block_number_y; y++) {
            grid[x][y] = null;
        }
    }
    markers = [];

    // Create button for each tool
    byId('tools').innerHTML = Object.entries(tools).map(([tool_name, props]) =>
        `<button data-tool="${tool_name}" class="pure-button tool-button" style="background-color: ${props.color}">
            ${props.desc}<span class="tool-count" data-tool="${tool_name}"></span>
        </button>`
    ).join('');
    draw();
}

function resize_grid() {
    canvas.width = grid_width;
    canvas.height = grid_height;
    grid_block_size = byId('gridblocksize').value * 1;
    grid_block_number_x = Math.floor(grid_width / grid_block_size);
    grid_block_number_y = Math.floor(grid_height / grid_block_size);
    var new_grid = [];
    for (var x = 0; x <= grid_block_number_x; x++) {
        var x_prev = Math.floor(x * grid_block_size / prev_grid_block_size);
        new_grid[x] = [];
        for (var y = 0; y <= grid_block_number_y; y++) {
            var y_prev = Math.floor(y * grid_block_size / prev_grid_block_size);
            new_grid[x][y] = grid[x_prev][y_prev];
        }
    }
    prev_grid_block_size = grid_block_size;
    grid = new_grid;
    draw();
}

function draw() {
    drawBoard();
    drawGrid();
    drawMarkers();
    updateToolLabels();
}

function drawBoard() {
    context.beginPath();
    context.strokeStyle = 'rgba(0,0,0,0.3)';
    for (var x = 0; x <= grid_width; x += grid_block_size) {
        context.moveTo(x, 0);
        context.lineTo(x, grid_height);
    }
    for (var y = 0; y <= grid_height; y += grid_block_size) {
        context.moveTo(0, y);
        context.lineTo(grid_width, y);
    }
    context.stroke();
}

function setOpacity(color, opacity) {
    return color.replace(/,\s*[\d.]+\s*\)\s*$/, ',' + opacity + ')');
}

function changeOpacity() {
    current_opacity = byId('eraseropacity').value * 1;
    for (var i = 0; i < tools_length; i++) {
        tools[tools_keys[i]].color = setOpacity(tools[tools_keys[i]].color, current_opacity);
    }
    all('.tool-button').forEach(function(button) {
        button.style.backgroundColor = tools[button.dataset.tool].color;
    });
}

/** How many canvas pixels there are per screen pixel (1 unless CSS scaled it). */
function canvasScale() {
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
        return { x: 1, y: 1 };
    }
    return {
        x: canvas.width / rect.width,
        y: canvas.height / rect.height
    };
}

function getMousePos(e) {
    var rect = canvas.getBoundingClientRect();
    var scale = canvasScale();
    return {
        x: (e.clientX - rect.left) * scale.x,
        y: (e.clientY - rect.top) * scale.y
    };
}

function toggleGrid(e) {
    if (e.type === 'mousemove' && e.buttons !== 1) {
        return;
    }
    if (typeof framing !== 'undefined' && framing) {
        return;
    }

    var pos = getMousePos(e);

    var x = ((pos.x + (grid_block_size - pos.x % grid_block_size)) / grid_block_size) - 1;
    var y = ((pos.y + (grid_block_size - pos.y % grid_block_size)) / grid_block_size) - 1;

    if (x < 0 || y < 0 || x > grid_block_number_x || y > grid_block_number_y) {
        return;
    }

    if (selected_tool == tools_keys[erase_key]) {
        grid[x][y] = null;
    } else {
        grid[x][y] = selected_tool;
    }
}

function drawGrid() {
    context.drawImage(background_img, 0, 0, background_img.width, background_img.height);
    for (var x = 0; x <= grid_block_number_x; x++) {
        for (var y = 0; y <= grid_block_number_y; y++) {
            if (grid[x][y] != null) {
                context.fillStyle = tools[grid[x][y]].color;
                context.fillRect(x * grid_block_size + 1, y * grid_block_size + 1, grid_block_size - 1, grid_block_size - 1);
            } else {
                context.fillStyle = tools[tools_keys[erase_key]].color;
                context.fillRect(x * grid_block_size + 1, y * grid_block_size + 1, grid_block_size - 1, grid_block_size - 1);
            }
        }
    }
    context.fill();
}

function drawMarkers() {
    for (var i = 0; i < markers.length; i++) {
        //context.moveTo(markers[i][0], markers[i][1]);
        context.beginPath();
        // change opacity to full
        context.fillStyle = setOpacity(tools[markers[i][2]].color, 1);
        context.arc(markers[i][0], markers[i][1], 3, 0, 2 * Math.PI);
        context.closePath();
        context.fill();
        context.beginPath();
        context.strokeStyle = 'white';
        context.arc(markers[i][0], markers[i][1], 4, 0, 2 * Math.PI);
        context.closePath();
        context.stroke();
    }
}

function changeImage() {
    fadeIn(byId('modal'), function() {
        var img = byId('gridimage').files[0];
        if (img.type.match('image.*')) {
            var reader = new FileReader();
            reader.readAsDataURL(img);
            reader.onload = function(e) {
                if (e.target.readyState == FileReader.DONE) {
                    background_img = new Image();
                    background_img.src = e.target.result;
                    background_img.onload = function() {
                        byId('imagedetails').textContent = 'Size: ' + background_img.width + ' x ' + background_img.height + ' px';
                        if (background_img.width > editorSize() || background_img.height > editorSize()) {
                            var larger_dimension = 0;
                            if (background_img.width > background_img.height) {
                                larger_dimension = background_img.width;
                            } else {
                                larger_dimension = background_img.height;
                            }
                            var ratio = editorSize() / larger_dimension;
                            background_img.width = Math.floor(background_img.width * ratio);
                            background_img.height = Math.floor(background_img.height * ratio);
                        }
                        grid_width = background_img.width;
                        grid_height = background_img.height;
                        context.beginPath();
                        context.clearRect(0, 0, grid_width, grid_height);
                        setup();
                    }
                    background_img.onerror = function() {
                        window.alert('Error loading image. Please try again.');
                    }
                }
            }
        } else {
            window.alert('Not an image. Please select an image file - JPG, PNG etc.');
        }
        fadeOut(byId('modal'));
    });
}

canvas.addEventListener('wheel', function(e) {
    if (typeof framing !== 'undefined' && framing) {
        return;
    }
    var new_tool;
    if (e.deltaY < 0) {
        new_tool = tools_keys.indexOf(selected_tool) + 1;
    } else {
        new_tool = tools_keys.indexOf(selected_tool) - 1;
    }
    changeTool(new_tool);
});

function changeTool(index) {
    const new_tool = Math.max(0, Math.min(index, tools_length - 1));

    selected_tool = tools_keys[new_tool];
    all('.tool-button').forEach(function(button) {
        button.classList.toggle('pure-button-active', button.dataset.tool === selected_tool);
    });
}

function saveImage() {
    makeVirtual();
    var imageurl = virtual_canvas.toDataURL('image/jpg', 0.85);
    byId('save').setAttribute('href', imageurl); // it will save locally
    virtual_canvas.style.display = 'none';
    return false;
}

function saveGrid() {
    var copy = background_img;
    background_img = new Image();
    context.beginPath();
    context.clearRect(0, 0, grid_width, grid_height);
    draw();
    makeVirtual();
    var imageurl = virtual_canvas.toDataURL('image/png');
    byId('savegrid').setAttribute('href', imageurl);
    virtual_canvas.style.display = 'none';
    background_img = copy;
    draw(); // put the photo back on screen
    return false;
}

var LEGEND_BOX = 20;

/** Draws the tool's colour as a square with a thin black outline. */
function drawLegendBox(tool, x, y) {
    virtual_context.fillStyle = setOpacity(tool.color, 1);
    virtual_context.fillRect(x, y - LEGEND_BOX + 4, LEGEND_BOX, LEGEND_BOX);
    virtual_context.strokeStyle = 'black';
    virtual_context.lineWidth = 1;
    virtual_context.strokeRect(x + 0.5, y - LEGEND_BOX + 4.5, LEGEND_BOX - 1, LEGEND_BOX - 1);
}

/** Draws the header title, shrinking it until it fits the canvas width. */
function drawTitle(title, header_height) {
    var available = virtual_canvas.width - 40;
    var size = 44;
    virtual_context.fillStyle = 'black';
    virtual_context.textBaseline = 'alphabetic';
    do {
        virtual_context.font = 'bold ' + size + 'px Arial';
        size = size - 2;
    } while (virtual_context.measureText(title).width > available && size > 12);
    virtual_context.fillText(title, 20, header_height - 20);
}

/**
 * Share of the painted squares held by each tool, plus how many markers each
 * one carries. Percentages are whole numbers summing to 100 and only count
 * squares that have actually been painted, so unpainted map does not dilute
 * them. Used for both the on-screen tool buttons and the saved legend.
 */
function gridStats() {
    var counts = {};
    var count_total = 0;
    for (var x = 0; x <= grid_block_number_x; x++) {
        for (var y = 0; y <= grid_block_number_y; y++) {
            if (grid[x][y] != null) {
                counts[grid[x][y]] = (counts[grid[x][y]] || 0) + 1;
                count_total++;
            }
        }
    }
    var marker_counts = {};
    for (var i = 0; i < markers.length; i++) {
        marker_counts[markers[i][2]] = (marker_counts[markers[i][2]] || 0) + 1;
    }
    var percentages = {};
    for (const [key, value] of Object.entries(counts)) {
        percentages[key] = (value / count_total) * 100;
    }
    var percentages_rounded = largestRemainderRound(percentages, 100);
    // ugly iterator, feel free to fix based on adapted largest remainder rounding function
    var i = 0;
    for (const [key, value] of Object.entries(percentages)) {
        percentages[key] = percentages_rounded[i];
        i++;
    }
    return { percentages: percentages, marker_counts: marker_counts };
}

/**
 * Puts the live share, and the marker count where there is one, on each tool
 * button: "Cars (7%)", "Cars (7%, 8)", or "Cars (8)" when the tool has been
 * counted but nothing is painted in it.
 */
function updateToolLabels() {
    var stats = gridStats();
    all('.tool-count').forEach(function(element) {
        var tool = element.dataset.tool;
        var parts = [];
        if (stats.percentages[tool]) {
            parts.push(stats.percentages[tool] + '%');
        }
        // markers stand on their own: a tool can be counted without a square
        // of it being painted, and a share can round away to nothing
        if (tools[tool].markers && stats.marker_counts[tool]) {
            parts.push(stats.marker_counts[tool]);
        }
        element.textContent = parts.length ? ' (' + parts.join(', ') + ')' : '';
    });
}

function makeVirtual() {
    var title = (byId('title').value || '').trim();
    var header_height = title ? 70 : 0;
    virtual_canvas.width = canvas.width;
    virtual_canvas.height = canvas.height + 100 + header_height;
    virtual_context.fillStyle = 'white';
    virtual_context.fillRect(0, 0, virtual_canvas.width, virtual_canvas.height);
    virtual_context.drawImage(canvas, 0, header_height);
    if (title) {
        drawTitle(title, header_height);
    }
    var x = 20;
    var y = virtual_canvas.height - 70;
    virtual_context.font = "16px Arial";
    var stats = gridStats();
    var percentages = stats.percentages;
    var marker_counts = stats.marker_counts;
    for (var i = 0; i < tools_length - 1; i++) { // do not include last tool - the eraser
        var parts = [];
        if (percentages[tools_keys[i]]) {
            parts.push(percentages[tools_keys[i]] + '%');
        }
        if (tools[tools_keys[i]].markers && marker_counts[tools_keys[i]]) {
            parts.push(marker_counts[tools_keys[i]] + ' counted');
        }
        if (parts.length) {
            var label = tools[tools_keys[i]].desc + ' (' + parts.join(', ') + ') ';
            var text_width = LEGEND_BOX + 6 + virtual_context.measureText(label).width;
            if (x + text_width > canvas.width) {
                y = y + LEGEND_BOX + 7;
                x = 18;
            }
            drawLegendBox(tools[tools_keys[i]], x, y);
            virtual_context.fillStyle = 'black';
            virtual_context.font = "16px Arial";
            virtual_context.fillText(label, x + LEGEND_BOX + 6, y);
            x = x + text_width + 18;
        }
    }
    if (typeof map_attribution !== 'undefined' && map_attribution) {
        virtual_context.font = "11px Arial";
        virtual_context.fillStyle = 'black';
        virtual_context.fillText(map_attribution, 20, virtual_canvas.height - 12);
        virtual_context.font = "16px Arial";
    }
    var branding = 'The Arrogance of Space Mapping Tool';
    var branding_x = virtual_canvas.width + 10 - virtual_context.measureText(branding).width;
    var branding_y = virtual_canvas.height - 23;
    virtual_context.beginPath();
    virtual_context.fillStyle = 'black';
    virtual_context.fillRect(branding_x - 12, branding_y - 18, virtual_context.measureText(branding).width - 13, 27);
    virtual_context.closePath();
    virtual_context.font = "bold 13px Arial";
    virtual_context.fillStyle = 'white';
    virtual_context.fillText(branding, branding_x, branding_y);
}

function reset() {
    var answer = confirm("Reset will erase any changes. Continue?");
    if (answer) {
        window.location.reload(true);
    }
}

function createMarker(e) {
    if (typeof framing !== 'undefined' && framing) {
        return;
    }
    if (tools[selected_tool].markers) {
        var pos = getMousePos(e);
        markers.push([pos.x, pos.y, selected_tool]);
    }
}

all('input').forEach(function(input) {
    input.addEventListener('keydown', function(e) {
        if (e.keyCode == 13) {
            e.preventDefault();
        }
    });
});
all('form').forEach(function(form) {
    form.addEventListener('submit', function(e) {
        e.preventDefault();
    });
});
byId('gridblocksize').value = grid_block_size;
byId('gridimage').addEventListener('change', function() {
    changeImage();
});
byId('gridblocksize').addEventListener('change', function(e) {
    e.preventDefault();
    resize_grid();
    if (typeof showBlockScale === 'function') {
        showBlockScale();
    }
});
['input', 'change'].forEach(function(event_name) {
    byId('eraseropacity').addEventListener(event_name, function() {
        changeOpacity();
        draw();
    });
});
['click', 'mousemove'].forEach(function(event_name) {
    canvas.addEventListener(event_name, function(e) {
        if (typeof framing !== 'undefined' && framing) {
            return;
        }
        toggleGrid(e);
        drawGrid();
        drawMarkers();
        updateToolLabels();
    });
});
document.addEventListener('keyup', function(e) {
    if (typeof framing !== 'undefined' && framing) {
        return;
    }
    if (e.key == 'Backspace') {
        markers.pop();
    }
    drawGrid();
    drawMarkers();
    updateToolLabels();
});
canvas.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    createMarker(e);
    drawMarkers();
    updateToolLabels();
});
onClick('.tool-button', function() {
    changeTool(tools_keys.indexOf(this.dataset.tool));
});
byId('save').addEventListener('click', function() {
    saveImage();
});
byId('savegrid').addEventListener('click', function() {
    saveGrid();
});
byId('reset').addEventListener('click', function() {
    reset();
});
onClick('.source-tab', function(e) {
    e.preventDefault();
    var source = this.dataset.source;
    var tab = this;
    all('.source-tab').forEach(function(button) {
        button.classList.toggle('pure-button-active', button === tab);
    });
    all('.source').forEach(function(panel) {
        panel.setAttribute('hidden', 'hidden');
    });
    byId('source-' + source).removeAttribute('hidden');
});

/**
 * largestRemainderRound will round each number in an array to the nearest
 * integer but make sure that the the sum of all the numbers still equals
 * desiredTotal. Uses Largest Remainder Method.  Returns numbers in order they
 * came.
 *
 * @param {number[]} numbers - numbers to round
 * @param {number} desiredTotal - total that sum of the return list must equal
 * @return {number[]} the list of rounded numbers
 * @example
 *
 * var numbers = [13.6263, 47.9896, 9.59600 28.7880]
 * largestRemainderRound(numbers, 100)
 *
 * // => [14, 48, 9, 29]
 *
 * adapted from: https://gist.github.com/scwood/e58380174bd5a94174c9f08ac921994f
 */
function largestRemainderRound(numbers, desiredTotal) {
    if (Object.keys(numbers).length === 0 && numbers.constructor === Object) {
        return 0;
    }
    numbers = Object.keys(numbers).map((key) => [numbers[key]]);
    var result = numbers.map(function(number, index) {
        return {
            floor: Math.floor(number),
            remainder: getRemainder(number),
            index: index,
        };
    }).sort(function(a, b) {
        return b.remainder - a.remainder;
    });

    var lowerSum = result.reduce(function(sum, current) {
        return sum + current.floor;
    }, 0);

    var delta = desiredTotal - lowerSum;
    for (var i = 0; i < delta; i++) {
        result[i].floor++;
    }

    return result.sort(function(a, b) {
        return a.index - b.index;
    }).map(function(result) {
        return result.floor;
    });
}

function getRemainder(number) {
    var remainder = number - Math.floor(number);
    return remainder.toFixed(4);
}

initialize();