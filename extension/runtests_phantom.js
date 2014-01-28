// Run the tests headlessly on the command line
//
// path/to/phantomjs extension/runtests_phantom.js 
//
// Requires phantomjs: http://phantomjs.org/

var page = require('webpage').create();
var url = './extension/unittest.html';

page.onConsoleMessage = function (msg) { console.log(msg); };

page.open(url, function (status) {
  if (status == "fail") {
    console.log("Couldn't load: " + url);
    phantom.exit();
    return;
  }
  
  try {

    var results = page.evaluate( function() {
      return Test.StructuredResults;
    });
    var testCount = 0;
    var failCount = 0;
    for (var i = 0; i < results.length; ++i) {
      ++testCount;
      if (results[i].passed) {
        console.log("[PASS] " + results[i].testCaseName);
      } else {
        ++failCount;
        console.log("[FAIL] " + results[i].testCaseName);
        for (var j = 0; j < results[i].messages.length; ++j) {
          console.log(results[i].messages[j]);
        }
      }
    }
    console.log("====================")
    if (failCount == 0) {
      console.log("[PASS]");
    } else {
      console.log("[FAIL] " + failCount + " of " + testCount + " tests failed");
    }
  } catch (e) {
    console.log("Caught: " + e);
  }
  phantom.exit();
});
