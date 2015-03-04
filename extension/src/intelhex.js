/*
 Portions copyright 2013 Julian Fernando Vidal | https://github.com/poisa/JVIntelHex
 Version 1.0

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

/**
 * Lightweight implementation of the Intel HEX format
 *
 * @param data    an array of bytes
 * @param int     byteCount Usually 16 or 32
 * @param byte    startAddress
 * @param bool    useRecordHeader Whether to prefix records with a colon ":" or not
 * @returns IntelHEX
 *
 * OR
 *
 * @param data    a string of a HEX file to be parsed
 * @returns IntelHEX
 */
function IntelHEX(data, byteCount, startAddress, useRecordHeader)
{
    this.data = data;
    if (arguments.length > 1) {
      this.byteCount = byteCount;
      this.startAddress = startAddress;
      this.records = [];
      this.useRecordHeader = useRecordHeader;
    } else {
      this.records = data.split("\n");
    }

    this.RECORD_TYPE_DATA = '00';
    this.RECORD_TYPE_EOF  = '01';
};

IntelHEX.prototype.createRecords = function()
{
    if (!this.records.length) {
      var data = this.data;
      var offset = 0;
      var currentAddress = this.startAddress;

      while (data.length > 0) {

          currentAddress = this.startAddress + offset;

          var rowByteCount = 0;
          var checksum     = 0;
          var recordData   = '';
          var record       = '';

          for (var i = 0; i < this.byteCount; i++) {
              var byte = data.shift();
              if (byte != undefined) {
                  recordData += this.decToHex(byte);
                  checksum += byte;
                  rowByteCount++;
              }
          }

          // Add MSB and LSB of address rather than entire address
          checksum += (currentAddress & 0xFF) + ((currentAddress & 0xFF00) >> 8);
          checksum += parseInt(this.RECORD_TYPE_DATA, 16);
          checksum += rowByteCount;

          if (this.useRecordHeader) {
              record += ':';
          }

          record += this.decToHex(rowByteCount) +
                    this.decToHex(currentAddress, 4) +
                    this.decToHex(this.RECORD_TYPE_DATA) +
                    recordData +
                    this.decToHex(this.calculateChecksum(checksum));

          record = record.toUpperCase();
          this.records.push(record);

          // Calculate next address
          offset += rowByteCount;
      }

      // Create EOF record
      record = '';
      if (this.useRecordHeader) {
          record += ':';
      }
      record += '00' +                 // byte count
                '0000' +               // address
                this.RECORD_TYPE_EOF + // record type
                'FF';                  // checksum

      this.records.push(record);
    }
};

/**
 * Calculate the checksum for the passed data. The checksum is basically
 * the two's complement of just the 8 LSBs.
 *
 * @param int data
 * @returns int
 */
IntelHEX.prototype.calculateChecksum = function(data)
{
    checksum = data;
    checksum = checksum & 255; // grab 8 LSB
    checksum = ~checksum + 1;  // two's complement
    checksum = checksum & 255; // grab 8 LSB
    return checksum;
};

/**
 * Converts a decimal number to an hexadecimal string including leading 0s if required
 *
 * @param int d         Decimal number
 * @param int padding   Required padding (optional)
 * @returns string
 */
IntelHEX.prototype.decToHex = function(d, padding)
{

    var hex = Number(d).toString(16);
    padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;

    while (hex.length < padding) {
        hex = "0" + hex;
    }

    return hex;
};

IntelHEX.prototype.hexToDec = function(h) {
  if (!h.match("^[0-9A-Fa-f]*$")) {
    console.log("Invalid hex chars: " + h);
    return -1;
  }
  return parseInt(h, 16);
}

IntelHEX.prototype.hexCharsToByteArray = function(hc) {
  if (hc.length % 2 != 0) {
    console.log("Need 2-char hex bytes");
    return -1; // :(
  }

  var bytes = [];
  for (var i = 0; i < hc.length / 2; ++i) {
    var hexChars = hc.substring(i * 2, (i * 2) + 2);
    var byte = this.hexToDec(hexChars);
    if (byte == -1) {
      return -1;
    }
    bytes.push(byte);
  }
  return bytes;
}

/**
 * Returns a formatted HEX string that can be saved to a HEX file.
 *
 * Eg:
 *  :10C00000576F77212044696420796F7520726561CC
 *  :10C010006C6C7920676F207468726F756768206137
 *  :10C020006C6C20746869732074726F75626C652023
 *  :10C03000746F207265616420746869732073747210
 *  :04C040007696E67397
 *  :00000001FF

 * @param string lineSeparator
 * @returns string
 */
IntelHEX.prototype.getHEXFile = function(lineSeparator)
{
    if (typeof lineSeparator === 'undefined') {
        lineSeparator = "\n";
    }

    returnValue = '';
    for (i = 0; i < this.records.length; i++) {
       returnValue += this.records[i] + lineSeparator;
    }
    return returnValue;
};

/**
 * Returns all the data in a big array of bytes.
 *
 * Eg:
 *    array(32, 1, 255, 34, 15, etc, etc);
 *
 * @returns array
 */
IntelHEX.prototype.getHEXAsByteArray = function()
{
    var data = this.getHEXFile('').replace(/:/g, '');
    var dataLength = data.length;

    byteArray = [];

    for (i = 0; i < dataLength; i += 2) {
        byte = data[i] + data[i + 1];
        byteArray.push(parseInt(byte, 16));
    }
    return byteArray;
};

/**
 * Returns all the data as a string of 1s and 0s
 *
 * Eg:
 *    10000111001000101010101111111010000, etc, etc
 *
 * @param bool prettyOutput Wheter to format the string with human readable spaces
 * @returns string
 */
IntelHEX.prototype.getHEXAsBinaryString = function(prettyOutput)
{
    if (typeof prettyOutput === 'undefined') {
        prettyOutput = false;
    }

    byteArray = this.getHEXAsByteArray();
    byteArrayLength = byteArray.length;
    binaryString = '';

    for (var currentByte = 0; currentByte < byteArrayLength; currentByte++)
    {
        for (var currentBit = 7; currentBit >= 0; currentBit--) {
            var bitMask = 1 << currentBit;
            if (byteArray[currentByte] & bitMask) {
                binaryString += '1';
            } else {
                binaryString += '0';
            }

            if (currentBit == 4 && prettyOutput) {
                binaryString += ' ';
            }

        }
        if (prettyOutput) {
            binaryString += '  ';
        }
    }

    return binaryString;
};

IntelHEX.prototype.parse = function() {
  var kStartcodeBytes = 1;
  var kSizeBytes = 2;
  var kAddressBytes = 4;
  var kRecordTypeBytes = 2;
  var kChecksumBytes = 2;

  var inputLines = this.records;

  var out = [];

  var nextAddress = 0;

  for (var i = 0; i < inputLines.length; ++i) {
    var sum = 0;
    var line = inputLines[i];

    //
    // Startcode
    //
    if (line[0] != ":") {
      console.log("Bad line [" + i + "]. Missing startcode: " + line);
      return "FAIL";
    }

    //
    // Data Size
    //
    var ptr = kStartcodeBytes;
    if (line.length < kStartcodeBytes + kSizeBytes) {
      console.log("Bad line [" + i + "]. Missing length bytes: " + line);
      return "FAIL";
    }
    var dataSizeHex = line.substring(ptr, ptr + kSizeBytes);
    ptr += kSizeBytes;
    var dataSize = this.hexToDec(dataSizeHex);
    sum += dataSize;

    //
    // Address
    //
    if (line.length < ptr + kAddressBytes) {
      console.log("Bad line [" + i + "]. Missing address bytes: " + line);
      return "FAIL";
    }
    var addressHex = line.substring(ptr, ptr + kAddressBytes);
    ptr += kAddressBytes;
    var address = this.hexToDec(addressHex);
    sum += this.hexCharsToByteArray(addressHex).reduce(function(a,b){return a+b;});


    //
    // Record Type
    //
    if (line.length < ptr + kRecordTypeBytes) {
      console.log("Bad line [" + i + "]. Missing record type bytes: " + line);
      return "FAIL";
    }
    var recordTypeHex = line.substring(ptr, ptr + kRecordTypeBytes);
    ptr += kRecordTypeBytes;
    sum += this.hexToDec(recordTypeHex);

    //
    // Data
    //
    var dataChars = 2 * dataSize;  // Each byte is two chars
    if (line.length < (ptr + dataChars)) {
      console.log("Bad line [" + i + "]. Too short for data: " + line);
      return "FAIL";
    }
    var dataHex = line.substring(ptr, ptr + dataChars);
    ptr += dataChars;
    if (dataHex) {
      sum += this.hexCharsToByteArray(dataHex).reduce(function(a,b){return a+b;});
    }

    //
    // Checksum
    //
    if (line.length < (ptr + kChecksumBytes)) {
      console.log("Bad line [" + i + "]. Missing checksum: " + line);
      return "FAIL";
    }
    var checksumHex = line.substring(ptr, ptr + kChecksumBytes);
    var checksumCalc = this.decToHex(this.calculateChecksum(sum)).toUpperCase();

    if (checksumCalc != checksumHex) {
      console.log("Bad checksum '" + checksumHex + "' on line [" + i + "]. Expected '" + checksumCalc + "'");
      return "FAIL";
    }

    //
    // Permit trailing whitespace
    //
    if (line.length > ptr + kChecksumBytes + 1) {
      var leftover = line.substring(ptr, line.length);
      if (!leftover.match("$\w+^")) {
          console.log("Bad line [" + i + "]. leftover data: " + line);
          return "FAIL";
      }
    }

    if (recordTypeHex == this.RECORD_TYPE_EOF) {
      return out;
    } else if (recordTypeHex == this.RECORD_TYPE_DATA) {
      if (address != nextAddress) {
        console.log("I need contiguous addresses");
        return "FAIL";
      }
      nextAddress = address + dataSize;

      var bytes = this.hexCharsToByteArray(dataHex);
      if (bytes == -1) {
        console.log("Couldn't parse hex data: " + dataHex);
        return "FAIL";
      }
      out = out.concat(bytes);
    } else {
      console.log("I can't handle records of type: " + recordTypeHex);
      return "FAIL";
    }
  }

  console.log("Never found EOF!");
  return "FAIL";
}

exports.IntelHEX = IntelHEX;
