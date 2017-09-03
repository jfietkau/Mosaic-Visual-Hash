# Mosaic Visual Hash

*Mosaic Visual Hash* is an algorithm that takes some amount of input bits and transforms them into an easily recognizable picture.

[Hash functions](https://en.wikipedia.org/wiki/Hash_function) are used in many contexts where we want to verify whether some chunk of data is identical to another previous chunk, but without the necessity of having the previous data at hand. For example, hash sums are often displayed next to big file downloads in order to allow the user to verify the error-free transfer of the file.

While verifying a typical hash is easy for a computer, comparing all those letters and numbers is cumbersome for human users. In situations where a user is expected to verify a hash, it can be very helpful to display the information that needs to be verified visually instead of as a string of digits, hence *visual hashing*. Humans are very good at identifying and comparing pictures, a difference on which CAPTCHAs rely to this day.

While there are some examples of freely available visual hashing algorithms, I thought to create one that looks more pleasant and visually appealing than what's already out there, which led to the creation of *Mosaic Visual Hash*. It achieves its visuals by creating and overlaying several circles of different sizes in order to create pictures resembling stained glass mosaics with soft contours.

It bears mentioning that, like most of its competitors, *Mosaic Visual Hash* is technically slightly mislabeled: by itself it does not constitute a very good hash function, and most of the beneficial properties of cryptographic hash functions are absent (e.g. specific input bits correspond directly to specific properties of the output picture). It is thus **heavily** recommended to use a known and well-understood cryptographic hash function (such as SHA-256) as a precursor to the visual hashing, i.e. to use the output of the cryptographic hash function as the input for *Mosaic Visual Hash*.

Additionally, the algorithm is intentionally not 100% deterministic. Small random variations to the colors and shapes are introduced as an additional security feature in order to make it more difficult to discern the exact algorithm input from a screenshot without harming the recognizability of the image by humans. The extent of this *jitter* can be configured.

## Live Demo

You can check to see what it looks like right here:

[]()

## Requirements

*Mosaic Visual Hash* is entirely written in JavaScript. It is intended to run in a modern browser and relies heavily on the HTML canvas element. It has no other technical dependencies.

It has been tested in contemporary versions of Mozilla Firefox and Google Chrome. Anything else is at your own risk.

## Other visual hashing schemes

* [Chris Harrison's Visual Hash](http://www.chrisharrison.net/projects/visualhash/)
* [Don Park's Identicon](https://github.com/donpark/identicon) ([Wikipedia](https://en.wikipedia.org/wiki/Identicon))
* [Mozilla's visual hashing for password fields](https://wiki.mozilla.org/Identity/Watchdog/Visual_Hashing)
* [OpenSSH's visual fingerprint](http://dirk-loss.de/sshvis/drunken_bishop.pdf) (PDF)
* [VizHash GD](http://sebsauvage.net/wiki/doku.php?id=php:vizhash_gd)

## License

*Mosaic Visual Hash* (c) 2017 [Julian Fietkau](https://github.com/jfietkau)

Dual licensed under the ISC and GPLv3 licenses. You can choose whichever fits your needs better. See [LICENSE-ISC](LICENSE-ISC) and [LICENSE-GPLv3](LICENSE-GPLv3) for details.

