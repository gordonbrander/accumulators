// Accumulators
// =============================================================================
// 
// A tiny library for reactive programming that offers blazing fast generic
// collection manipulation, asyncronous flow control and the ability to
// represent infinitely large collections.
// 
// Copyright Gordon Brander, 2013. Released under the terms of the [MIT license](http://opensource.org/licenses/MIT).
// 
// Background:
// 
// * [Reducers - A Library and Model for Collection Processing](http://clojure.com/blog/2012/05/08/reducers-a-library-and-model-for-collection-processing.html)
// * [Anatomy of a Reducer](http://clojure.com/blog/2012/05/15/anatomy-of-reducer.html)
// 
// Prior art:
// 
// * https://github.com/Gozala/reducers/
// * https://github.com/Gozala/reducible/
// 
// What & How
// ----------
// 
// This file is just a tiny JavaScript implementation of [Clojure Reducers](http://clojure.com/blog/2012/05/08/reducers-a-library-and-model-for-collection-processing.html).
// 
// Reducers are an answer to the question: "what is the minimum necessary
// interface for a collection?". A collection is anything that can be
// `reduce`d, because `reduce` can produce any other value from a collection.
// In JS, we might say a collection is any object with a `reduce` method.
// This simple idea has _awesome_ consequences...
// 
// With such a small interface, custom collection types can be created simply by
// defining a method called `reduce` that describes how to step through the
// collection and accumulate a value. Want to mix a typed array and a linked
// list? No problem. Simply define a `reduce` for each and mix away.
// 
// What about `map`, `filter`, `concat` and friends? We can define them
// as function transformations of the _reducer_ function (the function you
// give to `reduce` describing the recipe for reduction). `map`, `filter`, et al
// will actually return a transformed function instead of an array. The work is
// done when we pass the resulting function to `reduce`. This has the happy
// effect of making large collection manipulations very fast because no
// intermediate representation of the collection is created in memory.
// 
// The _reducer_ function can be called at any time by `reduce`, so if we take
// away the requirement for `reduce` to return a value, we can even represent
// _asyncronous_ collections.
// 
// Why would we want to do this?
// 
// * If items can appear during multiple turns of the event loop, you can
//   represent _infinitely long streams_.
// * An async collection can be used to control a flow of events, because
//   after all, events are just a sequence of "things over time". So:
//   we can program in the 4th dimension, mapping, filtering
//   and transforming events over time.
//
// Pretty useful. So an accumulable is any object that implements a special
// **accumulate** method, which is the same as `reduce`, but is not required to
// return a value. If the object doesn't have an accumulate method, we fall back
// to `reduce` (as in the case of arrays).

// The basics
// ----------
// 
// The base implementation: helpers for defining and
// duck-typing accumulatables, and an `accumulate` function.
//
// ---

// Create namespaced key.
var __accumulate__ = 'accumulate@accumulators';

// An `accumulatable` is any object with an accumulate method at the namespaced key.
// Creates a new accumulatable source by assigning the `accumulate` method to
// the correct namespaced key on an object.
// 
// The mechanics of _how_ the accumulation happens are left up to the
// `accumulate` method.
// 
// `accumulate` takes the same arguments as `reduce` method, but it is not
// expected to return a value.
// 
//     function accumulate(next, initial) { ... }
//
// ...where `next` is a reducer function -- a function with shape:
// 
//     function next(accumulated, item) { ... }
// 
// Accumulatable sources are just a series of calls to `next` within
// `accumulate` method.
// 
// Because `accumulate` is not expected to return a value, calls to `next` by
// accumulate may happen over multiple turns of the event loop, allowing
// accumulation of async sources to happen.
// 
// Since accumulate does not return a value, we use a special `end` token to
// denote the end of a sequence (see below).
function accumulatable(accumulate, o) {
  // Use optional provided object, or create a new one.
  o = o || {};
  // Assign accumulate function to the namespaced accumulate field.
  o[__accumulate__] = accumulate;
  return o;
}
export accumulatable;


// Determine if `thing` has a function at `key`.
// Returns boolean.
function isMethodAt(thing, key) {
  return thing && typeof thing[key] === 'function';
}
export isMethodAt;


// Check if a thing is accumulatable. Returns boolean.
// Convenience wrapper for `isMethodAt()`.
function isAccumulatable(thing) {
  return isMethodAt(thing, __accumulate__);
}
export isAccumulatable;


// End is our token that represents the end of an accumulatable source.
// `accumulatable`s can pass this token as the last item to denote they are
// finished sending values. Accumulating `next` functions may also return `end`
// to denote they are finished consuming, and that no further values should
// be sent.
var end = "Token for end of accumulation @accumulators";
export end;


// Accumulate a source with a `next` reducer function and `initial` value.
// 
// Accumulate does not return any value, meaning sources may yield values at
// any turn of the event loop.
// 
// Any value type can be accumulated with `accumulate` function.
// This means async sources, arrays and primitive values can all be mixed.
function accumulate(source, next, initial) {
  // If source is accumulatable, call accumulate method.
  isAccumulatable(source) ?
    source[__accumulate__](next, initial) :
    // ...otherwise, if source has a reduce method, fall back to accumulation
    // with reduce, then call `next` with `end` token and result of reduction.
    // Reducible sources are expected to return a value for `reduce`.
    isMethodAt(source, 'reduce') ?
      next(source.reduce(next, initial), end) :
      // Otherwise, call `next` with value, then `end`.
      next(next(initial, source), end);
}
export accumulate;


// Transformations: map, filter, et al
// -----------------------------------


// Convenience function to simplify definitions of transformation function, to
// avoid manual definition of `accumulatable` results and currying transformation
// function.
// 
// From a pure data `xf` function that is called on each value for a
// collection with following arguments:
// 
// 1. `additional` - Options passed to the resulting transformation function
// most commonly that's a function like in `map(source, f)`.
// 2. `next` - Function which needs to be invoked with transformed value,
// or simply not called to skip the value.
// 3. `accumulated` - Accumulate value.
// 4. `item` - Last value emitted by a collection being accumulated.
// 
// Function is supposed to return new, accumulated `result`. It may either
// pass mapped transformed `value` and `result` to the `next` continuation
// or skip it.
// 
// For example see `map` and `filter` functions.
// 
// A riff on reducer in https://github.com/clojure/clojure/blob/master/src/clj/clojure/core/reducers.clj.
function accumulator(xf) {
  function xformed(source, additional) {
    // Return a new accumulatable object who's accumulate method transforms the `next`
    // accumulating function.
    return accumulatable(function accumulateAccumulatorTransform(next, initial) {
      // `next` is the accumulating function we are transforming. 
      accumulate(source, function sourceAccumulator(accumulated, item) {
        // We are essentially wrapping next with `xf` provided the `item` is
        // not `end`.
        return item === end ? next(accumulated, item) :
                              xf(additional, next, accumulated, item);
      }, initial);
    });    
  }

  return xformed;
}
export accumulator;


// Returns transformed version of given `source` where each item of it
// is mapped using `f`.
// 
//     var data = [{ name: "foo" }, { name: "bar" }]
//     var names = map(data, function(item) { return item.name })
//     // <"foo", "bar">
var map = accumulator(function mapTransform(mapper, next, accumulated, item) {
  return next(accumulated, mapper(item));
});
export map;


// Composes filtered version of given `source`, such that only items contained
// will be once on which `f(item)` was `true`.
// 
//     var digits = filter([ 10, 23, 2, 7, 17 ], function(value) {
//       return value >= 0 && value <= 9
//     })
//     // <2, 7>
var filter = accumulator(function filterTransform(predicate, next, accumulated, item) {
  return predicate(item) ? next(accumulated, item) : accumulated;
});
export filter;


// Transform an accumulate function, handling and enforcing "end of source"
// scenarios so it may only be accumulated once. This is useful for defining
// sources that don't have in-memory representation of their complete source
// (e.g. event emitters, infinite collections) and so can not "rewind" to
// accumulate from the beginning. Example:
// 
//     accumulatable(accumulatesOnce(function (next, initial) { ... }))
// 
// Returns an accumulate function.
function accumulatesOnce(accumulate) {
  // Closure variables keeps track of whether source has already ended or
  // is in the process of being accumulated.
  var isEnded = false;
  var isAccumulating = false;

  function accumulateOnce(next, initial) {
    function nextUntilEnd(accumulated, item) {
      // After a source has been ended, it should not send further items. Throw
      // an exception if further items are sent.
      if (isEnded) throw new Error('Source attempted to send item after it ended');

      // If item isn't end-of-source token, accumulate item with `next`.
      // If item is end-of-source token, keep accumulated value from last
      // accumulate step.
      accumulated = (item === end) ? accumulated : next(accumulated, item);

      // If item is end token, source is ended.
      // Likewise, if accumulator passed back end token, source is ended.
      isEnded = (item === end || accumulated === end);

      // Return reduction.
      return accumulated;
    }

    // If accumulation for this source was already ended or is in-progress,
    // throw an exception.
    if(isEnded || isAccumulating)
      throw new Error('Accumulation attempted after source was ended');

    // Mark accumulation in-progress.
    isAccumulating = true;

    // Otherwise accumulate until `end`!
    accumulate(nextUntilEnd, initial);
  }

  return accumulateEndable;
}


function append(left, right) {
  return accumulatable(function accumulateAppend(next, initial) {
    function accumulatorLeft(accumulated, item) {
      return item === end ? accumulate(right, next, accumulated) : next(accumulated, item);
    }

    accumulate(left, accumulatorLeft, initial);
  });
}
export append;


// Concatenate a 2D source of sources, returning a new accumulatable 1D source
// where items are ordered by source order.
// 
//     concat([[1, 2, 3], ['a', 'b', 'c']])
//     // <1, 2, 3, 'a', 'b', 'c'>
function concat(source) {
  return accumulatable(function accumulateConcat(next, initial) {
    function appendAccumulator(a, b) {
      if(b === end) return accumulate(a, next, initial);

      return a === null ? b : append(a, b);
    }

    accumulate(source, appendAccumulator, null);
  });
}
export concat;


// Merge a 2D source of sources, returning a new accumulatable 1D source,
// where items are ordered by time. In pseudo-code:
// 
//     merge(<<1, 2, 3>, <'a', 'b', 'c'>>)
//     // <1, 'a' 2, 3, 'b', 'c'>
function merge(source) {
  return accumulatable(function accumulateMerge(next, initial) {
    var accumulated = initial;
    var open = 1;

    function forward(_, item) {
      if (item === end) {
        open = open - 1;
        if (open === 0) return next(accumulated, end);
      }
      else {
        accumulated = next(accumulated, item);
      }
      return accumulated;
    }

    accumulate(source, function accumuateMergeSource(_, nested) {
      // If we have reached the end of the sources, pass end token
      // to `forward`.
      if (nested === end) return forward(null, end);

      // If `nested` item is not end, accumulate it via `forward` and record
      // that we have opened another source.
      open = open + 1;
      accumulate(nested, forward, null);
    }, null);
  });
}
export merge;


// Transform a source, reducing values from the source's `item`s using `xf`, a
// reducer function. Returns a new source containing the reductions over time.
function reductions(source, xf, initial) {
  var reduction = initial;

  // Define a `next` function for accumulation.
  function nextReduction(accumulated, item) {
    reduction = xf(reduction, item);

    return item === end ?
      next(accumulated, end) :
      // If item is not `end`, pass accumulated value to next along with
      // reduction created by `xf`.
      next(accumulated, reduction);
  }

  return accumulatable(function accumulateReductions(next, initial) {
    accumulate(source, nextReduction, initial);
  });
}
export reductions;


function add_(pushable, item) {
  pushable.push(item);
  return pushable;
}


// Throttle source, making sure it only yields a value once every x ms.
// Returns an accumulatable.
function throttle(source, ms) {
  return accumulatable(function accumulateThrottled(next, initial) {
    // Stack will contain our values from stream.
    var stack = [];
    // Assign initial to closure variable.
    var accumulated = initial;

    // Start accumulating source into stack.
    accumulate(source, add_, stack);

    function throttled() {
      // If stack is currently empty, pass. Wait until next time.
      if(stack.length === 0) return;

      // At each interval, shift an item off the bottom of the stack and
      // serve it up. First in, first out.
      var item = stack.shift();

      // If item is end token, stop the interval timer.
      if(item === end) clearInterval(id);

      // Call next with accumulated and item (whatever it is).
      next(accumulated, item);
    }

    throttled();

    // Start interval timer.
    var id = setInterval(throttled, ms);
  });
}
export throttle;
