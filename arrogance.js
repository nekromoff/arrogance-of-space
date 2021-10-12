var grid_width = 900;
var grid_block_size = 40;
var prev_grid_block_size = 40;
var grid_block_number_x = grid_width / grid_block_size;
var grid_block_number_y = grid_width / grid_block_size;
var current_opacity = 0.5;
var tool_down = false;
var background_img = new Image();
var grid = [];
var markers = [];
var tools = {
    cars:  {
        color: 'rgba(209,34,38,0.5)',
        desc: '■ Space for cars',
        markers: true // allow markers for this tool?
    },
    pedestrians:  {
        color: 'rgba(22,169,227,0.5)',
        desc: '■ Space for pedestrians',
        markers: true
    },
    cyclists:  {
        color: 'rgba(150,79,160,0.5)',
        desc: '■ Space for cyclists',
        markers: true
    },
    publictransport:  {
        color: 'rgba(0,85,255,0.5)',
        desc: '■ Public transport',
        markers: true
    },
    buildings: {
        color: 'rgba(255,255,100,0.5)',
        desc: '■ Buildings',
        markers: false
    },
    green: {
        color: 'rgba(0,255,0,0.5)',
        desc: '■ Green',
        markers: true
    },
    dead_space: {
        color: 'rgba(148,148,153,0.5)',
        desc: '■ "Dead" space',
        markers: false
    },
    eraser: {
        color: 'rgba(255,255,255,0.5)',
        desc: '□ Eraser',
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
$('#tool').text(tools[selected_tool].desc);
$('#tool').css('background-color', tools[selected_tool].color);


function initialize() {
    $('#container').css('max-width', $('#editor').css('width'));
    $('#container').css('max-height', $('#editor').css('height'));
    $('#container').css('width', $('#editor').css('width'));
    $('#container').css('height', $('#editor').css('height'));
    $('#canvas').attr('width', $('#container').css('width'));
    $('#canvas').attr('height', $('#container').css('height'));
    grid_width = parseInt($('#container').css('width'), 10);
    grid_height = parseInt($('#container').css('height'), 10);
    setup();
}

function setup() {
    $('#container').css('width', grid_width);
    $('#container').css('height', grid_height);
    $('#canvas').attr('width', $('#container').css('width'));
    $('#canvas').attr('height', $('#container').css('height'));
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
    draw();
}

function resize_grid() {
    $('#container').css('width', grid_width);
    $('#container').css('height', grid_height);
    $('#canvas').attr('width', $('#container').css('width'));
    $('#canvas').attr('height', $('#container').css('height'));
    grid_block_size = $('#gridblocksize').val() * 1;
    grid_block_number_x = Math.floor(grid_width / grid_block_size);
    grid_block_number_y = Math.floor(grid_height / grid_block_size);
    var new_grid = [];
    for (var x = 0; x <= grid_block_number_x; x++) {
        x_prev = Math.floor(x * grid_block_size / prev_grid_block_size);
        new_grid[x] = [];
        for (var y = 0; y <= grid_block_number_y; y++) {
            y_prev = Math.floor(y * grid_block_size / prev_grid_block_size);
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
    context.strokeStyle = 'rgba(0,0,0,0.3)';
    for (var x = 0; x <= grid_width; x += grid_block_size) {
        context.moveTo(x, 0);
        context.lineTo(x, grid_width);
    }
    for (var y = 0; y <= grid_width; y += grid_block_size) {
        context.moveTo(0, y);
        context.lineTo(grid_width, y);
    }
    context.stroke();
}

function changeOpacity() {
    tools[tools_keys[erase_key]].color = tools[tools_keys[erase_key]].color.replace(current_opacity, $('#eraseropacity').val() * 1);
    current_opacity = $('#eraseropacity').val() * 1;
    draw();
}

function getMousePos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function toggleGrid(e) {
    if (!tool_down) {
        return;
    }
    var pos = getMousePos(e);

    var x = ((pos.x + (grid_block_size - pos.x % grid_block_size)) / grid_block_size) - 1;
    var y = ((pos.y + (grid_block_size - pos.y % grid_block_size)) / grid_block_size) - 1;

    if (grid[x][y] != null && selected_tool == erase_key) {
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
        context.fillStyle = tools[markers[i][2]].color.replace(/,(\d+\.?\d*)\)/g, ',1)');
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
        img = $('#gridimage')[0].files[0];
        if (img.type.match('image.*')) {
            reader = new FileReader();
            reader.readAsDataURL(img);
            reader.onload = function(e) {
                if (e.target.readyState == FileReader.DONE) {
                    background_img = new Image();
                    background_img.src = e.target.result;
                    background_img.onload = function()  {
                        $('#imagedetails').text('Size: ' + background_img.width + ' x ' + background_img.height + ' px');
                        if (background_img.width > parseInt($('#container').css('max-width'), 10) || background_img.height > parseInt($('#container').css('max-height'), 10)) {
                            var larger_dimension = 0;
                            if (background_img.width > background_img.height) {
                                larger_dimension = background_img.width;
                            } else {
                                larger_dimension = background_img.height;
                            }
                            ratio = parseInt($('#container').css('max-width'), 10) / larger_dimension;
                            background_img.width = Math.floor(background_img.width * ratio);
                            background_img.height = Math.floor(background_img.height * ratio);
                        }
                        grid_width = background_img.width;
                        grid_height = background_img.height;
                        context.beginPath();
                        context.clearRect(0, 0, grid_width, grid_height);
                        setup();
                    }
                    background_img.onerror = function()  {
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

function toggleTool() {
    if (!tool_down) {
        tool_down = true;
        $('#canvas').addClass('tool_down');
    } else {
        tool_down = false;
        $('#canvas').removeClass('tool_down');
    }
}

$('#canvas').bind('mousewheel DOMMouseScroll', function(e) {
    if (e.originalEvent.wheelDelta > 0 || e.originalEvent.detail < 0) {
        new_tool = tools_keys.indexOf(selected_tool) + 1;
    } else {
        new_tool = tools_keys.indexOf(selected_tool) - 1;
    }
    changeTool(new_tool);
});

function changeTool(new_tool) {
    if (new_tool > tools_length - 1) {
        new_tool = tools_length - 1;
    }
    if (new_tool < 0) {
        new_tool = 0;
    }
    selected_tool = tools_keys[new_tool];
    $('#tool').text(tools[selected_tool].desc);
    $('#tool').css('background-color', tools[selected_tool].color);
}

function saveImage()  {
    makeVirtual();
    var imageurl = virtual_canvas.toDataURL('image/jpg', 0.85);
    $('#save').attr('href', imageurl); // it will save locally
    $('#virtual').hide();
    return false;
}

function saveGrid()  {
    copy = background_img;
    background_img = new Image();
    context.beginPath();
    context.clearRect(0, 0, grid_width, grid_height);
    drawBoard();
    drawGrid();
    drawMarkers();
    makeVirtual();
    var imageurl = virtual_canvas.toDataURL('image/png');
    $('#savegrid').attr('href', imageurl);
    $('#virtual').hide();
    background_img = copy;
    return false;
}

function makeVirtual() {
    $('#virtual').attr('width', parseInt($('#canvas').attr('width'), 10));
    $('#virtual').attr('height', parseInt($('#canvas').attr('height'), 10) + 100);
    virtual_context.fillStyle = 'white';
    virtual_context.fillRect(0, 0, parseInt($('#virtual').attr('width'), 10), parseInt($('#virtual').attr('height'), 10));
    virtual_context.drawImage(canvas, 0, 0);
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
            var text_width = virtual_context.measureText(tools[tools_keys[i]].desc + percentage_string).width;
            if (x + text_width > parseInt($('#canvas').attr('width'), 10)) {
                y = y + 21;
                x = 18;
            }
            virtual_context.fillStyle = tools[tools_keys[i]].color.replace(current_opacity, '1');
            virtual_context.fillText(tools[tools_keys[i]].desc[0], x, y);
            virtual_context.fillStyle = 'black';
            var first_char_width = virtual_context.measureText(tools[tools_keys[i]].desc[0]).width;
            virtual_context.fillText(tools[tools_keys[i]].desc.substr(1) + percentage_string, x + first_char_width, y);
            x = x + text_width + 18;
        }
    }
    branding = 'The Arrogance of Space Mapping Tool';
    branding_x = parseInt($('#virtual').attr('width'), 10) - 10 - virtual_context.measureText(branding).width;
    branding_y = parseInt($('#virtual').attr('height'), 10) - 12;
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
    if (answer)  {
        window.location.reload(true);
    }
}

function createMarker(e) {
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
$('#gridimage').change(function()  {
    changeImage();
});
$('#gridblocksize').change(function(e) { 
    e.preventDefault();
    resize_grid();
    drawBoard();
    return false;
});
$('#eraseropacity').on('input change', function() {
    changeOpacity();
    draw();
});
$('#canvas').bind('mousemove', function(e) {
    toggleGrid(e);
    drawGrid();
    drawMarkers();
});
$('#canvas').click(function() {
    toggleTool();
});
$(document).keyup(function(e) {
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
$('#toolup').click(function() {
    new_tool = tools_keys.indexOf(selected_tool) + 1;
    changeTool(new_tool);
});
$('#tooldown').click(function() {
    new_tool = tools_keys.indexOf(selected_tool) - 1;
    changeTool(new_tool);
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