/**
 * Mosaic Visual Hash - v1.0.1
 * https://github.com/jfietkau/Mosaic-Visual-Hash/
 *
 * Copyright (c) 2017-2019 Julian Fietkau
 * Dual licensed under the ISC and GPLv3 licenses.
 *
 *******************************************************************************
 *
 * ISC License
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 *******************************************************************************
 *
 * GPLv3 License
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

(function(root) {

  root = root || {};
  var size, context, source, params;
  var canvas, curves, colors;
  var curveJitterValues;

  /**
   * Takes an input, a desired canvas target, and an optional list of additional
   * parameters and creates a canvas showing the resulting visual hash.
   *
   * target may be a number, in which case it is interpreted as the desired
   * height and width of a newly created canvas, which is then returned at the
   * end. If target is not a number, it is assumed to be a reference to an
   * existing canvas element and the image is drawn into it.
   */
  function display(input, target, givenParams) {
    if(typeof target == "number") {
      size = target;
      if(!root.document || !root.document.createElement) {
        throw "Cannot find the DOM";
      }
      canvas = document.createElement("canvas");
      canvas.setAttribute("width", size);
      canvas.setAttribute("height", size);
    } else {
      canvas = target;
      size = Math.min(canvas.getAttribute("width"), canvas.getAttribute("height"));
    }

    params = extendWithDefaults(givenParams || {});

    source = parseInput(input);

    context = canvas.getContext("2d");
    context.lineWidth = size * params.lineWidth;

    curves = new Array();
    curveJitterValues = new Array();
    for(var i = 0; i < params.numberOfCurves; i++) {
      curves.push(bytesToCurveParams(source.slice(i * 2, i * 2 + 2)));
      // We store the future jitter values for curvature, position etc. now
      // since both curve-drawing sequences need to use the same ones.
      for(var j = 0; j < 3; j++) {
        curveJitterValues.push(Math.random() * params.jitter / 3);
      }
    }

    colors = createPalette(params.numberOfColors, source.slice(params.numberOfCurves * 2));

    // To achieve an appearance resembling stained glass, what we do is we draw a bunch of
    // overlapping translucent white circles onto our black canvas. These circles all have
    // an opacity of 1/256, i.e. each one increases the R, G and B values for pixels
    // within the circle by one. We can then determine after the fact for each pixel within
    // how many of the drawn circles it is located, simply by reading any of the color
    // channel values - see fillInTheColors() below.
    drawBg("black");
    for(var i = 0; i < curves.length; i++) {
      drawCurve(curves[i], "fill", "rgba(255, 255, 255, 0.00390625)", curveJitterValues.slice(i * 3, (i+1) * 3));
    }

    fillInTheColors(colors);

    // The user may supply a desired line color, but if not we attempt to determine a
    // high-contrast one based on the color palette.
    var lineColor;
    if(params.lineColor) {
      lineColor = params.lineColor;
    } else {
      lineColor = determineLineColor(colors);
    }

    // After the colored areas have been drawn, we add the lines in between. These are
    // usually nicely antialiased.
    for(var i = 0; i < curves.length; i++) {
      drawCurve(curves[i], "stroke", lineColor, curveJitterValues.slice(i * 3, (i+1) * 3));
    }

    return canvas;
  }

  /**
   * Normalizes the user input into a canonical form. Accepts any one of the following:
   * - an array of unsigned bytes (length >= 1)
   * - a hexadecimal string (length >= 2, if length uneven then last digit is discarded)
   * - any UTF-8 string
   * The input is converted to a fixed-length Uint8Array. if the input is too short, it is
   * repeated as often as necessary. If it is too long, it is collapsed using modulo XOR.
   *
   * Caution: This is NOT suitable as a hash function. If the client relies on the usual
   * properties of hash functions, then the input to this function should be the output
   * of a good general purpose hash function (e.g. SHA-3).
   */
  function parseInput(input) {
    if(typeof input == "string") {
      var reHex = /^(0[Xx])?[0-9A-Fa-f]+$/g;
      if(reHex.test(input)) {
        if(input.toLowerCase().startsWith("0x")) {
          input = input.slice(2);
        }
        var interim = new Uint8Array(Math.floor(input.length / 2));
        for(var i = 0; i < interim.length; i++) {
          interim[i] = parseInt(input.slice(2 * i, 2 * i + 2), 16);
        }
        input = interim;
      } else {
        input = new TextEncoder("utf-8").encode(input);
      }
    }
    // If it's not a string, simply assume it's an iterable of unsigned bytes

    // Estimate how many input bytes we will need: 3 per curve, 1 per color, plus a buffer
    var result = new Uint8Array(params.numberOfCurves * 3 + params.numberOfColors + 16);
    for(var i = 0; i < Math.max(input.length, result.length); i++) {
      // Halfheartedly try to make use of all input bytes in some fashion
      result[i % result.length] = input[i % input.length] ^ result[i % result.length];
    }
    return result;
  }

  /**
   * Folds any provided algorithm parameters into a set of defaults. The result of this
   * function can then be used to guarantee that every value is either user-provided or
   * set to a sensible default.
   */
  function extendWithDefaults(algoParams) {
    var newParams = {
      numberOfCurves: 6,
      numberOfColors: 3,
      lineWidth: 0.02,
      jitter: 3
    };
    for(var property in algoParams) {
      if(algoParams.hasOwnProperty(property)) {
        newParams[property] = algoParams[property];
      }
    }
    return newParams;
  }

  /**
   * Converts two bytes into a data structure that describes one of the curves in the image.
   */
  function bytesToCurveParams(bytes) {
    var params = {};

    params.curvature = bytes[0] % 8;
    params.angle = (bytes[0] >> 3) / 32;
    params.deltaX = bytes[1] % 16;
    params.deltaY = bytes[1] >> 4;
    var deltas = new Array("X", "Y");
    for(var i = 0; i < deltas.length; i++) {
      params["delta" + deltas[i]] = (params["delta" + deltas[i]] - 7.5) / 18.75;
    }

    return params;
  }

  /**
   * Given a number of desired colors and some data to derive values from,
   * creates a pleasant color palette.
   */
  function createPalette(number, bytes) {

    /**
     * Converts an HSL color value to RGB. Conversion formula
     * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
     * Assumes h, s, and l are contained in the set [0, 1] and
     * returns r, g, and b in the set [0, 255].
     *
     * @param   {number}  h       The hue
     * @param   {number}  s       The saturation
     * @param   {number}  l       The lightness
     * @return  {Array}           The RGB representation
     *
     * Credit: Michael jackson (@mjackson)
     *         https://gist.github.com/mjackson/5311256
     */
    function hslToRgb(h, s, l){
      var r, g, b;

      if(s == 0){
        r = g = b = l; // achromatic
      }else{
        var hue2rgb = function hue2rgb(p, q, t){
          if(t < 0) t += 1;
          if(t > 1) t -= 1;
          if(t < 1/6) return p + (q - p) * 6 * t;
          if(t < 1/2) return q;
          if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }

      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    var palette = new Array();

    function newLum(scale) {
      return 0.2 + ((scale) / 16) * 0.7;
    }

    var hue = bytes[0] / 256;
    var lum = newLum(bytes[1] % 16);
    var c = hslToRgb(hue, 1.0, lum);
    palette.push({r: c[0], g: c[1], b: c[2]});

    if(number == 1) return palette;

    if(number == 2 || number == 3) {
      // If only 2 or 3 numbers are requested, we pick a color with
      // a slightly different hue (but not too different) for each
      // empty slot. This should give fairly pleasant color palettes.
      var cHue = (hue + 0.25 + ((bytes[1] >> 4) / 16) * 0.5) % 1.0;
      var cLum = newLum(bytes[2] % 16);
      c = hslToRgb(cHue, 1.0, cLum);
      palette.push({r: c[0], g: c[1], b: c[2]});

      if(number == 3) {
        cHue = (hue - 0.25 - ((bytes[2] >> 4) / 16) * 0.5) % 1.0;
        cLum = newLum(bytes[3] % 16);
        c = hslToRgb(cHue, 1.0, cLum);
        palette.push({r: c[0], g: c[1], b: c[2]});
      }
    } else {
      // If more than 3 colors are requested, we abandon the attempt at finding
      // nice-looking complementary colors and instead use an algorithm for
      // finding an arbitrary number of distinct colors.
      while(palette.length < number) {
        hue += 0.381966; // the golden angle as a fraction of the circle circumference
        hue += ((bytes[(palette.length + 1) % bytes.length] % 16) / 16) * 0.2 - 0.1;
        hue = hue % 1;
        lum = newLum(bytes[(palette.length + 1) % bytes.length] >> 4);
        var c = hslToRgb(hue, 1.0, lum);
        palette.push({r: c[0], g: c[1], b: c[2]});
      }
    }

    return palette;
  }

  /**
   * Determines whether the lines in between the colored areas should be black or
   * white, based on the average lightness of the colors.
   */
  function determineLineColor(colors) {
    // Just averaging up all the RGB components is rather crude in terms of color
    // theory, but more expensive calculations don't seem worth the effort.
    var avgBrightness = 0;
    for(var i = 0; i < colors.length; i++) {
      avgBrightness += colors[i].r + colors[i].g + colors[i].b;
    }
    avgBrightness = avgBrightness / (colors.length * 3);
    return (avgBrightness < 96) ? "white" : "black";
  }

  /**
   * Fills our canvas with a single color.
   */
  function drawBg(color) {
    context.beginPath();
    context.rect(0, 0, size, size);
    context.fillStyle = color;
    context.fill();
  }

  /**
   * Draws one curve onto the canvas. Expects the curve parameters as given by
   * bytesToCurveParams() as well as a drawing function (either "fill" or "stroke")
   * and a desired color. In addition, the values to be used for jitter need to be
   * passed in.
   */
  function drawCurve(params, drawFunc, color, jitterValues) {
    if(!context[drawFunc]) {
      // Invalid drawing function
      return;
    }
    var curvature = params.curvature + jitterValues[0] - 0.5;
    var radius = (curvature * curvature) * 0.02 + 0.8;
    var displacementX = 0.5 + radius * Math.sin(params.angle * 2 * Math.PI);
    var displacementY = 0.5 + radius * Math.cos(params.angle * 2 * Math.PI);
    displacementX += params.deltaX;
    displacementY += params.deltaY;
    displacementX += (jitterValues[1] - 0.5) / 64;
    displacementY += (jitterValues[2] - 0.5) / 64;
    context.beginPath();
    context.arc(displacementX * size, displacementY * size, radius * size, 0, 2 * Math.PI, false);
    context[drawFunc + "Style"] = color;
    context[drawFunc]();
  }

  /**
   * Based on a canvas that has been pre-filled with overlapping transparent white
   * circles - see display() - this method goes through every pixel and applies a
   * color from the given palette based on the brightness of each pixel.
   */
  function fillInTheColors(colors) {
    var jitteredColors = new Array();
    for(var i = 0; i < colors.length; i++) {
      var jittered = {};
      jittered.r = Math.max(0, Math.min(255, colors[i].r + (Math.random() - 0.5) * params.jitter * 5));
      jittered.g = Math.max(0, Math.min(255, colors[i].g + (Math.random() - 0.5) * params.jitter * 5));
      jittered.b = Math.max(0, Math.min(255, colors[i].b + (Math.random() - 0.5) * params.jitter * 5));
      jitteredColors.push(jittered);
    }

    var imageData = context.getImageData(0, 0, size, size);
    var colorIndex = 0;
    for(var i = 0; i < imageData.data.length; i += 4) {
      // Because the canvas is monochrome at this stage, we simply look at the
      // red channel.
      colorIndex = imageData.data[i] % jitteredColors.length;
      imageData.data[i] = jitteredColors[colorIndex].r;
      imageData.data[i + 1] = jitteredColors[colorIndex].g;
      imageData.data[i + 2] = jitteredColors[colorIndex].b;
    }
    context.putImageData(imageData, 0, 0);
  }

  // External interface
  root.mosaicVisualHash = display;

})(window);
