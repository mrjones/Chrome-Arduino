var Test = {
  Run: function(testCaseName, testCase) {
    var parentResultsDiv = document.getElementById('results');
    var testResultsDiv = document.createElement('div');
    var testNameDiv = document.createElement('div');
    var testMessageDiv = document.createElement('div');
    testResultsDiv.appendChild(testNameDiv);
    testResultsDiv.appendChild(testMessageDiv);
    parentResultsDiv.appendChild(testResultsDiv);
    testNameDiv.innerText = testCaseName + " - RUNNING";
    testResultsDiv.style.border = "1px solid black";

    var result = execute(testCase);
    if (result.passed) {
        testNameDiv.style.color = 'green';
        testNameDiv.innerText = testCaseName + " - PASSED";
    } else {
        testNameDiv.style.color = 'red';
        testNameDiv.innerText = testCaseName + " - FAILED";
    }
    for (var i = 0; i < result.messages.length; ++i) { 
        var messageDiv = document.createElement('div');
        testMessageDiv.appendChild(messageDiv);
        var messagePre = document.createElement('pre');
        messageDiv.appendChild(messagePre);
        messagePre.innerText += result.messages[i];
    }
  },


  AssertArrayEquals: function(expected, actual) {
    if (expected.length != actual.length) {
        throw("Lengths do not match.\n" +
              "Expected: " + expected + "\n" +
              "Actual:   " + actual);
    }

    for (var i = 0; i < expected.length; ++i) {
      if (expected[i] != actual[i]) {
        throw("Mismatch at position " + i + ".\n" +
              "Expected: " + expected + "\n" +
              "Actual:   " + actual);
      }
    }

    return true;
  },

  Fail: function(message) {
    throw(message);
  }
}

var catchExceptions = true;

function execute(testCase) {
  var overallResult = {passed: true, messages: []};
  var testsRun = 0;
  for (testName in testCase) {
    if (testName.toString() != "helpers") {
      var exception = false;
      testsRun++;
      console.log(" --- Running: " + testName + " --- ");
      if (catchExceptions) {
        try {
            var result = testCase[testName]();
        } catch (e) {
          console.log(e);
          overallResult.passed = false;
          overallResult.messages.push(testName + ": " + e);
        }
      } else {
        testCase[testName]();
      }
    } else {
      console.log("Skipping '" + testName + "' since it doesn't look like a test.");
    }
  }

  if (testsRun == 0) {
    return { passed: false, messages: [ "No tests were run" ] };
  }
  return overallResult;
}
