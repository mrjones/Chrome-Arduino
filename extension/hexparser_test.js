
var HexParserTest = {
  helpers: {
    assertFailure: function(d, m) {
      if (d != "FAIL") {
        Test.Fail("Should have failed because: " + m + "\n" +
                  "Actual result was: " + d);
      }
    }
  },
  simpleValidFile: function() {
    var input =
      ":100000000C9461000C947E000C947E000C947E0095 \n" +
      ":00000001FF \n\n";

    var expectedOutput =
      [ 0x0c, 0x94, 0x61, 0x00, 0x0C, 0x94, 0x7E, 0x00, 0x0C, 0x94, 0x7E, 0x00, 0x0C, 0x94, 0x7E, 0x00];

    var actualOutput = ParseHexFile(input);
    Test.AssertArrayEquals(expectedOutput, actualOutput);
  },
  nonContiguousAddresses: function() {
    var input =
      ":100000000C9461000C947E000C947E000C947E0095 \n" +
      ":108888000C9461000C947E000C947E000C947E0095 \n" +
      ":00000001FF \n\n";

    this.helpers.assertFailure(ParseHexFile(input), "0000 and 8888 are not contiguous addresses");
  },
  contiguousAddresses: function() {
    var input =
      ":100000000C9461000C947E000C947E000C947E0095 \n" +
      ":100010000C9461000C947E000C947E000C947E0095 \n" +
      ":00000001FF \n\n";

    var expectedOutput =
      [ 0x0c, 0x94, 0x61, 0x00, 0x0C, 0x94, 0x7E, 0x00, 0x0C, 0x94, 0x7E, 0x00, 0x0C, 0x94, 0x7E, 0x00,
        0x0c, 0x94, 0x61, 0x00, 0x0C, 0x94, 0x7E, 0x00, 0x0C, 0x94, 0x7E, 0x00, 0x0C, 0x94, 0x7E, 0x00];
  },
  missingEofRecord: function() {
    var input =
      ":100000000C9461000C947E000C947E000C947E0095";

    this.helpers.assertFailure(ParseHexFile(input), "missing EOF");
  },
  nonHexCharsInData: function() {
    var input =
      ":10000000XX9461000C947E000C947E000C947E0095 \n" +
      ":00000001FF \n\n";

    this.helpers.assertFailure(ParseHexFile(input), "XX are not hex chars");
  },
  malformedLine_dataAfterChecksum: function() {
    var input =
      ":100000000C9461000C947E000C947E000C947E0095xxxxxx\n" +
      ":00000001FF \n\n";

    this.helpers.assertFailure(ParseHexFile(input), "extra characters at the end");
  },
  malformedLine_noStartcode: function() {
    var input =
      "100000000C9461000C947E000C947E000C947E0095\n" +      
      ":00000001FF \n\n";

    this.helpers.assertFailure(ParseHexFile(input), "missing startcode (':')");
  },
  malformedLine_notEnoughDataBytes: function() {
    var input =
      ":100000000C9461000C947E000C947E000C947E95 \n" +
      ":00000001FF \n\n";

    this.helpers.assertFailure(ParseHexFile(input), "only 15 data bytes (or missing checksum)");
  },
  malformedLine_unknownRecordType: function() {
    var input =
      ":100000XX0C9461000C947E000C947E000C947E0095 \n" +
      ":00000001FF \n\n";

    this.helpers.assertFailure(ParseHexFile(input), "XX is not a valid record type");
  },

};

Test.Run("HexParserTest", HexParserTest);
