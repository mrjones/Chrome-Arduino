function RealClock() {

};


RealClock.prototype.nowMillis = function() {
  return new Date().getTime();
}
