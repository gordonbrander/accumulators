var r = require('../node/reducers.js');
var reduce = r.reduce;
var map = r.map;

var assert = require("assert");

function sum(a, b) {
  return a + b;
}

function log(first) {
  console.log.apply(console, arguments);
  return first;
}

function test(bool, message) {
  assert(bool, message)
  return log(message);
}

log("Test arrays...");

var a1 = [1, 1, 1];
var a2 = reduce(a1, sum, 0);

test(a2 === 3, "* Array reductions return immediate results.");

var a3 = reduce(a2, function assertA2(_, sum) {
  test(sum === 3, "* Non-reducible values get passed to reducing function.");
});


log("Test map...");

var m1 = [0, 0, 0];
var m2 = map(m1, function (num) {
  return 1;
});

test(m2.reduce, "* Return value of map is reducible");

var m3 = reduce(m2, sum, 0);

test(m3.reduce, "* Return value of map reduction is reducible.");

var m4 = reduce(m3, function assertM4(_, sum) {
  test(sum === 3, "* Map transforms the source");
});
