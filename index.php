<?php
$url = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-KBLX9LP');</script>
    <!-- End Google Tag Manager -->
    <meta charset="utf-8">
    <title>The Arrogance of Space Mapping Tool #ArroganceOfSpace</title>
    <meta name="description" content="Useful tool to show how much space is taken in our cities by cars. Load an image and easily mark type of space for any city. Inspired by Copehagenize.">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="favicon.png"/>
    <script type="text/javascript" src="https://code.jquery.com/jquery.min.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/purecss@1.0.1/build/pure-min.css" integrity="sha384-oAOxQR6DkCoMliIh8yFnu25d7Eq/PHS21PClpwjOTeU2jRSq11vu66rf90/cZr47" crossorigin="anonymous">
    <link rel="stylesheet" href="https://unpkg.com/purecss@1.0.1/build/grids-responsive-min.css" crossorigin="anonymous">
    <link href="arrogance.css" rel="stylesheet">
    <meta property="og:title" content="The Arrogance of Space Mapping Tool #ArroganceOfSpace">
    <meta property="og:description" content="Useful tool to show how much space is taken in our cities by cars. Load an image and easily mark type of space for any city.">
    <meta property="og:image" content="<?php echo $url; ?>favicon.png">
    <meta property="og:url" content="<?php echo $url; ?>">
    <meta name="twitter:title" content="The Arrogance of Space Mapping Tool #ArroganceOfSpace">
    <meta name="twitter:description" content="Useful tool to show how much space is taken in our cities by cars. Load an image and easily mark type of space for any city.">
    <meta name="twitter:image" content="<?php echo $url; ?>favicon.png">
    <meta name="twitter:card" content="summary_large_image">
</head>
<body>
    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-KBLX9LP"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->
    <div class="pure-g">
    <div class="pure-u-1 pure-u-lg-1-5">
        <div class="l-box">
            <h1>The Arrogance of Space Mapping Tool</h1>
            <small>Upload an aerial or satellite photo from your city - an intersection or neighbourhood - and start mapping how much space is allocated to cars, pedestrians and bikes.</small>
        </div>
        <div class="l-box">
            <form action="#" class="pure-form">
                <fieldset>
                    <legend>Select:</legend>
                    <label for="gridimage">
                        Image: <input type="file" id="gridimage">
                    </label><br>
                    <small>Choose an image.</small><br>
                    <small id="imagedetails"></small><br>
                    <label for="gridblocksize">
                        Block size: <input type="text" id="gridblocksize">
                    </label><br>
                    <small>Choose a grid block size. Smaller = more work.</small><br>
                    <label for="eraseropacity">
                        Opacity: <input type="range" min="0.1" max="0.8" value="0.5" step="0.1" id="eraseropacity">
                    </label>
                </fieldset>
            </form>
        </div>
        <div class="l-box">
            <a id="toolup" class="pure-button pure-button-secondary">↑</a> <a id="tooldown" class="pure-button pure-button-secondary">↓</a> Tool: <span id="tool">Tool</span><br><small>
                <ul>
                    <li>Select a color tool.</li>
                    <li>Left click on the map and start drawing the color onto the map.</li>
                    <li>You can use your mouse wheel to change colors while drawing.</li>
                    <li>Left click again to release the drawing tool.</li>
                </ul></small>
        </div>
        <div class="l-box">
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
    <div id="modal">Please wait...</div>
    <canvas id="virtual"></canvas>
    <script type="text/javascript" language="javascript" src="arrogance.js"></script>
</body>
</html>