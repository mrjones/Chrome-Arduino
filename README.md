Chrome/Arduino Tools
====================

Directory Structure:
- /buildservice - EXPERIMENTAL. Hosted sketch compilation service.
- /deprecated - DEPRECATED. Old version of the Chrome extension for doing USB/Serial communication with the board.  Replaced by new build system in `extension`. This will be deleted soon.
- /extension - Current version of the Chrome extension.
  - extension - The actual extension to be packaged.  The `/js` subdirectory is empty and must be populated by running "grunt"
  - lib - Source files, not packaged directly into the extension
  - test - Test files, not packaged into the extension at all
- /sample-program - A simple program which can be built with [ino](http://inotool.org/) for experimentation and testing.

Install
=======
This is a work in progress, and is often broken and always buggy and hard to understand.  However, if you really want to install the extension, a compiled version exists at extension/extension.crx .

Build and Test
==============

`cd` to /extension and run `./build.sh` and `./test.sh`


