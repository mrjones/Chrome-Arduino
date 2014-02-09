describe("HexParser", function() {
  it("handles simple valid file", function() {
    var input =
      ":100000000C9461000C947E000C947E000C947E0095 \n" +
      ":00000001FF \n\n";

    var expectedOutput =
      [ 0x0c, 0x94, 0x61, 0x00, 0x0C, 0x94, 0x7E, 0x00, 0x0C, 0x94, 0x7E, 0x00, 0x0C, 0x94, 0x7E, 0x00];

    expect(ParseHexFile(input)).toEqual(expectedOutput);
  });

  it ("handles contiguous addresses", function() {
    var input =
      ":100000000C9461000C947E000C947E000C947E0095 \n" +
      ":100010000C9461000C947E000C947E000C947E0095 \n" +
      ":00000001FF \n\n";

    var expectedOutput =
      [ 0x0c, 0x94, 0x61, 0x00, 0x0C, 0x94, 0x7E, 0x00, 0x0C, 0x94, 0x7E, 0x00, 0x0C, 0x94, 0x7E, 0x00,
        0x0c, 0x94, 0x61, 0x00, 0x0C, 0x94, 0x7E, 0x00, 0x0C, 0x94, 0x7E, 0x00, 0x0C, 0x94, 0x7E, 0x00];

    expect(ParseHexFile(input)).toEqual(expectedOutput);
  });

  it("rejects non-contiguous addresses", function() {
    var input =
      ":100000000C9461000C947E000C947E000C947E0095 \n" +
      ":108888000C9461000C947E000C947E000C947E0095 \n" +
      ":00000001FF \n\n";

    // "0000 and 8888 are not contiguous addresses");
    expect(ParseHexFile(input)).toEqual("FAIL");
  });

  it("rejects file with missing EOF", function() {
    var input =
      ":100000000C9461000C947E000C947E000C947E0095";

    expect(ParseHexFile(input)).toEqual("FAIL");
  });

  it ("rejects non-hex chars in data", function() {
    var input =
      ":10000000XX9461000C947E000C947E000C947E0095 \n" +
      ":00000001FF \n\n";

    // XX are not hex chars
    expect(ParseHexFile(input)).toEqual("FAIL");
  });

  it("rejects data after checksum", function() {
    var input =
      ":100000000C9461000C947E000C947E000C947E0095xxxxxx\n" +
      ":00000001FF \n\n";

    expect(ParseHexFile(input)).toEqual("FAIL");
  });

  it("rejects file with no startcode", function() {
    var input =
      "100000000C9461000C947E000C947E000C947E0095\n" +      
      ":00000001FF \n\n";

    // Missing ":"
    expect(ParseHexFile(input)).toEqual("FAIL");
  });

  it("rejects file with short line", function() {
    var input =
      ":100000000C9461000C947E000C947E000C947E95 \n" +
      ":00000001FF \n\n";
    
    // only 15 data bytes (or missing checksum)
    expect(ParseHexFile(input)).toEqual("FAIL");
  });
  
  it("rejects unknown record type", function() {
    var input =
      ":100000XX0C9461000C947E000C947E000C947E0095 \n" +
      ":00000001FF \n\n";

    // XX is not a valid record type
    expect(ParseHexFile(input)).toEqual("FAIL");
  });
});
