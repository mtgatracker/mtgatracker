# mtg-font
An iconic font and CSS toolkit for Magic The Gathering

[Learn more here](http://alexandrearpin.com/mtg-font/index.html)

## Goals

The aim of this project is to generate scalable and customizable Magic The Gathering Symbols with very little HTML and that is familiar with the Font Awesome syntax.

For instance, generating a split mana symbol of White/Red only requires the following HTML

    <div class="mi-split"><i class="mi mi-w"></i><i class="mi mi-r"></i></div>

And a green mana symbol  is

    <i class="mi mi-mana mi-g"></i>


## How to modify the font

After trying various open source tools without a lot of success, this project currently uses fontastic.me to create the fonts from the SVG

I'd like to be able to have a command line pipeline to generate the fonts that's easy and reliable, if anybody has experience with doing so I'd be interested!

## Wishlist / Todos / Roadmap

- Add sets symbols (although they'll only be available as monochrome icons, so no mythic/rare gradients)
- Open Source and reusuable font generation pipeline (so that anybody can create the font files)
- Move to a CSS Preprocessor (PreCSS or SASS)