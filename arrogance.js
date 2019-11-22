var grid_width = 900;
var grid_block_size=40;
var grid_block_number_x=grid_width/grid_block_size;
var grid_block_number_y=grid_width/grid_block_size;
var current_opacity=0.5;
var tool_down=false;
var background_img = new Image();
var grid=[];
var tools={
    cars: {
        color: 'rgba(209,34,38,0.5)',
        desc: '■ Space for cars'
    },
    pedestrians: {
        color: 'rgba(22,169,227,0.5)',
        desc: '■ Space for pedestrians'
    },
    cyclists: {
        color: 'rgba(150,79,160,0.5)',
        desc: '■ Space for cyclists'
    },
    buildings: {
        color: 'rgba(255,255,100,0.5)',
        desc: '■ Buildings'
    },
    green: {
        color: 'rgba(0,255,0,0.5)',
        desc: '■ Green'
    },
    dead_space: {
        color: 'rgba(148,148,153,0.5)',
        desc: '■ "Dead" space'
    },
    eraser: {
        color: 'rgba(255,255,255,0.5)',
        desc: '□ Eraser'
    }
};
var tools_keys=Object.keys(tools);
var tools_length=Object.keys(tools).length;
var selected_tool=tools_keys[0];
var erase_key=tools_length-1;
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
    grid_width=parseInt($('#container').css('width'),10);
    grid_height=parseInt($('#container').css('height'),10);
    setup();
}

function setup() {
    $('#container').css('width', grid_width);
    $('#container').css('height', grid_height);
    $('#canvas').attr('width', $('#container').css('width'));
    $('#canvas').attr('height', $('#container').css('height'));
    grid_block_size=$('#gridblocksize').val()*1;
    grid_block_number_x=Math.floor(grid_width/grid_block_size);
    grid_block_number_y=Math.floor(grid_height/grid_block_size);
    grid=[];
    for (var x=0;x<=grid_block_number_x;x++) {
        grid[x]=[];
        for (var y=0;y<=grid_block_number_y;y++) {
            grid[x][y]=null;
        }
    }
    draw();
}

function draw() {
    drawBoard();
    drawGrid();
}

function drawBoard(){
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
    tools[tools_keys[erase_key]].color=tools[tools_keys[erase_key]].color.replace(current_opacity, $('#eraseropacity').val()*1);
    current_opacity=$('#eraseropacity').val()*1;
    console.log('changed to '+current_opacity);
    draw();
}

function getMousePos(evt) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
}

function toggleGrid(evt) {
    if (!tool_down) {
        return;
    }
    var pos = getMousePos(evt);

    var x = ((pos.x + (grid_block_size - pos.x%grid_block_size))/grid_block_size)-1;
    var y = ((pos.y + (grid_block_size - pos.y%grid_block_size))/grid_block_size)-1;

    if (grid[x][y]!=null && selected_tool==erase_key) {
        grid[x][y]=null;
    } else {
        grid[x][y]=selected_tool;
    }
}

function drawGrid() {
    context.drawImage(background_img, 0, 0,background_img.width, background_img.height);
    for (var x=0;x<=grid_block_number_x;x++) {
        for (var y=0;y<=grid_block_number_y;y++) {
            if (grid[x][y]!=null) {
                context.fillStyle = tools[grid[x][y]].color;
                context.fillRect(x*grid_block_size+1, y*grid_block_size+1, grid_block_size-1, grid_block_size-1);
            } else {
                context.fillStyle = tools[tools_keys[erase_key]].color;
                context.fillRect(x*grid_block_size+1, y*grid_block_size+1, grid_block_size-1, grid_block_size-1);
            }
        }
    }
}

function changeImage() {
    $('#modal').fadeIn(400, function() {
        img = $('#gridimage')[0].files[0];
        if(img.type.match('image.*')) {
            reader = new FileReader();
            reader.readAsDataURL(img);
            reader.onload = function(evt) {
                if (evt.target.readyState == FileReader.DONE) {
                    background_img=new Image();
                    background_img.src=evt.target.result;
                    background_img.onload=function() {
                        $('#imagedetails').text('Size: '+background_img.width+' x '+background_img.height+' px');
                        if (background_img.width>parseInt($('#container').css('max-width'), 10) || background_img.height>parseInt($('#container').css('max-height'),10)) {
                            var larger_dimension=0;
                            if (background_img.width>background_img.height) {
                                larger_dimension=background_img.width;
                            } else {
                                larger_dimension=background_img.height;
                            }
                            ratio=parseInt($('#container').css('max-width'), 10)/larger_dimension;
                            background_img.width=Math.floor(background_img.width*ratio);
                            background_img.height=Math.floor(background_img.height*ratio);
                        }
                        grid_width=background_img.width;
                        grid_height=background_img.height;
                        context.beginPath();
                        context.clearRect(0,0,grid_width,grid_height);
                        setup();
                    }
                    background_img.onerror=function() {
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
        tool_down=true;
        $('#canvas').addClass('tool_down');
    } else {
        tool_down=false;
        $('#canvas').removeClass('tool_down');
    }
}

$('#canvas').bind('mousewheel DOMMouseScroll', function(e){
    if(e.originalEvent.wheelDelta > 0 || e.originalEvent.detail < 0) {
        new_tool=tools_keys.indexOf(selected_tool)+1;
    }
    else {
        new_tool=tools_keys.indexOf(selected_tool)-1;
    }
    changeTool(new_tool);
});

function changeTool(new_tool) {
    if (new_tool>tools_length-1) {
        new_tool=tools_length-1;
    }
    if (new_tool<0) {
        new_tool=0;
    }
    selected_tool=tools_keys[new_tool];
    $('#tool').text(tools[selected_tool].desc);
    $('#tool').css('background-color', tools[selected_tool].color);
}

function saveImage() {
    makeVirtual();
    var imageurl = virtual_canvas.toDataURL('image/jpg', 0.85);
    $('#save').attr('href', imageurl); // it will save locally
    $('#virtual').hide();
}

function saveGrid() {
    copy=background_img;
    background_img=new Image();
    context.beginPath();
    context.clearRect(0,0,grid_width,grid_height);
    console.log('load');
    drawBoard();
    drawGrid();
    makeVirtual();
    var imageurl = virtual_canvas.toDataURL('image/png');
    $('#savegrid').attr('href', imageurl);
    $('#virtual').hide();
    background_img=copy;
}

function makeVirtual() {
    $('#virtual').attr('width', parseInt($('#canvas').attr('width'), 10));
    $('#virtual').attr('height', parseInt($('#canvas').attr('height'), 10)+100);
    virtual_context.fillStyle = 'white';
    virtual_context.fillRect(0, 0, parseInt($('#virtual').attr('width'), 10), parseInt($('#virtual').attr('height'), 10));
    virtual_context.drawImage(canvas, 0, 0);
    var x=20;
    var y=parseInt($('#virtual').attr('height'), 10)-70;
    virtual_context.font = "18px Arial";
    for (i=0;i<=tools_length-2;i++) { // do not include eraser
        var text_width=virtual_context.measureText(tools[tools_keys[i]].desc).width;
        if (x+text_width>parseInt($('#canvas').attr('width'), 10)) {
            y=y+25;
            x=20;
        }
        virtual_context.fillStyle = tools[tools_keys[i]].color.replace(current_opacity, '1');
        virtual_context.fillText(tools[tools_keys[i]].desc[0], x, y);
        virtual_context.fillStyle = 'black';
        var first_char_width=virtual_context.measureText(tools[tools_keys[i]].desc[0]).width;
        virtual_context.fillText(tools[tools_keys[i]].desc.substr(1), x+first_char_width, y);
        x=x+text_width+20;
    }
    virtual_context.font = "13px Arial";
    virtual_context.fillStyle = 'black';
    branding='The Arrogance of Space Mapping Tool';
    branding_x=parseInt($('#virtual').attr('width'), 10)-10-virtual_context.measureText(branding).width;
    branding_y=parseInt($('#virtual').attr('height'), 10)-12;
    virtual_context.fillText(branding, branding_x, branding_y);
}

function reset() {
    var answer=confirm("Reset will erase any changes. Continue?");
    if (answer) {
        window.location.reload(true);
    }
}

$('input').keydown(function (e) {
    if (e.keyCode == 13) {
        e.preventDefault();
        return false;
    }
});
$('form').submit(function(e) { e.preventDefault(); return false; });
$('#gridblocksize').val(grid_block_size);
$('#gridimage').change(function() { changeImage(); });
$('#gridblocksize').change(function(e) { e.preventDefault(); setup(); drawBoard(); return false; });
$('#eraseropacity').change(function() { changeOpacity(); draw(); });
$('#canvas').bind('mousemove', function (e) { toggleGrid(e); drawGrid(); });
$('#canvas').click(function() { toggleTool() });
$('#toolup').click(function() { new_tool=tools_keys.indexOf(selected_tool)+1; changeTool(new_tool); });
$('#tooldown').click(function() { new_tool=tools_keys.indexOf(selected_tool)-1; changeTool(new_tool); });
$('#save').click(function() { saveImage(); });
$('#savegrid').click(function() { saveGrid(); });
$('#reset').click(function() { reset(); });

initialize();