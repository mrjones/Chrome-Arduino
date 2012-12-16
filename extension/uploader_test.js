var UploaderTest = {
  Name: "UploaderTest",
  Run: function() {
    return {passed: false, messages: ['Foo: 1 != 2']};
  }
};

RunTest(UploaderTest);
