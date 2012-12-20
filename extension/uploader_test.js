var UploaderTest = {
  pass: function() {
    return {passed: true, message: null};
  },
  fail: function() {
    return {passed: false, message: "hard-coded to fail"};
  },
  hexFileTest: function() {
    var input =
      ":100000000C9461000C947E000C947E000C947E0095\n" +
      ":00000001FF\n\n";

    var expectedOutput =
    [ 0x0c, 0x94, 0x61, 0x00, 0x0C, 0x94, 0x7E, 0x00, 0x0C, 0x94, 0x7E, 0x00, 0x0C, 0x94, 0x7E, 0x00];

    var actualOutput = parseHexFile(input);
    if (expectedOutput != actualOutput) {
      return {passed: false, message: "Actual: " + actualOutput + ", Expected: " + expectedOutput};
    } else {
      return {passed: true};
    }
  }
};

RunTest("UploaderTest", UploaderTest);
