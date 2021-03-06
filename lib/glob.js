/*
 * glob-whatev
 * http://github.com/cowboy/node-glob-whatev
 *
 * Copyright (c) 2012 "Cowboy" Ben Alman
 * Licensed under the MIT license.
 * http://benalman.com/about/license/
 */

var fs = require('fs');
var path = require('path');

var minimatch = require('minimatch');

// Windows uses \ instead of / for path separators.
var win32 = process.platform === 'win32';
var pathSeparator = win32 ? '\\' : '/';
var stripWildcard = /[*?{+(].*$/;
var stripNonpath = win32 ? /[^\/\\]*$/ : /[^\/]*$/;

// On Windows, convert all \ to /.
function normalize(filepath) {
  return win32 ? filepath.replace(/\\/g, '/') : filepath;
}

// A very simple, not-at-all-efficient, synchronous file globbing util.
exports.glob = function(pattern, options) {
  if (!options) { options = {}; }
  // The current absolute working directory.
  var base = normalize(path.join(process.cwd(), pathSeparator));
  // The passed pattern, resolved to an absolute path.
  var absPattern = normalize(path.resolve(base, pattern));
  // Since path.resolve strips off trailing '/', add it back if necessary.
  if (/\/$/.test(pattern)) { absPattern += '/'; }
  // Was pattern-ass-specified already absolute?
  var wasAbsolute = pattern === absPattern;
  // Instead of recursing from the base looking for files, start recursing at
  // the farthest possible subdirectory that doesn't contain any kind of
  // wildcard characters. I may have missed one, so let me know if I have!
  var betterBase = absPattern.replace(stripWildcard, '').replace(stripNonpath, '');
  // Now that we've got a better base, we need a better pattern.
  var betterPattern = absPattern.slice(betterBase.length);
  // Don't recurse if we don't have to. Limit max depth.
  var maxDepth = betterPattern.indexOf('**') >= 0 ? (options.maxDepth || 99)
    : betterPattern.split('/').length;

  // Iterate over all sub-files and directories in a brute-force and not-at-all
  // efficient way.
  var filepaths = [];
  (function recurse(dirpath, depth) {
    fs.readdirSync(dirpath).forEach(function(filepath) {
      var stat;
      // Make relative path absolute.
      filepath = path.join(dirpath, filepath);
      try {
        stat = fs.statSync(filepath);
      } catch (e) {
        // Ignore files that can't be "stat"ed (such as emacs's lock files)
      }
      if (stat && stat.isDirectory()) {
        // If the path is a directory, push it onto the array, adding a
        // trailing /.
        filepaths.push(filepath + pathSeparator);
        // Recurse.
        if (depth < maxDepth) {
          recurse(filepath, depth + 1);
        }
      } else {
        // Push file path onto the array.
        filepaths.push(filepath);
      }
    });
  }(betterBase, 1));

  // Normalize filepaths and remove those that don't match pattern.
  filepaths = filepaths.map(normalize).filter(function(filepath) {
    return minimatch(filepath, absPattern, options);
  });

  // If the pattern wasn't absolute, replace each absolute filepath with one
  // that is relative to the cwd.
  if (!wasAbsolute) {
    filepaths = filepaths.map(function(filepath) {
      var relPath = normalize(path.relative(process.cwd(), filepath));
      if (/\/$/.test(filepath)) { relPath += '/'; }
      return relPath;
    });
  }

  return filepaths;
};
