Chrome/Arduino Tools
====================

Directory Structure:
- /buildservice - EXPERIMENTAL. Hosted sketch compilation service.
- /example-program - A simple program which can be built with [ino](http://inotool.org/) for experimentation and testing.
- /extension - DEPRECATED. Old version of the Chrome extension for doing USB/Serial communication with the board.  Replaced by new build system in extension2. This will be deleted soon.
- /extension2 - Current version of the Chrome extension.
  - extension - The actual extension to be packaged.  The "/js" subdirectory is empty and must be populated by running "grunt"
  - lib - Source files, not packaged directly into the extension
  - test - Test files, not packaged into the extension at all
- /test - DEPRECATED, replaced by extension2/test


Build and Test
==============

`cd` to /extension2 and run `./build.sh` and `./test.sh`


