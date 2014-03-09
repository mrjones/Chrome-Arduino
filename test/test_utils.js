// Handles the fact that phantomjs doesn't seem to have "bind"
if (!Function.prototype.bind) {
  Function.prototype.bind = function (oThis) {
    if (typeof this !== "function") {
      // closest thing possible to the ECMAScript 5 internal IsCallable function
      throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
    }

    var aArgs = Array.prototype.slice.call(arguments, 1), 
    fToBind = this, 
    fNOP = function () {},
    fBound = function () {
      return fToBind.apply(this instanceof fNOP && oThis
                                 ? this
                           : oThis,
                           aArgs.concat(Array.prototype.slice.call(arguments)));
    };

    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();

    return fBound;
  };
}

var commonMatchers = {
  toBeOk: function() {
    this.message = function() {
      return "Status not OK. Message: '" + 
        this.actual.errorMessage() + "'";
    }

    return this.actual.ok() &&
      this.actual.errorMessage() == null;
  },

  toBeError: function() {
    this.message = function() {
      return "Expected status to be error, but was OK.";
    };
    return !this.actual.ok();
  },
};

var genData = function(length) {
  var a = [];
  for (var i = 0; i < length; ++i) {
    a.push(i);
  }
  return a;
}


var MemBlock = function(size) {
  this.size_ = size;
  this.cursor_ = -1;
  this.data_ = new Array(size);
}

MemBlock.prototype.seek = function(address) {
  this.cursor_ = address;
}

MemBlock.prototype.write = function(data) {
  for (var i = 0; i < data.length; ++i) {
    this.data_[this.cursor_++] = data[i];
  }
}

MemBlock.prototype.read = function(n) {
  var accum = new Array(n);
  for (var i = 0; i < n; ++i) {
    accum[i] = this.data_[this.cursor_++];
  }
  return accum;
}

// -----

var ExactReply = function(reply) {
  this.reply_ = reply;
}

ExactReply.prototype.handle = function(unusedPayload) {
  return this.reply_;
}


var ExactMatcher = function(target) {
  this.target_ = target;
}

ExactMatcher.prototype.matches = function(candidate) {
  var hexCandidate = binToHex(candidate);
  if (hexCandidate.length != this.target_.length) {
    return false;
  }

  for (var i = 0; i < this.target_.length; ++i) {
    if (this.target_[i] != hexCandidate[i]) {
      return false;
    }
  }

  return true;
}


var PrefixMatcher = function(target) {
  this.target_ = target;
}

PrefixMatcher.prototype.matches = function(candidate) {
  var hexCandidate = binToHex(candidate);

  if (hexCandidate.length <= this.target_.length) {
    return false;
  }

  for (var i = 0; i < this.target_.length; ++i) {
    if (this.target_[i] != hexCandidate[i]) {
      return false;
    }
  }

  return true;
};

