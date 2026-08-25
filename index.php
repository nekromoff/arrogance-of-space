<?php
$url = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>The Arrogance of Space Mapping Tool #ArroganceOfSpace</title>
    <meta name="description" content="Useful tool to show how much space is taken in our cities by cars. Find a place on the map or upload your own image and easily mark type of space. Inspired by Copenhagenize.">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="favicon.png"/>
    <script type="text/javascript" src="https://code.jquery.com/jquery.min.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/purecss@1.0.1/build/pure-min.css" integrity="sha384-oAOxQR6DkCoMliIh8yFnu25d7Eq/PHS21PClpwjOTeU2jRSq11vu66rf90/cZr47" crossorigin="anonymous">
    <link rel="stylesheet" href="https://unpkg.com/purecss@1.0.1/build/grids-responsive-min.css" crossorigin="anonymous">
    <link href="arrogance.css" rel="stylesheet">
    <meta property="og:title" content="The Arrogance of Space Mapping Tool #ArroganceOfSpace">
    <meta property="og:description" content="Useful tool to show how much space is taken in our cities by cars. Find a place on the map or upload your own image and easily mark type of space.">
    <meta property="og:image" content="<?php echo $url; ?>arrogance.png">
    <meta property="og:url" content="<?php echo $url; ?>">
    <meta property="og:type" content="website">
    <meta name="twitter:title" content="The Arrogance of Space Mapping Tool #ArroganceOfSpace">
    <meta name="twitter:description" content="Useful tool to show how much space is taken in our cities by cars. Find a place on the map or upload your own image and easily mark type of space.">
    <meta name="twitter:image" content="<?php echo $url; ?>arrogance.png">
    <meta name="twitter:card" content="summary_large_image">
</head>
<body>
    <div class="pure-g">
    <div class="pure-u-1 pure-u-lg-1-5">
        <div class="l-box">
            <h1>The Arrogance of Space Mapping Tool</h1>
            <small>Find an intersection or neighbourhood on the map - or upload your own aerial photo - and start mapping how much space is allocated to cars, pedestrians and bikes.</small>
        </div>
        <div class="l-box">
            <form action="#" class="pure-form">
                <div id="sourcetabs">
                    <a href="#" class="pure-button source-tab pure-button-active" data-source="osm">Load a map</a><a href="#" class="pure-button source-tab" data-source="image">Upload a photo</a>
                </div>
                <div id="sources">
                    <fieldset class="source" id="source-osm">
                        <label for="osmplace">
                            Place: <input type="text" id="osmplace" placeholder="Street, city or lat, lon">
                        </label><br>
                        <a id="osmfind" class="pure-button pure-button-primary" href="#">Find place</a>
                        <div id="framing" hidden>
                            <small>Drag the map to move it, scroll to zoom. The whole square becomes your canvas.</small><br>
                            <a id="zoomout" class="pure-button" href="#">-</a>
                            <span id="zoomlevel"></span>
                            <a id="zoomin" class="pure-button" href="#">+</a><br>
                            <a id="osmprefill" class="pure-button pure-button-primary" href="#">Prefill from OpenStreetMap</a>
                            <a id="osmplain" class="pure-button" href="#">Use image only</a><br>
                            <small>Prefilling guesses the squares from OpenStreetMap. Always check the result - OSM data is incomplete in many places.</small>
                        </div>
                    </fieldset>
                    <fieldset class="source" id="source-image" hidden>
                        <label for="gridimage">
                            Image: <input type="file" id="gridimage">
                        </label><br>
                        <small>Choose an aerial or satellite photo from your computer.</small>
                    </fieldset>
                </div>
                <small id="imagedetails"></small>
                <fieldset>
                    <legend>Grid</legend>
                    <label for="gridblocksize">
                        Block size: <input type="text" id="gridblocksize">
                    </label><br>
                    <small>Choose a grid block size. Smaller = more work.</small><br>
                    <label for="eraseropacity">
                        Opacity: <input type="range" min="0.1" max="0.8" value="0.5" step="0.1" id="eraseropacity">
                    </label>
                </fieldset>
            </form>
        </div>
        <div class="l-box">
            <div id="tools"></div>
            <small>
                <ul>
                    <li>Select a color tool.</li>
                    <li>Click and drag to draw the color onto the map.</li>
                    <li>Right click to add a marker (e.g. cyclist/ped counts.)</li>
                    <li>Scroll or use your mouse wheel to cycle through colors.</li>
                    <li>Press backspace to remove a marker.</li>
                </ul>
            </small>
        </div>
        <div class="l-box">
            <form action="#" class="pure-form">
                <label for="title">
                    Title: <input type="text" id="title" placeholder="Bratislava - The Arrogance of Space">
                </label>
            </form>
            <small>Printed as a header above the saved image. Leave empty for none.</small><br><br>
            <a id="save" class="pure-button pure-button-primary" download="arrogance.png" href="#">Save image</a> <a id="savegrid" class="pure-button pure-button-warning" download="arrogance-grid.png" href="#">Save colors only</a>
        </div>
        <div class="l-box">
            <a id="reset" class="pure-button pure-button-secondary" href="#">Reset canvas</a>
        </div>
        <div class="l-box">
            <small><a href="https://medium.com/@colville_andersen/the-arrogance-of-space-93a7419b0278">Concept</a> by <a href="https://colville-andersen.com/">Mikael Colville-Andersen</a>, Copenhagenize.</small><br>
            <small>This tool developed by <a href="https://www.ambience.sk/about/">Daniel Duris</a> for the <a href="https://cyklokoalicia.sk/en/">Cycling Coalition</a>. See <a href="https://github.com/nekromoff/arrogance-of-space">code on Github</a>. #ArroganceOfSpace</small>
        </div>
    </div>
    <div class="pure-u-1 pure-u-lg-4-5" id="editor">
        <div id="container">
            <canvas id="canvas" width="900" height="900"></canvas>
        </div>
    </div>
    </div>
    <div id="modal">
        <div id="modalstatus">Please wait...</div>
        <div id="progress"><div id="progressbar"></div></div>
        <div id="modalstep"></div>
        <div id="modalhelp" hidden></div>
        <div id="modalactions"><a id="modalcancel" class="pure-button" href="#">Cancel</a></div>
    </div>
    <canvas id="virtual"></canvas>
    <script type="text/javascript" language="javascript" src="arrogance.js?counts"></script>
    <script type="text/javascript" language="javascript" src="osm.js?counts"></script>
</body>
</html>
