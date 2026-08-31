/**
 * OpenStreetMap prefill for The Arrogance of Space Mapping Tool.
 *
 * Loads aerial imagery for a place, asks OpenStreetMap what is actually there,
 * and pre-fills the grid so the user starts from a draft instead of a blank map.
 *
 * OSM ways are rasterized onto off-screen masks and then sampled per grid block:
 * the output is squares only, exactly like hand painting. No polygon or line
 * geometry is kept once the grid is filled.
 */

/*
 * Everything below is read from classification.json, inlined into the page by
 * index.php and read from disk by php/src/Classifier.php - one file, two
 * readers. The names are kept so the rest of this file is unchanged.
 */
var DEFAULT_ZOOM = CLASSIFICATION.zoom.default;
var MIN_ZOOM = CLASSIFICATION.zoom.min;
var MAX_ZOOM = CLASSIFICATION.zoom.max;
var map_attribution = '';
// the last title this tool filled in, so a user's own title is never overwritten
var auto_title = '';

var LANE_WIDTH = CLASSIFICATION.widths_metres.lane;
var SIDEWALK_WIDTH = CLASSIFICATION.widths_metres.sidewalk;
var CYCLE_LANE_WIDTH = CLASSIFICATION.widths_metres.cycle_lane;
var PARKING_LANE_WIDTH = CLASSIFICATION.widths_metres.parking_lane;

var TARGET_BLOCK_METRES = CLASSIFICATION.grid.target_block_metres;
var MIN_BLOCK_SIZE = CLASSIFICATION.grid.min_block_size;
var MAX_BLOCK_SIZE = CLASSIFICATION.grid.max_block_size;
var COVERAGE_THRESHOLD = CLASSIFICATION.grid.coverage_threshold;

var DEFAULT_LANES = CLASSIFICATION.default_lanes;
var OSM_PRIORITY = CLASSIFICATION.priority;

/* ------------------------------------------------------------------ *
 * Web Mercator
 * ------------------------------------------------------------------ */

function lonToPx(lon, zoom) {
    return (lon + 180) / 360 * 256 * Math.pow(2, zoom);
}

function latToPx(lat, zoom) {
    var sin = Math.sin(lat * Math.PI / 180);
    return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * 256 * Math.pow(2, zoom);
}

function pxToLon(px, zoom) {
    return px / (256 * Math.pow(2, zoom)) * 360 - 180;
}

function pxToLat(py, zoom) {
    var n = Math.PI - 2 * Math.PI * py / (256 * Math.pow(2, zoom));
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/**
 * The grid block size, in canvas pixels, that comes closest to
 * TARGET_BLOCK_METRES on the ground at this zoom and latitude. Without this
 * the block size is a bare pixel count, so the same 40 px square is 8 m across
 * at zoom 19 and 128 m across at zoom 15.
 */
function showBlockScale() {
    var hint = byId('blockscale');
    if (!hint) {
        return;
    }
    if (!map_view) {
        hint.textContent = '';
        return;
    }
    // while framing, the block size the map is about to get; after that, the
    // one actually in the box, which the user is free to have changed
    var blocks = framing ? blockSizeForZoom(viewCentre().lat, map_view.zoom) : byId('gridblocksize').value * 1;
    var metres = blocks * metresPerPixel(viewCentre().lat, map_view.zoom);
    hint.textContent = metres >= 10
        ? 'Each square is about ' + Math.round(metres) + ' m across.'
        : 'Each square is about ' + metres.toFixed(1) + ' m across.';
}

function blockSizeForZoom(lat, zoom) {
    var blocks = Math.round(TARGET_BLOCK_METRES / metresPerPixel(lat, zoom));
    return Math.max(MIN_BLOCK_SIZE, Math.min(MAX_BLOCK_SIZE, blocks));
}

function metresPerPixel(lat, zoom) {
    return 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
}


/* ------------------------------------------------------------------ *
 * Classification: OSM tags -> tool
 * ------------------------------------------------------------------ */

var GREEN_LANDUSE = CLASSIFICATION.green.landuse;
var GREEN_LEISURE = CLASSIFICATION.green.leisure;
var GREEN_NATURAL = CLASSIFICATION.green.natural;
var NATURAL_SURFACES = CLASSIFICATION.natural_surfaces;
var WATERWAY_WIDTH = CLASSIFICATION.waterway_width;
var PED_HIGHWAY = CLASSIFICATION.pedestrian_highway;
var PT_RAILWAY = CLASSIFICATION.public_transport.railway;
var PT_HIGHWAY = CLASSIFICATION.public_transport.highway;
var PT_AERIALWAY = CLASSIFICATION.public_transport.aerialway;
var CYCLE_VALUES = CLASSIFICATION.cycle_values;

function tagNumber(value) {
    var n = parseFloat(value);
    return isNaN(n) ? null : n;
}

/**
 * Returns the drawing instructions for one OSM way, or null to ignore it.
 * Areas get {tool, area: true}; linear features get {tool, width} in metres,
 * plus optional side strips for sidewalks, cycle lanes and parking lanes.
 */
/**
 * Bus lanes from busway=lane and its side variants. no, separate and none are
 * excluded by whitelisting the values that mean a lane exists. Only busway:both
 * states two sides - a bare busway=lane says a lane exists without saying which
 * side, unlike cycleway=lane where both sides is the convention.
 */
/**
 * A tagged width, or the fallback.
 *
 * OSM's convention is that the width of anything tagged under a key is that key
 * plus ':width', so sidewalk:left is measured by sidewalk:left:width and
 * parking:right by parking:right:width. The base key's ':width' is the generic
 * fallback. A mapper who measured something should not have that measurement
 * thrown away for a default.
 */
function taggedWidth(tags, key, base, fallback) {
    var width = tagNumber(tags[key + ':width']);
    if (!width && base !== key) {
        width = tagNumber(tags[base + ':width']);
    }
    return width || fallback;
}

/** width on the way itself, or the fallback. */
function wayWidth(tags, fallback) {
    return tagNumber(tags.width) || fallback;
}

function buswayLaneSides(tags) {
    var sides = 0;
    CLASSIFICATION.public_transport.busway_keys.forEach(function(key) {
        if (CLASSIFICATION.public_transport.busway_lane_values.indexOf(tags[key]) !== -1) {
            sides += (key === 'busway:both') ? 2 : 1;
        }
    });
    return sides;
}

/**
 * Bus lanes from the modern tagging: lanes:psv=1, or a per-lane list such as
 * bus:lanes=no|no|designated. This is how bus lanes on ordinary streets are
 * usually mapped now, and without it they were counted as car space.
 */
function psvLaneCount(tags) {
    var counted = 0;
    CLASSIFICATION.public_transport.psv_lane_count_keys.forEach(function(key) {
        var number = tagNumber(tags[key]);
        if (number) {
            counted += number;
        }
    });
    var listed = 0;
    CLASSIFICATION.public_transport.psv_lane_list_keys.forEach(function(key) {
        if (!tags[key]) {
            return;
        }
        tags[key].split('|').forEach(function(lane) {
            if (lane.trim() === 'designated') {
                listed++;
            }
        });
    });
    return Math.max(counted, listed);
}

function classifyWay(tags, is_closed) {
    if (!tags) {
        return null;
    }

    // Anything below is a polygon in OSM. An open way carrying these tags is
    // either linear by nature (a river, a tree row) or broken data: filling it
    // would paint a wedge between its endpoints, so it is drawn as a line or
    // skipped instead.
    if (tags.building || tags['building:part']) {
        return is_closed ? { tool: 'buildings', area: true } : null;
    }

    if (tags.amenity === 'parking' || tags.parking === 'surface') {
        return is_closed ? { tool: 'cars', area: true } : null;
    }

    if (tags.waterway) {
        if (is_closed || tags.waterway === 'riverbank') {
            return { tool: 'dead_space', area: true };
        }
        return { tool: 'dead_space', width: tagNumber(tags.width) || WATERWAY_WIDTH[tags.waterway] || 3.0 };
    }

    if (tags.natural === 'water' || tags.landuse === 'reservoir') {
        return is_closed ? { tool: 'dead_space', area: true } : null;
    }

    if (tags.natural === 'tree_row') {
        return { tool: 'green', width: wayWidth(tags, 2.0) };
    }

    // A playground is only green if its ground is. Plenty are asphalt, rubber
    // or artificial turf, and painting those green would credit the city with
    // greenery it has not got. Where surface is missing the answer is genuinely
    // unknown, so the square is left unpainted rather than guessed.
    if (tags.leisure === 'playground') {
        return (is_closed && NATURAL_SURFACES.indexOf(tags.surface) !== -1) ? { tool: 'green', area: true } : null;
    }

    if (GREEN_LANDUSE.indexOf(tags.landuse) !== -1 ||
        GREEN_LEISURE.indexOf(tags.leisure) !== -1 ||
        GREEN_NATURAL.indexOf(tags.natural) !== -1) {
        return is_closed ? { tool: 'green', area: true } : null;
    }

    if (PT_RAILWAY.indexOf(tags.railway) !== -1) {
        return { tool: 'publictransport', width: wayWidth(tags, 3.0) };
    }

    if (PT_AERIALWAY.indexOf(tags.aerialway) !== -1) {
        return { tool: 'publictransport', width: wayWidth(tags, 3.0) };
    }

    var highway = tags.highway;
    if (!highway) {
        return null;
    }

    // A whole way given over to public transport. busway=* is NOT here: that
    // tags a bus lane *within* an ordinary street, and treating it as a bus-only
    // road deleted the street's car space entirely. It is counted as a lane
    // further down instead. The old test also used bare truthiness, so
    // busway=no - a road explicitly without a bus lane - was painted as one.
    if (PT_HIGHWAY.indexOf(highway) !== -1 || tags.psv === 'designated') {
        return { tool: 'publictransport', width: wayWidth(tags, 3.5) };
    }

    if (highway === 'cycleway') {
        return { tool: 'cyclists', width: tagNumber(tags.width) || 2.0 };
    }

    if (PED_HIGHWAY.indexOf(highway) !== -1) {
        if (is_closed && (tags.area === 'yes' || highway === 'pedestrian')) {
            return { tool: 'pedestrians', area: true };
        }
        return { tool: 'pedestrians', width: tagNumber(tags.width) || (highway === 'pedestrian' ? 6.0 : 2.0) };
    }

    if (DEFAULT_LANES[highway] === undefined) {
        return null;
    }

    // a motor carriageway: width from tags where possible, lanes otherwise
    var lanes = tagNumber(tags.lanes) || DEFAULT_LANES[highway];
    var width = tagNumber(tags.width) || lanes * LANE_WIDTH;

    // on-street parking widens the space given to cars
    var parking_width = 0;
    CLASSIFICATION.parking_keys.forEach(function(key) {
        var value = tags[key];
        if (value && value !== 'no' && value !== 'separate') {
            var sides = (key.indexOf('both') !== -1) ? 2 : 1;
            parking_width += sides * taggedWidth(tags, key, 'parking', PARKING_LANE_WIDTH);
        }
    });
    width = width + parking_width;

    var result = { tool: 'cars', width: width, strips: [] };

    // Total metres of footway beside the carriageway, not a count of sides: a
    // measured sidewalk:left:width=4 is worth using, and the tool already
    // honours width on carriageways and cycleways. Ignoring it here undercounted
    // pedestrian space wherever a mapper had measured it, which inflates the car
    // share - the direction that flatters this tool's own argument.
    var sidewalk = tags.sidewalk;
    var sidewalk_width = 0;
    if (sidewalk === 'both' || sidewalk === 'yes' || tags['sidewalk:both'] === 'yes') {
        sidewalk_width = 2 * taggedWidth(tags, 'sidewalk:both', 'sidewalk', SIDEWALK_WIDTH);
    } else if (sidewalk === 'left' || sidewalk === 'right') {
        sidewalk_width = taggedWidth(tags, 'sidewalk:' + sidewalk, 'sidewalk', SIDEWALK_WIDTH);
    } else {
        ['left', 'right'].forEach(function(side) {
            if (tags['sidewalk:' + side] === 'yes') {
                sidewalk_width += taggedWidth(tags, 'sidewalk:' + side, 'sidewalk', SIDEWALK_WIDTH);
            }
        });
    }
    var cycle_sides = 0;
    var cycle_width = 0;
    var busway_sides = 0;
    CLASSIFICATION.cycleway_keys.forEach(function(key) {
        var value = tags[key];
        if (!value) {
            return;
        }
        var sides = (key === 'cycleway' || key === 'cycleway:both') ? 2 : 1;
        if (CYCLE_VALUES.indexOf(value) !== -1) {
            cycle_sides += sides;
            cycle_width += sides * taggedWidth(tags, key, 'cycleway', CYCLE_LANE_WIDTH);
        } else if (value === 'share_busway') {
            busway_sides += sides;
        }
    });

    // A bus lane is part of the carriageway rather than extra width beside it,
    // so it is drawn narrower than the road and takes its area from the
    // carriageway by priority instead of widening the street. The two tagging
    // families describe the same thing, so the larger is taken rather than the
    // sum: busway=lane plus lanes:psv=1 is one bus lane, not two.
    var bus_lanes = Math.max(busway_sides + buswayLaneSides(tags), psvLaneCount(tags));
    // A street cannot be all bus lane and still be a street: if every lane were
    // reserved it would carry psv=designated or highway=busway, handled above.
    if (bus_lanes > 0) {
        bus_lanes = Math.min(bus_lanes, Math.max(1, lanes - 1));
        result.strips.push({ tool: 'publictransport', width: Math.min(width, bus_lanes * LANE_WIDTH) });
    }
    // Strips are drawn as full-width bands and the narrower, higher priority
    // bands are subtracted later, leaving each one as a ring beside the
    // carriageway. Order outwards from the centre: carriageway, cycle, footway.
    var cycle_band = width + cycle_width;
    if (cycle_sides > 0) {
        result.strips.push({ tool: 'cyclists', width: cycle_band });
    }
    if (sidewalk_width > 0) {
        result.strips.push({ tool: 'pedestrians', width: cycle_band + sidewalk_width });
    }

    return result;
}


/* ------------------------------------------------------------------ *
 * Progress
 * ------------------------------------------------------------------ */

var NOMINATIM_TIMEOUT = 15000;
var OVERPASS_TIMEOUT = 45000;   // above the server's own [timeout:30]
var TILE_TIMEOUT = 10000;
var HINT_DELAY = 15000;

var pending_requests = [];
var cancelled = false;
var hint_timer = null;

/** An error the pipeline recognises as "the user asked us to stop". */
function cancelledError() {
    var error = new Error('cancelled');
    error.cancelled = true;
    return error;
}

/** Throws if the user pressed Cancel, so a pipeline stops between steps. */
function checkCancelled() {
    if (cancelled) {
        throw cancelledError();
    }
}

/** fetch() that gives up after ms, and that Cancel can abort. */
function fetchWithTimeout(url, options, ms) {
    var controller = new AbortController();
    pending_requests.push(controller);
    var timer = window.setTimeout(function() {
        controller.timed_out = true;
        controller.abort();
    }, ms);

    options = options || {};
    options.signal = controller.signal;

    var settled = function() {
        window.clearTimeout(timer);
        var at = pending_requests.indexOf(controller);
        if (at !== -1) {
            pending_requests.splice(at, 1);
        }
    };

    return fetch(url, options).then(function(response) {
        settled();
        return response;
    }, function(error) {
        settled();
        if (cancelled) {
            throw cancelledError();
        }
        if (controller.timed_out) {
            var timeout_error = new Error('timed out');
            timeout_error.timed_out = true;
            throw timeout_error;
        }
        throw error;
    });
}

/** Stops everything in flight and unwinds to a usable state. */
function cancelOsm() {
    cancelled = true;
    pending_requests.forEach(function(controller) {
        controller.abort();
    });
    pending_requests = [];
}

/** After a while, reassure the user rather than leaving them guessing. */
function startWaitHint(message) {
    stopWaitHint();
    hint_timer = window.setTimeout(function() {
        var help = byId('modalhelp');
        help.textContent = message;
        help.removeAttribute('hidden');
    }, HINT_DELAY);
}

function stopWaitHint() {
    if (hint_timer) {
        window.clearTimeout(hint_timer);
        hint_timer = null;
    }
    var help = byId('modalhelp');
    help.setAttribute('hidden', 'hidden');
    help.textContent = '';
}

/** Updates the modal: headline stage, detail line and bar position (0-1). */
function osmProgress(status, step, fraction) {
    if (status !== null) {
        byId('modalstatus').textContent = status;
    }
    byId('modalstep').textContent = step || '';
    if (fraction !== undefined && fraction !== null) {
        byId('progressbar').style.width = Math.round(fraction * 100) + '%';
    }
}

/** Puts the modal back to its resting state for the next use. */
function resetProgress() {
    osmProgress('Please wait...', '', 0);
    stopWaitHint();
    cancelled = false;
    pending_requests = [];
}

/** Lets the browser paint before the next synchronous chunk of work. */
function yieldFrame() {
    return new Promise(function(resolve, reject) {
        window.requestAnimationFrame(function() {
            window.setTimeout(function() {
                if (cancelled) {
                    reject(cancelledError());
                    return;
                }
                resolve();
            }, 0);
        });
    });
}


/* ------------------------------------------------------------------ *
 * Loading
 * ------------------------------------------------------------------ */

/**
 * Images cannot be aborted like fetch, so a stalled tile is abandoned on a
 * timer. Resolves null instead of rejecting: one blank tile is not a failure.
 */
function loadImagePromise(src) {
    return new Promise(function(resolve) {
        var image = new Image();
        var timer = window.setTimeout(function() {
            image.src = '';
            resolve(null);
        }, TILE_TIMEOUT);
        var finish = function(result) {
            window.clearTimeout(timer);
            resolve(result);
        };
        image.crossOrigin = 'anonymous';
        image.onload = function() { finish(image); };
        image.onerror = function() { finish(null); };
        image.src = src;
    });
}

function geocodePlace(query) {
    var coords = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coords) {
        return Promise.resolve({ lat: parseFloat(coords[1]), lon: parseFloat(coords[2]) });
    }
    return fetchWithTimeout('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(query), null, NOMINATIM_TIMEOUT)
        .then(function(response) { return response.json(); })
        .then(function(results) {
            if (!results.length) {
                throw new Error('Place not found: ' + query);
            }
            return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
        });
}

/** Composes Esri World Imagery tiles into a single square image. */
function loadImagery(left, top, size, zoom) {
    var tile_canvas = document.createElement('canvas');
    tile_canvas.width = size;
    tile_canvas.height = size;
    var tile_context = tile_canvas.getContext('2d');

    var first_x = Math.floor(left / 256);
    var last_x = Math.floor((left + size) / 256);
    var first_y = Math.floor(top / 256);
    var last_y = Math.floor((top + size) / 256);

    var loads = [];
    var total = (last_x - first_x + 1) * (last_y - first_y + 1);
    var done = 0;
    for (var tx = first_x; tx <= last_x; tx++) {
        for (var ty = first_y; ty <= last_y; ty++) {
            (function(tx, ty) {
                var url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + zoom + '/' + ty + '/' + tx;
                loads.push(loadImagePromise(url).then(function(image) {
                    if (image) {
                        tile_context.drawImage(image, tx * 256 - left, ty * 256 - top);
                    }
                }).then(function() {
                    done++;
                    osmProgress(null, 'aerial tile ' + done + ' of ' + total, 0.10 + 0.35 * (done / total));
                }));
            })(tx, ty);
        }
    }

    return Promise.all(loads).then(function() {
        try {
            return tile_canvas.toDataURL('image/png');
        } catch (e) {
            // imagery server refused CORS, so the canvas is tainted and could
            // never be saved: carry on with OSM colours over a blank background
            return null;
        }
    });
}

// the public query servers are shared and frequently overloaded, so fall back
var OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
];

/** Turns an Overpass HTTP status into something a mapper can act on. */
function overpassError(status) {
    if (status === 504 || status === 502 || status === 503) {
        return 'The OpenStreetMap query servers are busy and timed out (error ' + status + ').\n\n' +
            'These are free, shared servers and this happens regularly - it is not a problem with your map or this tool.\n\n' +
            'What helps:\n' +
            '- wait a minute and try again\n' +
            '- choose a smaller area under Detail (Intersection or Close up)\n' +
            '- upload an image instead and paint it by hand';
    }
    if (status === 429) {
        return 'Too many requests were sent to the OpenStreetMap query servers (error 429).\n\n' +
            'They limit how often one visitor may ask. Wait a minute before trying again.';
    }
    if (status === 400) {
        return 'The OpenStreetMap query servers rejected the query (error 400).\n\n' +
            'This is a bug in the tool rather than something you did - please report it.';
    }
    return 'The OpenStreetMap query servers returned error ' + status + '.\n\nTry again in a minute, or upload an image instead.';
}

function fetchOsm(south, west, north, east) {
    var bbox = south + ',' + west + ',' + north + ',' + east;
    var query = '[out:json][timeout:30];(' +
        CLASSIFICATION.overpass_selectors.map(function(selector) {
            return selector + '(' + bbox + ');';
        }).join('') +
        ');out geom;';

    var attempt = function(index) {
        var is_last = (index + 1 >= OVERPASS_ENDPOINTS.length);
        return fetchWithTimeout(OVERPASS_ENDPOINTS[index], {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query)
        }, OVERPASS_TIMEOUT).then(function(response) {
            if (!response.ok) {
                // a rejected query fails the same way everywhere, so do not retry it
                if (!is_last && response.status !== 400) {
                    osmProgress(null, 'server busy, trying mirror ' + (index + 2) + ' of ' + OVERPASS_ENDPOINTS.length, null);
                    return attempt(index + 1);
                }
                throw new Error(overpassError(response.status));
            }
            return response.json();
        }, function(error) {
            if (error.cancelled) {
                throw error;
            }
            if (!is_last) {
                osmProgress(null, (error.timed_out ? 'took too long' : 'no answer') +
                    ', trying mirror ' + (index + 2) + ' of ' + OVERPASS_ENDPOINTS.length, null);
                return attempt(index + 1);
            }
            if (error.timed_out) {
                throw new Error('The OpenStreetMap query servers did not answer in time.\n\n' +
                    'They are free and shared, and get busy. Try again in a minute, choose a smaller ' +
                    'area under zoom, or use the map as an image and paint it by hand.');
            }
            throw new Error('Could not reach the OpenStreetMap query servers.\n\n' +
                'Check your internet connection, or upload an image instead and paint it by hand.');
        });
    };
    return attempt(0);
}


/* ------------------------------------------------------------------ *
 * Rasterizing: vectors in, squares out
 * ------------------------------------------------------------------ */

/**
 * Draws every OSM way onto one mask per tool, makes the masks disjoint by
 * priority, then fills each grid square with whichever tool covers most of it.
 */
async function fillGridFromOsm(elements, left, top, size, zoom, centre_lat) {
    var metres = metresPerPixel(centre_lat, zoom);
    osmProgress('Sorting map data...', (elements.length) + ' map features', 0.55);
    await yieldFrame();

    // collect drawing operations per tool
    var operations = {};
    OSM_PRIORITY.forEach(function(tool) { operations[tool] = []; });

    var toPixels = function(geometry) {
        var points = [];
        for (var i = 0; i < geometry.length; i++) {
            if (geometry[i]) {
                points.push([lonToPx(geometry[i].lon, zoom) - left, latToPx(geometry[i].lat, zoom) - top]);
            }
        }
        return points;
    };
    var isClosed = function(points) {
        var first = points[0];
        var last = points[points.length - 1];
        return points.length > 3 && Math.abs(first[0] - last[0]) < 0.5 && Math.abs(first[1] - last[1]) < 0.5;
    };

    elements.forEach(function(element) {
        if (!element.tags) {
            return;
        }

        if (element.type === 'relation' && element.members) {
            // a multipolygon: every ring goes into one path so that inner rings
            // (courtyards, ponds inside a park) stay empty when filled even-odd
            var classified = classifyWay(element.tags, true);
            if (!classified || !classified.area) {
                return;
            }
            var rings = [];
            element.members.forEach(function(member) {
                if (member.type !== 'way' || !member.geometry) {
                    return;
                }
                if (member.role && member.role !== 'outer' && member.role !== 'inner') {
                    return;
                }
                var ring = toPixels(member.geometry);
                if (ring.length >= 3) {
                    rings.push(ring);
                }
            });
            if (rings.length) {
                operations[classified.tool].push({ rings: rings });
            }
            return;
        }

        if (element.type !== 'way' || !element.geometry) {
            return;
        }
        var points = toPixels(element.geometry);
        if (points.length < 2) {
            return;
        }

        var classified = classifyWay(element.tags, isClosed(points));
        if (!classified) {
            return;
        }

        if (classified.area) {
            operations[classified.tool].push({ rings: [points] });
        } else {
            (classified.strips || []).forEach(function(strip) {
                operations[strip.tool].push({ points: points, width: strip.width / metres });
            });
            operations[classified.tool].push({ points: points, width: classified.width / metres });
        }
    });

    // render one mask per tool, yielding so the bar can move between them
    var masks = {};
    for (var t = 0; t < OSM_PRIORITY.length; t++) {
        var tool = OSM_PRIORITY[t];
        osmProgress('Drawing map data...', tools[tool].desc, 0.60 + 0.20 * (t / OSM_PRIORITY.length));
        await yieldFrame();
        var mask = document.createElement('canvas');
        mask.width = size;
        mask.height = size;
        var mask_context = mask.getContext('2d');
        mask_context.fillStyle = '#000';
        mask_context.strokeStyle = '#000';
        mask_context.lineCap = 'round';
        mask_context.lineJoin = 'round';

        operations[tool].forEach(function(operation) {
            mask_context.beginPath();
            if (operation.rings) {
                operation.rings.forEach(function(ring) {
                    mask_context.moveTo(ring[0][0], ring[0][1]);
                    for (var i = 1; i < ring.length; i++) {
                        mask_context.lineTo(ring[i][0], ring[i][1]);
                    }
                    mask_context.closePath();
                });
                mask_context.fill('evenodd');
            } else {
                mask_context.moveTo(operation.points[0][0], operation.points[0][1]);
                for (var i = 1; i < operation.points.length; i++) {
                    mask_context.lineTo(operation.points[i][0], operation.points[i][1]);
                }
                mask_context.lineWidth = Math.max(1, operation.width);
                mask_context.stroke();
            }
        });
        masks[tool] = mask;
    }

    osmProgress('Separating overlaps...', 'roads, footways and cycle lanes', 0.80);
    await yieldFrame();

    // make the masks disjoint: each one loses whatever a higher priority claimed
    for (var i = 1; i < OSM_PRIORITY.length; i++) {
        var context_i = masks[OSM_PRIORITY[i]].getContext('2d');
        context_i.globalCompositeOperation = 'destination-out';
        for (var j = 0; j < i; j++) {
            context_i.drawImage(masks[OSM_PRIORITY[j]], 0, 0);
        }
        context_i.globalCompositeOperation = 'source-over';
    }

    // count how much of each square each tool covers
    var coverage = {};
    for (var c = 0; c < OSM_PRIORITY.length; c++) {
        var counted_tool = OSM_PRIORITY[c];
        osmProgress('Counting squares...', tools[counted_tool].desc, 0.85 + 0.13 * (c / OSM_PRIORITY.length));
        await yieldFrame();
        var counts = [];
        var pixels = masks[counted_tool].getContext('2d').getImageData(0, 0, size, size).data;
        for (var py = 0; py < size; py++) {
            var row = py * size * 4;
            var by = Math.floor(py / grid_block_size);
            for (var px = 0; px < size; px++) {
                if (pixels[row + px * 4 + 3] > 128) {
                    var counted_index = by * (grid_block_number_x + 1) + Math.floor(px / grid_block_size);
                    counts[counted_index] = (counts[counted_index] || 0) + 1;
                }
            }
        }
        coverage[counted_tool] = counts;
    }

    osmProgress('Filling squares...', null, 0.98);
    await yieldFrame();

    // fill each square with the tool covering most of it
    var filled = 0;
    for (var x = 0; x <= grid_block_number_x; x++) {
        // squares at the right and bottom edge are cut short by the canvas, so
        // they are judged against the area they actually have
        var block_width = Math.min(grid_block_size, size - x * grid_block_size);
        for (var y = 0; y <= grid_block_number_y; y++) {
            var block_height = Math.min(grid_block_size, size - y * grid_block_size);
            if (block_width <= 0 || block_height <= 0) {
                continue;
            }
            var minimum = block_width * block_height * COVERAGE_THRESHOLD;
            var index = y * (grid_block_number_x + 1) + x;
            var best_tool = null;
            var best_count = 0;
            for (var t = 0; t < OSM_PRIORITY.length; t++) {
                var count = coverage[OSM_PRIORITY[t]][index] || 0;
                if (count > best_count) {
                    best_count = count;
                    best_tool = OSM_PRIORITY[t];
                }
            }
            if (best_tool && best_count >= minimum) {
                grid[x][y] = best_tool;
                filled++;
            }
        }
    }
    return filled;
}


/* ------------------------------------------------------------------ *
 * Step 1: find and frame. Step 2: prefill.
 *
 * Framing only moves aerial imagery around, which is cheap and cached. Nothing
 * is painted and nothing can be lost until the view is accepted, so the slow,
 * failure-prone OpenStreetMap query runs exactly once, on a view the user has
 * already confirmed.
 * ------------------------------------------------------------------ */

var framing = false;
var map_view = null;    // {left, top, size, zoom} in Web Mercator pixels
var drag_start = null;

/** True if there is anything the user would be sad to lose. */
function gridHasPaint() {
    if (typeof markers !== 'undefined' && markers.length) {
        return true;
    }
    if (!grid || !grid.length) {
        return false;
    }
    for (var x = 0; x < grid.length; x++) {
        for (var y = 0; y < grid[x].length; y++) {
            if (grid[x][y] != null) {
                return true;
            }
        }
    }
    return false;
}

function viewCentre() {
    return {
        lat: pxToLat(map_view.top + map_view.size / 2, map_view.zoom),
        lon: pxToLon(map_view.left + map_view.size / 2, map_view.zoom)
    };
}

/** Imagery only, no grid: this is what the framing step shows. */
function drawPreview(offset_x, offset_y) {
    var size = map_view.size;
    context.clearRect(0, 0, size, size);
    context.fillStyle = '#eee';
    context.fillRect(0, 0, size, size);
    if (background_img && background_img.width) {
        context.drawImage(background_img, offset_x || 0, offset_y || 0);
    }
    // centre crosshair, so the user can aim at an intersection
    context.beginPath();
    context.strokeStyle = 'rgba(255,255,255,0.9)';
    context.lineWidth = 1;
    context.moveTo(size / 2 - 12, size / 2);
    context.lineTo(size / 2 + 12, size / 2);
    context.moveTo(size / 2, size / 2 - 12);
    context.lineTo(size / 2, size / 2 + 12);
    context.stroke();
}

/** Rebuilds the imagery for the current view and redraws the preview. */
function composeView() {
    return loadImagery(map_view.left, map_view.top, map_view.size, map_view.zoom).then(function(imagery) {
        return new Promise(function(resolve) {
            var image = new Image();
            image.onload = function() { background_img = image; resolve(); };
            image.onerror = function() { resolve(); };
            if (!imagery) {
                background_img = new Image();
                resolve();
                return;
            }
            image.src = imagery;
        });
    }).then(function() {
        drawPreview(0, 0);
        var across = Math.round(map_view.size * metresPerPixel(viewCentre().lat, map_view.zoom));
        byId('zoomlevel').textContent = 'zoom ' + map_view.zoom + ', about ' + across + ' m across';
        showBlockScale();
    });
}

/** Brings the map and the status overlay into view before a long step. */
function scrollToCanvas() {
    var editor = byId('editor');
    if (editor) {
        var top = editor.getBoundingClientRect().top + window.pageYOffset - 10;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
}

/** Every new search starts a new map, so the title starts again with it. */
function setTitleFromPlace(place) {
    var named = place.charAt(0).toUpperCase() + place.slice(1);
    auto_title = 'The Arrogance of Space - ' + named;
    byId('title').value = auto_title;
}

/* ---- step 1: find and frame ---------------------------------------- */

function findPlace() {
    var place = byId('osmplace').value;
    if (!place || !place.trim()) {
        window.alert('Enter a place name or "latitude, longitude" first.');
        return;
    }
    if (gridHasPaint() && !window.confirm('Loading a new map will erase everything you have painted so far. Continue?')) {
        return;
    }

    scrollToCanvas();
    cancelled = false;
    osmProgress('Finding the place...', place.trim(), 0.02);
    startWaitHint('Still looking. The search and imagery servers are free and shared, so they are sometimes slow. ' +
        'You can keep waiting, or cancel and upload your own photo instead.');
    fadeIn(byId('modal'));

    geocodePlace(place.trim()).then(function(result) {
        checkCancelled();
        var size = editorSize();
        map_view = {
            size: size,
            zoom: DEFAULT_ZOOM,
            left: lonToPx(result.lon, DEFAULT_ZOOM) - size / 2,
            top: latToPx(result.lat, DEFAULT_ZOOM) - size / 2
        };
        setTitleFromPlace(place.trim());

        framing = true;
        grid = [];
        markers = [];
        grid_width = size;
        grid_height = size;
        canvas.width = size;
        canvas.height = size;
        byId('framing').removeAttribute('hidden');
        osmProgress('Loading aerial imagery...', null, 0.10);
        return composeView();
    }).then(function() {
        checkCancelled();
        fadeOut(byId('modal'), resetProgress);
    }).catch(function(error) {
        framing = false;
        byId('framing').setAttribute('hidden', 'hidden');
        fadeOut(byId('modal'), resetProgress);
        if (!error.cancelled) {
            window.alert(error.message);
        }
    });
}

function zoomBy(delta) {
    if (!framing) {
        return;
    }
    var zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, map_view.zoom + delta));
    if (zoom === map_view.zoom) {
        return;
    }
    var centre = viewCentre();
    map_view.zoom = zoom;
    map_view.left = lonToPx(centre.lon, zoom) - map_view.size / 2;
    map_view.top = latToPx(centre.lat, zoom) - map_view.size / 2;
    composeView();
}

/* ---- step 2: accept the view, optionally prefill -------------------- */

function useView(prefill) {
    if (!map_view) {
        return;
    }
    framing = false;
    drag_start = null;
    byId('framing').setAttribute('hidden', 'hidden');

    grid_width = map_view.size;
    grid_height = map_view.size;
    byId('gridblocksize').value = blockSizeForZoom(viewCentre().lat, map_view.zoom);
    prev_grid_block_size = byId('gridblocksize').value * 1;
    showBlockScale();
    context.beginPath();
    context.clearRect(0, 0, grid_width, grid_height);
    setup();

    map_attribution = 'Imagery: Esri';
    if (!prefill) {
        byId('imagedetails').textContent = 'Map loaded. Paint the squares yourself.';
        draw();
        return;
    }

    map_attribution = map_attribution + '. Map data: OpenStreetMap contributors (ODbL)';
    scrollToCanvas();
    cancelled = false;
    osmProgress('Reading OpenStreetMap...', 'asking the query servers', 0.50);
    startWaitHint('Still working. The OpenStreetMap query servers are free and shared, and busy times can take a while. ' +
        'You can keep waiting, or cancel and paint the map yourself - the map stays loaded either way.');
    fadeIn(byId('modal'));

    var centre = viewCentre();
    var south = pxToLat(map_view.top + map_view.size, map_view.zoom);
    var north = pxToLat(map_view.top, map_view.zoom);
    var west = pxToLon(map_view.left, map_view.zoom);
    var east = pxToLon(map_view.left + map_view.size, map_view.zoom);

    fetchOsm(south, west, north, east).then(function(data) {
        return fillGridFromOsm(data.elements || [], map_view.left, map_view.top, map_view.size, map_view.zoom, centre.lat);
    }).then(function(filled) {
        byId('imagedetails').textContent = 'OpenStreetMap filled ' + filled + ' squares. Please check and correct them.';
        draw();
        osmProgress('Done', null, 1);
        fadeOut(byId('modal'), resetProgress);
    }).catch(function(error) {
        // the map is already loaded, so the user can still paint it by hand
        draw();
        fadeOut(byId('modal'), resetProgress);
        if (error.cancelled) {
            byId('imagedetails').textContent = 'Prefill cancelled. The map is loaded - paint the squares yourself.';
            map_attribution = 'Imagery: Esri';
            return;
        }
        window.alert(error.message);
    });
}

/* ---- framing interaction ------------------------------------------- */

canvas.addEventListener('mousedown', function(e) {
    if (!framing) {
        return;
    }
    drag_start = { x: e.clientX, y: e.clientY };
    e.preventDefault();
});

document.addEventListener('mousemove', function(e) {
    if (framing && drag_start) {
        var scale = canvasScale();
        drawPreview((e.clientX - drag_start.x) * scale.x, (e.clientY - drag_start.y) * scale.y);
    }
});

document.addEventListener('mouseup', function(e) {
    if (!framing || !drag_start) {
        return;
    }
    var scale = canvasScale();
    var moved_x = (e.clientX - drag_start.x) * scale.x;
    var moved_y = (e.clientY - drag_start.y) * scale.y;
    drag_start = null;
    if (moved_x === 0 && moved_y === 0) {
        return;
    }
    map_view.left = map_view.left - moved_x;
    map_view.top = map_view.top - moved_y;
    composeView();
});

canvas.addEventListener('wheel', function(e) {
    if (!framing) {
        return;
    }
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1 : -1);
});

onClick('#modalcancel', function(e) {
    e.preventDefault();
    osmProgress('Stopping...', '', null);
    stopWaitHint();
    cancelOsm();
});

onClick('#osmfind', function(e) {
    e.preventDefault();
    findPlace();
});

// Enter in the place field searches, which is what typing a place name and
// hitting return obviously ought to do. A global handler in arrogance.js
// already swallows Enter on every input to stop the form navigating away, so
// without this the key does nothing at all here.
byId('osmplace').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        findPlace();
    }
});

onClick('#zoomin', function(e) {
    e.preventDefault();
    zoomBy(1);
});

onClick('#zoomout', function(e) {
    e.preventDefault();
    zoomBy(-1);
});

onClick('#osmprefill', function(e) {
    e.preventDefault();
    useView(true);
});

onClick('#osmplain', function(e) {
    e.preventDefault();
    useView(false);
});
