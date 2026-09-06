/**
 * Experimental hexagon grid: a drop-in alternative geometry, switched on by
 * the "hexagons" box next to Grid.
 *
 * Nothing in here runs unless that box is ticked. arrogance.js and osm.js keep
 * their own square code exactly as it was and only hand over through
 * hexActive(), so with the box clear the tool behaves as if this file were not
 * loaded at all. Delete the script tag and the checkbox and the square grid is
 * untouched.
 *
 * Everything downstream of the grid needs no changes, because the grid keeps
 * its shape: grid[x][y] holding a tool name, walked 0..grid_block_number_x by
 * 0..grid_block_number_y. Percentages, markers, the legend and both save
 * buttons therefore work as they are.
 *
 * The layout is "odd-r" offset - pointy-top hexagons in rows, odd rows pushed
 * half a hexagon right. x is the column within a row, y is the row.
 *
 * This is the browser only. The PHP bot in php/ still renders squares, so a
 * hexagon render is not comparable with what the bot posts.
 */
var HexGrid = (function() {

    /**
     * A hexagon with the same area as a square of side b has circumradius
     * b * sqrt(2 / (3*sqrt(3))), about 0.62 b. Matching the area rather than
     * the width is what keeps the percentages meaning the same thing as on the
     * square grid: one cell is still one cell's worth of ground.
     */
    var AREA_RATIO = Math.sqrt(2 / (3 * Math.sqrt(3)));
    var ROOT3 = Math.sqrt(3);

    /** True when the module is loaded and the box is ticked. */
    function active() {
        var box = byId('hexgrid');
        return !!(box && box.checked);
    }

    /* ---- geometry ---------------------------------------------------- *
     * All of it takes the block size explicitly, because resampling has to
     * ask questions about the grid as it used to be laid out.
     * ------------------------------------------------------------------ */

    /** Centre-to-corner radius of the hexagon standing in for a block. */
    function radius(block) {
        return block * AREA_RATIO;
    }

    /** Corner-to-corner across the flat: the horizontal pitch between cells. */
    function cellWidth(block) {
        return ROOT3 * radius(block);
    }

    /** Vertical pitch between rows: three quarters of the hexagon's height. */
    function rowPitch(block) {
        return 1.5 * radius(block);
    }

    /** Centre of cell (col, row) in canvas pixels. */
    function centreOf(block, col, row) {
        var w = cellWidth(block);
        return {
            x: w * (col + 0.5 * (row & 1)) + w / 2,
            y: rowPitch(block) * row + radius(block)
        };
    }

    /**
     * Rounds fractional axial coordinates to the hexagon they land in, by
     * rounding in cube space and repairing whichever axis rounded worst. The
     * hexagon equivalent of Math.floor(px / block_size).
     */
    function cubeRound(q, r) {
        var s = -q - r;
        var rq = Math.round(q);
        var rr = Math.round(r);
        var rs = Math.round(s);
        var dq = Math.abs(rq - q);
        var dr = Math.abs(rr - r);
        var ds = Math.abs(rs - s);
        if (dq > dr && dq > ds) {
            rq = -rr - rs;
        } else if (dr > ds) {
            rr = -rq - rs;
        }
        return { q: rq, r: rr };
    }

    /** Which cell a canvas pixel belongs to. May be outside the grid. */
    function cellAt(block, px, py) {
        var s = radius(block);
        var w = cellWidth(block);
        var x = px - w / 2;
        var y = py - s;
        var rounded = cubeRound((ROOT3 / 3 * x - y / 3) / s, (2 / 3 * y) / s);
        return {
            x: rounded.q + (rounded.r - (rounded.r & 1)) / 2,
            y: rounded.r
        };
    }

    /**
     * Pulls a cell into a grid that size. The lattice reaches a little past
     * the canvas on every side - odd rows start half a hexagon to the right,
     * so without this the left edge of every other row, and matching slivers
     * at the other three, would be unpaintable and uncounted. Those pixels
     * join the edge cell instead, which is only ever a cell already cut short
     * by the canvas. cellArea() measures what each one really got, so the
     * coverage threshold stays honest about it.
     */
    function clampTo(cell, nx, ny) {
        return {
            x: Math.max(0, Math.min(nx, cell.x)),
            y: Math.max(0, Math.min(ny, cell.y))
        };
    }

    /** Traces the six corners of a cell. Expects an open path. */
    function trace(ctx, col, row) {
        var s = radius(grid_block_size);
        var c = centreOf(grid_block_size, col, row);
        for (var i = 0; i < 6; i++) {
            var angle = Math.PI / 180 * (60 * i - 30);
            var x = c.x + s * Math.cos(angle);
            var y = c.y + s * Math.sin(angle);
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
    }

    /* ---- the grid ---------------------------------------------------- */

    /**
     * How many cells fit, in the same "one more than this" sense the square
     * grid uses: the loops run 0..grid_block_number_x inclusive, and the last
     * column and row are the ones the canvas edge cuts through.
     */
    function setCounts() {
        grid_block_number_x = Math.floor(grid_width / cellWidth(grid_block_size));
        grid_block_number_y = Math.floor(grid_height / rowPitch(grid_block_size));
    }

    /** The tool under this new cell's centre in the grid as it used to be. */
    function carry(old, col, row) {
        var point = active()
            ? centreOf(grid_block_size, col, row)
            : {
                x: col * grid_block_size + grid_block_size / 2,
                y: row * grid_block_size + grid_block_size / 2
            };
        var was = old.hex
            ? clampTo(cellAt(old.block, point.x, point.y), old.nx, old.ny)
            : { x: Math.floor(point.x / old.block), y: Math.floor(point.y / old.block) };
        if (was.x < 0 || was.y < 0 || was.x > old.nx || was.y > old.ny) {
            return null;
        }
        if (!old.grid[was.x] || old.grid[was.x][was.y] == null) {
            return null;
        }
        return old.grid[was.x][was.y];
    }

    /**
     * Lays the grid out again for the current mode and block size, carrying
     * the paint over from a grid that was laid out as old_hex / old_block:
     * every new cell takes whatever was under its centre. Markers are pixel
     * positions and do not move.
     */
    function rebuild(old_hex, old_block) {
        var old = {
            grid: grid,
            nx: grid_block_number_x,
            ny: grid_block_number_y,
            hex: old_hex,
            block: old_block
        };
        grid_block_size = byId('gridblocksize').value * 1;
        if (active()) {
            setCounts();
        } else {
            grid_block_number_x = Math.floor(grid_width / grid_block_size);
            grid_block_number_y = Math.floor(grid_height / grid_block_size);
        }
        var fresh = [];
        for (var x = 0; x <= grid_block_number_x; x++) {
            fresh[x] = [];
            for (var y = 0; y <= grid_block_number_y; y++) {
                fresh[x][y] = carry(old, x, y);
            }
        }
        grid = fresh;
        pixel_map = null;
        prev_grid_block_size = grid_block_size;
        draw();
    }

    /* ---- drawing ----------------------------------------------------- */

    /**
     * A hexagon lattice cannot tile a rectangle: it leaves notches between the
     * peaks along the top and bottom, and half hexagons down the sides.
     * clampTo() hands those pixels to the edge cell, so drawing runs one ring
     * wider than the grid and paints that ring in the edge cell's colour, with
     * the canvas clipping the overhang. What is painted is then what is
     * counted, which it would not be if the ring were left out.
     */
    function forEachDrawn(handle) {
        for (var x = -1; x <= grid_block_number_x + 1; x++) {
            for (var y = -1; y <= grid_block_number_y + 1; y++) {
                handle(x, y, clampTo({ x: x, y: y }, grid_block_number_x, grid_block_number_y));
            }
        }
    }

    /**
     * The outlines on their own. Like the square drawBoard() these end up
     * under the aerial image, and are what an imagery failure still leaves
     * looking like a grid.
     */
    function drawBoard(ctx) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        forEachDrawn(function(x, y) {
            trace(ctx, x, y);
        });
        ctx.stroke();
    }

    /**
     * The image, then every cell: its tool's colour where it is painted, the
     * eraser's wash where it is not. The square grid leaves its gridlines by
     * insetting each rectangle a pixel; a hexagon has no axis to inset along,
     * so each one is stroked instead.
     */
    function drawGrid(ctx) {
        ctx.drawImage(background_img, 0, 0, background_img.width, background_img.height);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        forEachDrawn(function(x, y, cell) {
            var painted = grid[cell.x][cell.y];
            ctx.beginPath();
            trace(ctx, x, y);
            ctx.fillStyle = tools[painted != null ? painted : tools_keys[erase_key]].color;
            ctx.fill();
            ctx.stroke();
        });
    }

    /** Paints, or erases, the cell under the pointer. */
    function toggleGrid(e) {
        var pos = getMousePos(e);
        if (pos.x < 0 || pos.y < 0 || pos.x >= grid_width || pos.y >= grid_height) {
            return;
        }
        var cell = clampTo(cellAt(grid_block_size, pos.x, pos.y), grid_block_number_x, grid_block_number_y);
        grid[cell.x][cell.y] = (selected_tool == tools_keys[erase_key]) ? null : selected_tool;
    }

    /* ---- OpenStreetMap prefill --------------------------------------- *
     * The square version reads a tool's mask a pixel at a time and works out
     * the square from two divisions. A hexagon costs a rounding step per
     * pixel, which would be paid once per tool, so the pixel -> cell answer is
     * worked out once and reused by all seven. The same pass counts how many
     * pixels each cell actually has, which is what the coverage threshold has
     * to be measured against: cells along the canvas edge are cut short, and
     * on a hexagon grid they are cut short in six directions rather than two.
     * ------------------------------------------------------------------ */

    var pixel_map = null;

    function map(size) {
        var key = size + ':' + grid_block_size + ':' + grid_block_number_x + ':' + grid_block_number_y;
        if (pixel_map && pixel_map.key === key) {
            return pixel_map;
        }
        var stride = grid_block_number_x + 1;
        var cells = new Int32Array(size * size);
        var area = new Int32Array(stride * (grid_block_number_y + 1));
        var i = 0;
        for (var py = 0; py < size; py++) {
            for (var px = 0; px < size; px++) {
                var cell = clampTo(
                    cellAt(grid_block_size, px + 0.5, py + 0.5),
                    grid_block_number_x,
                    grid_block_number_y
                );
                var flat = cell.y * stride + cell.x;
                cells[i] = flat;
                area[flat]++;
                i++;
            }
        }
        pixel_map = { key: key, cells: cells, area: area };
        return pixel_map;
    }

    /** Adds this mask's covered pixels to counts, keyed by flat cell index. */
    function countCoverage(pixels, size, counts) {
        var cells = map(size).cells;
        for (var i = 0, alpha = 3; i < cells.length; i++, alpha += 4) {
            if (pixels[alpha] > 128) {
                counts[cells[i]] = (counts[cells[i]] || 0) + 1;
            }
        }
    }

    /** How many canvas pixels this cell has, edge clipping included. */
    function cellArea(x, y, size) {
        return map(size).area[y * (grid_block_number_x + 1) + x] || 0;
    }

    /* ---- wiring ------------------------------------------------------ */

    var box = byId('hexgrid');
    if (box) {
        box.addEventListener('change', function() {
            // by now the box holds the new answer, so the grid on screen is
            // still laid out the other way
            rebuild(!box.checked, grid_block_size);
        });
        // some browsers put a ticked box back on reload, after the square grid
        // has already been built by initialize()
        if (box.checked) {
            rebuild(false, grid_block_size);
        }
    }

    return {
        active: active,
        setCounts: setCounts,
        rebuild: rebuild,
        drawBoard: drawBoard,
        drawGrid: drawGrid,
        toggleGrid: toggleGrid,
        countCoverage: countCoverage,
        cellArea: cellArea
    };
})();
