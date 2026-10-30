#!/bin/bash

tmp_dir=$(mktemp -d)
git show ":src/locale/en.json" > "$tmp_dir/en.json"
git show ":src/locale/es.json" > "$tmp_dir/es.json"
node validate-translations.js "$tmp_dir/en.json" "$tmp_dir/es.json"