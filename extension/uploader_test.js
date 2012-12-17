var UploaderTest = {
  pass: function() {
    return {passed: true, message: null};
  },
  fail: function() {
    return {passed: false, message: "hard-coded to fail"};
  }
};

RunTest("UploaderTest", UploaderTest);
