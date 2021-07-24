#!/usr/bin/env bash

browserify assets/filterGlob.js --s filterGlob > filterGlob-bundle.js
rm -rf github-pr-filter.zip
zip -FSr github-pr-filter.zip public *.js *.css *.html manifest.json