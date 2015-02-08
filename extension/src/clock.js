var RealClock = function() { };

RealClock.prototype.nowMillis = function() {
  return new Date().getTime();
}

exports.RealClock = RealClock;
