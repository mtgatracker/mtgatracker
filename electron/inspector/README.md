# MTGATracker: Inspector

MTGATracker: Inspector is a web-based companion app for [MTGATracker](https://github.com/mtgatracker/mtgatracker).

The code in the [mtgatracker/mtgatracker-inspector](https://github.com/mtgatracker/mtgatracker-inspector)
repository drives the [development / staging](https://mtgatracker.github.io/mtgatracker-inspector/)
instance of Inspector; once code is merged there, it must also be merged into the
[shawkinsl/mtgatracker-inspector](https://github.com/shawkinsl/mtgatracker-inspector)
repo to hit the production instance. (Why? Because shawkinsl/mtgatracker-inspector was around first, and
it would likely be a downtime-required change to swap it.)

## Getting started

Running Inspector locally:

1. Get dependencies: `npm install .`
1. Start the local server `gulp dev`
1. Make code edits, gulp automatically reloads on save

Note that babel takes 30-60s to transpile and pack the app's js. Be patient, and generally wait
for the second "Finished 'dev' after 55ms..." output after changing source files.

## Credits, License

Inspector is based off of the incredible [SB Admin 2 Bootstrap Theme](https://startbootstrap.com/template-overviews/sb-admin-2/)
Copyright 2018 MTGATracker. All open-source MTGATracker projects are licensed under the [MIT License](https://opensource.org/licenses/MIT).
