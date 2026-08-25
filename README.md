# The Arrogance of Space Mapping Tool #ArroganceOfSpace
See running version: https://cyklokoalicia.sk/arrogance/

## What is this?
A mapping tool to show how much space is dedicated to cars in our cities compared to space for peds, bicycles, green and even buildings. Find an intersection or neighbourhood on the map - or upload your own aerial photo - and start mapping how much space is allocated to cars, pedestrians and bikes.

## How to use it
There are two ways to get a map to work on:

**Load a map.** Type a place - a street and city, or `latitude, longitude` - and hit *Find place*. Aerial imagery loads and you can drag it around and scroll to zoom until the square shows the area you want. Nothing is painted yet, so frame it however you like. Then either:
* *Prefill from OpenStreetMap* - the squares are filled in automatically from OpenStreetMap data (see below), and you correct them.
* *Use image only* - you get a blank grid and paint everything yourself.

**Upload a photo.** The original way: pick an aerial or satellite photo from your computer and paint it.

Then map it:
* Pick a colour tool and click or drag to paint squares.
* Right click to add a marker, e.g. to count cyclists or pedestrians. Backspace removes the last one.
* Scroll to cycle through the tools.
* Block size sets how fine the grid is - smaller means more work.
* Opacity fades the colours so you can see the map underneath.

Add a title if you like - it is printed as a header above the saved image, and is filled in automatically from whatever you searched for. *Save image* gives you the map with the colours, percentages and any markers; *Save colors only* leaves out the photo.

Unpainted squares are not counted. The percentages are shares of what you actually marked, so if you only map part of the picture, the numbers describe that part.

## Automatic prefill from OpenStreetMap
Prefilling asks OpenStreetMap what is at the framed location and fills the squares in for you. Roads become car space using their lane count or width tags, with parking lanes added; `sidewalk=*` and `cycleway=*` tags put pedestrian and cycle strips beside the carriageway; buildings, parks, water and parking lots come from their own polygons; trams and busways become public transport.

Everything ends up as squares, exactly as if you painted them, and everything stays editable.

**Always check the result.** OpenStreetMap is incomplete in many places - missing sidewalks are the usual gap - and widths are estimated from tags rather than measured. Squares that nothing claims are left unpainted rather than guessed. If the query servers are busy you may get a timeout; the tool tries several mirrors, and you can always fall back to painting by hand.

Imagery comes from Esri World Imagery, map data from OpenStreetMap contributors (ODbL). Both are credited automatically on saved images.

## Not a proof of concept
It used be a working proof of concept from 2019. In 2026 I updated and upgraded it to do the work for you. Thanks to OpenStreetMap!
**Pull requests are welcome.**

## Original concept
Original concept by Mikael Colville-Andersen, Copenhagenize.
See Mikael's tweet:
https://web.archive.org/web/20191121154624/https://twitter.com/colvilleandersn/status/1197537645657829379
or read his full explanation:
https://medium.com/@colville_andersen/the-arrogance-of-space-93a7419b0278
