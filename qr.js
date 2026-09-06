/**
 * A QR code, small and dependency-free.
 *
 * Byte mode, error correction M, versions 1 to 10 - which is everything a URL
 * needs and nothing else. There is no build step in this project and no
 * package manager, so this is written out rather than pulled in, the same way
 * the classification tables are.
 *
 * QrCode.matrix(text) returns an array of rows of 0/1, no quiet zone, or null
 * if the text is too long for version 10. Drawing it is the caller's business.
 */
var QrCode = (function() {

    /* ---- GF(256), the arithmetic Reed-Solomon runs on ----------------- */

    var EXP = new Array(512);
    var LOG = new Array(256);
    (function() {
        var x = 1;
        for (var i = 0; i < 255; i++) {
            EXP[i] = x;
            LOG[x] = i;
            x <<= 1;
            if (x & 0x100) {
                x ^= 0x11d; // the QR field polynomial
            }
        }
        for (var j = 255; j < 512; j++) {
            EXP[j] = EXP[j - 255];
        }
    })();

    function mul(a, b) {
        return (a && b) ? EXP[LOG[a] + LOG[b]] : 0;
    }

    /** The generator polynomial for n error correction codewords. */
    function generator(n) {
        var g = [1];
        for (var i = 0; i < n; i++) {
            var next = new Array(g.length + 1).fill(0);
            for (var j = 0; j < g.length; j++) {
                next[j] ^= g[j];
                next[j + 1] ^= mul(g[j], EXP[i]);
            }
            g = next;
        }
        return g;
    }

    /** The n error correction codewords for one block of data codewords. */
    function remainder(data, n) {
        var g = generator(n);
        var work = data.concat(new Array(n).fill(0));
        for (var i = 0; i < data.length; i++) {
            var factor = work[i];
            if (!factor) {
                continue;
            }
            for (var j = 0; j < g.length; j++) {
                work[i + j] ^= mul(g[j], factor);
            }
        }
        return work.slice(data.length);
    }

    /* ---- the version tables, error correction M only ------------------ *
     * [error correction codewords per block,
     *  blocks in group 1, data codewords each,
     *  blocks in group 2, data codewords each]
     * ------------------------------------------------------------------ */

    var BLOCKS = {
        1:  [10, 1, 16, 0, 0],
        2:  [16, 1, 28, 0, 0],
        3:  [26, 1, 44, 0, 0],
        4:  [18, 2, 32, 0, 0],
        5:  [24, 2, 43, 0, 0],
        6:  [16, 4, 27, 0, 0],
        7:  [18, 4, 31, 0, 0],
        8:  [22, 2, 38, 2, 39],
        9:  [22, 3, 36, 2, 37],
        10: [26, 4, 43, 1, 44]
    };

    /** Centres of the alignment patterns, per version. */
    var ALIGNMENT = {
        1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
        6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
    };

    var MAX_VERSION = 10;

    function dataCodewords(version) {
        var b = BLOCKS[version];
        return b[1] * b[2] + b[3] * b[4];
    }

    /** 8 bits of character count up to version 9, 16 from version 10. */
    function countBits(version) {
        return version < 10 ? 8 : 16;
    }

    function smallestVersion(byteLength) {
        for (var v = 1; v <= MAX_VERSION; v++) {
            var capacity = (dataCodewords(v) * 8 - 4 - countBits(v)) >> 3;
            if (byteLength <= capacity) {
                return v;
            }
        }
        return 0;
    }

    /* ---- the bit stream ----------------------------------------------- */

    function codewordsFor(bytes, version) {
        var bits = [];
        function push(value, length) {
            for (var i = length - 1; i >= 0; i--) {
                bits.push((value >> i) & 1);
            }
        }

        push(0b0100, 4); // byte mode
        push(bytes.length, countBits(version));
        for (var i = 0; i < bytes.length; i++) {
            push(bytes[i], 8);
        }

        var capacity = dataCodewords(version) * 8;
        // terminator: up to four zero bits, fewer if there is no room
        push(0, Math.min(4, capacity - bits.length));
        while (bits.length % 8) {
            bits.push(0);
        }

        var codewords = [];
        for (var b = 0; b < bits.length; b += 8) {
            var byte = 0;
            for (var k = 0; k < 8; k++) {
                byte = (byte << 1) | bits[b + k];
            }
            codewords.push(byte);
        }
        // the two pad codewords the standard names, alternating
        var pad = [0xEC, 0x11];
        for (var p = 0; codewords.length < dataCodewords(version); p++) {
            codewords.push(pad[p % 2]);
        }
        return codewords;
    }

    /**
     * Data and error correction codewords, interleaved. Blocks are read a
     * codeword at a time across all of them, which is what lets a burst of
     * damage fall on many blocks a little rather than one block fatally.
     */
    function interleave(codewords, version) {
        var spec = BLOCKS[version];
        var ecPerBlock = spec[0];
        var sizes = [];
        var i;
        for (i = 0; i < spec[1]; i++) {
            sizes.push(spec[2]);
        }
        for (i = 0; i < spec[3]; i++) {
            sizes.push(spec[4]);
        }

        var dataBlocks = [];
        var ecBlocks = [];
        var at = 0;
        for (i = 0; i < sizes.length; i++) {
            var block = codewords.slice(at, at + sizes[i]);
            at += sizes[i];
            dataBlocks.push(block);
            ecBlocks.push(remainder(block, ecPerBlock));
        }

        var out = [];
        var longest = Math.max.apply(null, sizes);
        for (var c = 0; c < longest; c++) {
            for (i = 0; i < dataBlocks.length; i++) {
                if (c < dataBlocks[i].length) {
                    out.push(dataBlocks[i][c]);
                }
            }
        }
        for (c = 0; c < ecPerBlock; c++) {
            for (i = 0; i < ecBlocks.length; i++) {
                out.push(ecBlocks[i][c]);
            }
        }
        return out;
    }

    /* ---- the matrix ---------------------------------------------------- */

    /**
     * A grid of cells, each null until something claims it. null is what tells
     * the data placement which cells are still free, and the function patterns
     * claim theirs first.
     */
    function blank(size) {
        var m = [];
        for (var y = 0; y < size; y++) {
            m.push(new Array(size).fill(null));
        }
        return m;
    }

    function placeFinder(m, x, y) {
        for (var dy = -1; dy <= 7; dy++) {
            for (var dx = -1; dx <= 7; dx++) {
                var py = y + dy;
                var px = x + dx;
                if (py < 0 || px < 0 || py >= m.length || px >= m.length) {
                    continue;
                }
                var ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
                m[py][px] = (ring !== 2 && ring <= 3) ? 1 : 0;
            }
        }
    }

    function placeFunctions(m, version) {
        var size = m.length;
        var i;

        placeFinder(m, 0, 0);
        placeFinder(m, size - 7, 0);
        placeFinder(m, 0, size - 7);

        // timing patterns
        for (i = 8; i < size - 8; i++) {
            var bit = (i % 2 === 0) ? 1 : 0;
            m[6][i] = bit;
            m[i][6] = bit;
        }

        // alignment patterns, except where a finder already sits
        var centres = ALIGNMENT[version];
        for (var a = 0; a < centres.length; a++) {
            for (var b = 0; b < centres.length; b++) {
                var cx = centres[b];
                var cy = centres[a];
                if ((cx === 6 && cy === 6) ||
                    (cx === 6 && cy === size - 7) ||
                    (cx === size - 7 && cy === 6)) {
                    continue;
                }
                for (var dy = -2; dy <= 2; dy++) {
                    for (var dx = -2; dx <= 2; dx++) {
                        m[cy + dy][cx + dx] = (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) ? 1 : 0;
                    }
                }
            }
        }

        // the one module that is always dark
        m[size - 8][8] = 1;

        // format information is written later, but its cells are reserved now
        for (i = 0; i < 9; i++) {
            if (m[8][i] === null) { m[8][i] = 0; }
            if (m[i][8] === null) { m[i][8] = 0; }
        }
        for (i = 0; i < 8; i++) {
            if (m[8][size - 1 - i] === null) { m[8][size - 1 - i] = 0; }
            if (m[size - 1 - i][8] === null) { m[size - 1 - i][8] = 0; }
        }

        if (version >= 7) {
            var info = versionBits(version);
            for (i = 0; i < 18; i++) {
                var bitv = (info >> i) & 1;
                m[Math.floor(i / 3)][size - 11 + (i % 3)] = bitv;
                m[size - 11 + (i % 3)][Math.floor(i / 3)] = bitv;
            }
        }
    }

    /** 18-bit BCH version information, for versions 7 and up. */
    function versionBits(version) {
        var d = version << 12;
        for (var i = 0; i < 6; i++) {
            if (d & (1 << (17 - i))) {
                d ^= 0x1F25 << (5 - i);
            }
        }
        return (version << 12) | d;
    }

    /** 15-bit BCH format information: error correction level M, and the mask. */
    function formatBits(mask) {
        var data = (0b00 << 3) | mask; // 00 is level M
        var d = data << 10;
        for (var i = 0; i < 5; i++) {
            if (d & (1 << (14 - i))) {
                d ^= 0x537 << (4 - i);
            }
        }
        return ((data << 10) | d) ^ 0x5412;
    }

    function placeFormat(m, mask) {
        var size = m.length;
        var bits = formatBits(mask);
        for (var i = 0; i < 15; i++) {
            var bit = (bits >> i) & 1;
            // the copy beside the top-left finder, skipping the timing row
            if (i < 6) {
                m[i][8] = bit;
            } else if (i === 6) {
                m[7][8] = bit;
            } else if (i === 7) {
                m[8][8] = bit;
            } else if (i === 8) {
                m[8][7] = bit;
            } else {
                m[8][14 - i] = bit;
            }
            // and the split copy beside the other two
            if (i < 8) {
                m[8][size - 1 - i] = bit;
            } else {
                m[size - 15 + i][8] = bit;
            }
        }
    }

    var MASKS = [
        function(x, y) { return (x + y) % 2 === 0; },
        function(x, y) { return y % 2 === 0; },
        function(x, y) { return x % 3 === 0; },
        function(x, y) { return (x + y) % 3 === 0; },
        function(x, y) { return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0; },
        function(x, y) { return ((x * y) % 2) + ((x * y) % 3) === 0; },
        function(x, y) { return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; },
        function(x, y) { return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; }
    ];

    /**
     * Walks the free cells in the standard order - upward and downward in
     * two-wide columns from the bottom right, skipping the vertical timing
     * strip - laying the codeword bits down as it goes, masked.
     */
    function placeData(m, bytes, mask) {
        var size = m.length;
        var bit = 0;
        var total = bytes.length * 8;
        var upward = true;

        for (var right = size - 1; right >= 1; right -= 2) {
            if (right === 6) {
                right = 5; // the timing column is not part of the zigzag
            }
            for (var step = 0; step < size; step++) {
                var y = upward ? size - 1 - step : step;
                for (var c = 0; c < 2; c++) {
                    var x = right - c;
                    if (m[y][x] !== null) {
                        continue;
                    }
                    var value = 0;
                    if (bit < total) {
                        value = (bytes[bit >> 3] >> (7 - (bit & 7))) & 1;
                        bit++;
                    }
                    m[y][x] = MASKS[mask](x, y) ? value ^ 1 : value;
                }
            }
            upward = !upward;
        }
    }

    /* ---- choosing the mask -------------------------------------------- */

    function penalty(m) {
        var size = m.length;
        var score = 0;
        var x, y, run, dark = 0;

        // rule 1: runs of five or more of the same colour, each way
        for (y = 0; y < size; y++) {
            run = 1;
            for (x = 1; x < size; x++) {
                if (m[y][x] === m[y][x - 1]) {
                    run++;
                } else {
                    if (run >= 5) { score += run - 2; }
                    run = 1;
                }
            }
            if (run >= 5) { score += run - 2; }
        }
        for (x = 0; x < size; x++) {
            run = 1;
            for (y = 1; y < size; y++) {
                if (m[y][x] === m[y - 1][x]) {
                    run++;
                } else {
                    if (run >= 5) { score += run - 2; }
                    run = 1;
                }
            }
            if (run >= 5) { score += run - 2; }
        }

        // rule 2: every 2x2 block of one colour
        for (y = 0; y < size - 1; y++) {
            for (x = 0; x < size - 1; x++) {
                var v = m[y][x];
                if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) {
                    score += 3;
                }
            }
        }

        // rule 3: the finder-like 1:1:3:1:1 sequence, with four light modules
        // on either side, in either direction
        var a = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
        var b = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
        function matches(get, at, pattern) {
            for (var i = 0; i < pattern.length; i++) {
                if (get(at + i) !== pattern[i]) { return false; }
            }
            return true;
        }
        for (y = 0; y < size; y++) {
            for (x = 0; x <= size - 11; x++) {
                var row = (function(yy) { return function(i) { return m[yy][i]; }; })(y);
                if (matches(row, x, a) || matches(row, x, b)) { score += 40; }
            }
        }
        for (x = 0; x < size; x++) {
            for (y = 0; y <= size - 11; y++) {
                var col = (function(xx) { return function(i) { return m[i][xx]; }; })(x);
                if (matches(col, y, a) || matches(col, y, b)) { score += 40; }
            }
        }

        // rule 4: how far the proportion of dark modules strays from half
        for (y = 0; y < size; y++) {
            for (x = 0; x < size; x++) {
                if (m[y][x]) { dark++; }
            }
        }
        var percent = dark * 100 / (size * size);
        score += Math.floor(Math.abs(percent - 50) / 5) * 10;

        return score;
    }

    /* ---- the whole thing ----------------------------------------------- */

    /** UTF-8 bytes, since a URL can carry anything. */
    function toBytes(text) {
        var encoded = unescape(encodeURIComponent(text));
        var bytes = [];
        for (var i = 0; i < encoded.length; i++) {
            bytes.push(encoded.charCodeAt(i) & 0xff);
        }
        return bytes;
    }

    /**
     * The finished modules as rows of 0 and 1, without a quiet zone, or null
     * if the text will not fit in version 10.
     */
    function matrix(text) {
        var bytes = toBytes(String(text || ''));
        var version = smallestVersion(bytes.length);
        if (!version) {
            return null;
        }
        var codewords = interleave(codewordsFor(bytes, version), version);
        var size = version * 4 + 17;

        var best = null;
        var bestScore = Infinity;
        for (var mask = 0; mask < 8; mask++) {
            var m = blank(size);
            placeFunctions(m, version);
            placeData(m, codewords, mask);
            placeFormat(m, mask);
            var score = penalty(m);
            if (score < bestScore) {
                bestScore = score;
                best = m;
            }
        }
        return best;
    }

    return { matrix: matrix };
})();

if (typeof module !== 'undefined') {
    module.exports = QrCode; // for the offline cross-check
}
