var r = require('../node/reducers.js');
var reduce = r.reduce;
var map = r.map;
var futureReducible = r.futureReducible;
var end = r.end;

var assert = require("assert");

function sum(a, b) {
  return a + b;
}

function log(first) {
  console.log.apply(console, arguments);
  return first;
}

function makeAssertK(value) {
  return function assertK(done) {
    assert(value);
    done();
  }
}

describe('Array reduction', function () {
  var a1 = [1, 1, 1];
  var a2 = reduce(a1, sum, 0);

  it('should return immediate results', makeAssertK(a2 === 3));
});

describe('Primative reduction', function () {
  var a3 = reduce(3, function assertA2(_, sum) {
    return sum * 2;
  });

  it("should call next with value for reduction of primative values.", makeAssertK(a3 === 6))
});

describe('futureReducible reduction', function () {
  var x = futureReducible(function (next, initial) {
    var counter = 0;
    var accumulated = initial;
    var id;

    id = setInterval(function () {
      if (counter === 3) {
        next(accumulated, end);
        clearInterval(id);
      }
      else {
        accumulated = next(accumulated, counter++);
      }
    }, 1);
  });

  var a = reduce(x, function (accumulated, num) {
    return accumulated + num;
  }, 0);

  it('should return a reducible for future values', makeAssertK(typeof a.reduce === 'function'));

  it('should reduce future values to reduced value', function (done) {
    reduce(a, function (_, sum) {
      assert(sum === 3);
      done();
    });
  });

  it('should not allow multiple reductions on the same source', function(done) {
    assert.throws(function () {
      reduce(a, function(_, __) {});
    }, Error);

    done();
  });
});

describe('map', function () {
  var a = map([0, 0], function () { return 1; });

  it('should return a reducible object', makeAssertK(typeof a.reduce === 'function'));

  it('should transform values per mapping function when reduced', function (done) {
    var b = reduce(a, sum, 0);

    // ...and a second reduce for the value...
    reduce(b, function (_, sum) {
      assert(sum === 2);
      done();
    });
  });
});