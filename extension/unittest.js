function RunTest(testCaseName, testCase) {
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
    testMessageDiv.innerText += result.messages[i];
  }
}

function execute(testCase) {
  var overallResult = {passed: true, messages: []};
  for (testName in testCase) {
    var result = testCase[testName]();
    if (!result.passed) { overallResult.passed = false; }
    if (result.message != null) { overallResult.messages.push(result.message); }
  }
  return overallResult;
}
