var r = require('../node/reducers.js');
var reduce = r.reduce;
var map = r.map;
var futureReducible = r.futureReducible;
var isError = r.isError;

var assert = require("assert");

function sum(a, b) {
  return a + b;
}

function log(first) {
  console.log.apply(console, arguments);
  return first;
}

function assertAsync(value) {
  return function testAsync(done) {
    assert(value);
    done();
  }
}

describe('isError', function () {
  var error = new Error('Test error');
  var a = null;
  var b = true;
  var c = 1;

  it("should return true for errors", assertAsync(isError(error)));
  it("should return false for other values", assertAsync(!isError(a) && !isError(b) && !isError(c)));
});

describe('Array reduction', function () {
  var a1 = [1, 1, 1];
  var a2 = reduce(a1, sum, 0);

  it('should return immediate results', assertAsync(a2 === 3));
});

describe('Primative reduction', function () {
  var a3 = reduce(3, function assertA2(_, sum) {
    return sum * 2;
  });

  it("should call next with value for reduction of primative values.", assertAsync(a3 === 6))
});

describe('futureReducible reduction', function () {
  var x = futureReducible(function (next, initial) {
    var counter = 0;
    var accumulated = initial;
    var id;

    id = setInterval(function () {
      if (counter === 3) {
        next(accumulated, new Error('End of intervals'));
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

  it('should return a reducible for future values', assertAsync(typeof a.reduce === 'function'));

  it('should reduce future values to reduced value', function (done) {
    reduce(a, function (_, sum) {
      assert(sum === 3);
      done();
    });
  });
});