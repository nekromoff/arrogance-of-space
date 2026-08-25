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
    return Math.min(parseInt($('#editor').css('width'), 10) || 900, 900);
}

function initialize() {
    grid_width = editorSize();
    grid_height = editorSize();
    $('#canvas').attr('width', grid_width);
    $('#canvas').attr('height', grid_height);
    setup();
}

function setup() {
    $('#canvas').attr('width', grid_width);
    $('#canvas').attr('height', grid_height);
    grid_block_size = $('#gridblocksize').val() * 1;
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
    $("#tools").html(Object.entries(tools).map(([tool_name, props]) =>
        `<button data-tool="${tool_name}" class="pure-button tool-button" style="background-color: ${props.color}">
            ${props.desc}
        </button>`
    ));
    draw();
}

function resize_grid() {
    $('#canvas').attr('width', grid_width);
    $('#canvas').attr('height', grid_height);
    grid_block_size = $('#gridblocksize').val() * 1;
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
    current_opacity = $('#eraseropacity').val() * 1;
    for (var i = 0; i < tools_length; i++) {
        tools[tools_keys[i]].color = setOpacity(tools[tools_keys[i]].color, current_opacity);
    }
    $('.tool-button').each(function() {
        $(this).css('background-color', tools[$(this).data().tool].color);
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
    $('#modal').fadeIn(400, function() {
        var img = $('#gridimage')[0].files[0];
        if (img.type.match('image.*')) {
            var reader = new FileReader();
            reader.readAsDataURL(img);
            reader.onload = function(e) {
                if (e.target.readyState == FileReader.DONE) {
                    background_img = new Image();
                    background_img.src = e.target.result;
                    background_img.onload = function() {
                        $('#imagedetails').text('Size: ' + background_img.width + ' x ' + background_img.height + ' px');
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
        $('#modal').fadeOut();
    });
}

$('#canvas').bind('mousewheel DOMMouseScroll', function(e) {
    if (typeof framing !== 'undefined' && framing) {
        return;
    }
    var new_tool;
    if (e.originalEvent.wheelDelta > 0 || e.originalEvent.detail < 0) {
        new_tool = tools_keys.indexOf(selected_tool) + 1;
    } else {
        new_tool = tools_keys.indexOf(selected_tool) - 1;
    }
    changeTool(new_tool);
});

function changeTool(index) {
    const new_tool = Math.max(0, Math.min(index, tools_length - 1));

    selected_tool = tools_keys[new_tool];
    $('.tool-button').each((i, button) => {
        const tool = $(button).data().tool;
        $(button).toggleClass('pure-button-active', tool === selected_tool)
    })
}

function saveImage() {
    makeVirtual();
    var imageurl = virtual_canvas.toDataURL('image/jpg', 0.85);
    $('#save').attr('href', imageurl); // it will save locally
    $('#virtual').hide();
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
    $('#savegrid').attr('href', imageurl);
    $('#virtual').hide();
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
    var available = parseInt($('#virtual').attr('width'), 10) - 40;
    var size = 44;
    virtual_context.fillStyle = 'black';
    virtual_context.textBaseline = 'alphabetic';
    do {
        virtual_context.font = 'bold ' + size + 'px Arial';
        size = size - 2;
    } while (virtual_context.measureText(title).width > available && size > 12);
    virtual_context.fillText(title, 20, header_height - 20);
}

function makeVirtual() {
    var title = ($('#title').val() || '').trim();
    var header_height = title ? 70 : 0;
    $('#virtual').attr('width', parseInt($('#canvas').attr('width'), 10));
    $('#virtual').attr('height', parseInt($('#canvas').attr('height'), 10) + 100 + header_height);
    virtual_context.fillStyle = 'white';
    virtual_context.fillRect(0, 0, parseInt($('#virtual').attr('width'), 10), parseInt($('#virtual').attr('height'), 10));
    virtual_context.drawImage(canvas, 0, header_height);
    if (title) {
        drawTitle(title, header_height);
    }
    var x = 20;
    var y = parseInt($('#virtual').attr('height'), 10) - 70;
    virtual_context.font = "16px Arial";
    var counts = {};
    var count_total = 0;
    for (var temp_x = 0; temp_x <= grid_block_number_x; temp_x++) {
        for (var temp_y = 0; temp_y <= grid_block_number_y; temp_y++) {
            if (grid[temp_x][temp_y] != null) {
                if (!counts[grid[temp_x][temp_y]]) {
                    counts[grid[temp_x][temp_y]] = 0;
                }
                counts[grid[temp_x][temp_y]]++;
                count_total++;
            }
        }
    }
    var marker_counts = {};
    for (var i = 0; i < markers.length; i++) {
        if (marker_counts[markers[i][2]] == undefined) {
            marker_counts[markers[i][2]] = 0;
        }
        marker_counts[markers[i][2]]++;
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
    for (i = 0; i < tools_length - 1; i++) { // do not include last tool - the eraser
        if (percentages[tools_keys[i]]) {
            var percentage_string = ' (' + percentages[tools_keys[i]] + '%)';
            if (tools[tools_keys[i]].markers && marker_counts[tools_keys[i]]) {
                percentage_string = percentage_string + ', ' + marker_counts[tools_keys[i]] + ' counted';
            }
            var percentage_string = percentage_string + ' ';
            var label = tools[tools_keys[i]].desc + percentage_string;
            var text_width = LEGEND_BOX + 6 + virtual_context.measureText(label).width;
            if (x + text_width > parseInt($('#canvas').attr('width'), 10)) {
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
        virtual_context.fillText(map_attribution, 20, parseInt($('#virtual').attr('height'), 10) - 12);
        virtual_context.font = "16px Arial";
    }
    var branding = 'The Arrogance of Space Mapping Tool';
    var branding_x = parseInt($('#virtual').attr('width'), 10) + 10 - virtual_context.measureText(branding).width;
    var branding_y = parseInt($('#virtual').attr('height'), 10) - 23;
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

$('input').keydown(function(e) {
    if (e.keyCode == 13) {
        e.preventDefault();
        return false;
    }
});
$('form').submit(function(e) {
    e.preventDefault();
    return false;
});
$('#gridblocksize').val(grid_block_size);
$('#gridimage').change(function() {
    changeImage();
});
$('#gridblocksize').change(function(e) {
    e.preventDefault();
    resize_grid();
    return false;
});
$('#eraseropacity').on('input change', function() {
    changeOpacity();
    draw();
});
$('#canvas').bind('click mousemove', function(e) {
    if (typeof framing !== 'undefined' && framing) {
        return;
    }
    toggleGrid(e);
    drawGrid();
    drawMarkers();
});
$(document).keyup(function(e) {
    if (typeof framing !== 'undefined' && framing) {
        return;
    }
    if (e.key == 'Backspace') {
        markers.pop();
    }
    drawGrid();
    drawMarkers();
});
$('#canvas').contextmenu(function(e) {
    createMarker(e);
    drawMarkers();
    return false;
});
$(document).on('click', '.tool-button', function() {
    const tool_name = $(this).data().tool;
    const tool_index = tools_keys.indexOf(tool_name);

    changeTool(tool_index)
});
$('#save').click(function() {
    saveImage();
});
$('#savegrid').click(function() {
    saveGrid();
});
$('#reset').click(function() {
    reset();
});
$(document).on('click', '.source-tab', function(e) {
    e.preventDefault();
    var source = $(this).data('source');
    $('.source-tab').removeClass('pure-button-active');
    $(this).addClass('pure-button-active');
    $('.source').attr('hidden', true);
    $('#source-' + source).removeAttr('hidden');
    return false;
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