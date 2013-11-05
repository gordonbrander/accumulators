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
// _asyncronous_ collections. In this library, we call a `reduce` that returns
// no value `accumulate`.
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
// `accumulate()` method, which is the same as `reduce()`, but is not required
// to return a value. If the object doesn't have an accumulate method, we fall
// back to `reduce` (e.g. arrays).

// The basics
// ----------
// 
// The base implementation: helpers for defining and
// duck-typing accumulatables, and an `accumulate` function.
//
// ---

// Namespace a string. Used for creating namespaced object keys that are
// unlikely to collide. Contract: returned key should always be the same given
// the same string.
function ns(string) {
  return string + '@accumulators';
}

// Create namespaced key for accumulate method.
var __accumulate__ = ns('accumulate');

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
var end = ns('Token for end of accumulation');
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
    return accumulatable(function accumulateXform(next, initial) {
      // `next` is the accumulating function we are transforming. 
      accumulate(source, function nextSource(accumulated, item) {
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


// Create namespaced keys.
var __isOpen__ = ns('isOpen');
var __consumers__ = ns('consumers');


// Internal helper function that mutates a consumer object.
// Used in `hub()` (see below).
function dispatchToConsumer_(item, consumer) {
  // If consumer has not ended of its own accord, accumulate with
  // latest item.
  if (consumer.accumulated !== end)
    consumer.accumulated = consumer.next(consumer.accumulated, item);

  return item;
}


// Some sources, like event streams, can only be accumulated once. Events in
// the source happen, but no reference is kept in memory by the source. `hub()`
// allows you to transform a source of this type so it can be accumulated
// multiple times. It does this by keeping a list of consumers and dispatching
// items in source to each of them. Usage:
// 
//     hub(accumulatable(function (next, initial) { ... }))
// 
// @TODO close source if all consumers pass back `end`. Nice to have. Probably
// not crucial for most use cases.
function hub(source) {
  // Create hub object.
  var h = {};
  // Create array to keep track of consumers.
  h[__consumers__] = [];

  return accumulatable(function accumulateHub(next, initial) {
    var hub = this;
    var consumers = hub[__consumers__];

    // Add consumer to hub.
    consumers.push({ next: next, accumulated: initial });

    // If hub is already open, we don't need to reopen it.
    if (hub[__isOpen__]) return;

    // Mark hub open.
    hub[__isOpen__] = true;

    function nextDispatch(_, item) {
      // When item comes from source, dispatch it to all consumers.
      consumers.reduce(dispatchToConsumer_, item);

      // If item is end token, empty all consumers from array. We're done.
      if (item === end) consumers.splice(0, consumers.length);
    }

    // Begin accumulation of source.
    accumulate(source, nextDispatch);
  }, h);
}
export hub;


// Given 2 sources, `left` and `right`, return a new accumulatable which will
// first accumulate `left`, then `right`. Used by `concat`.
function append(left, right) {
  return accumulatable(function accumulateAppend(next, initial) {
    function nextLeft(accumulated, item) {
      return item === end ? accumulate(right, next, accumulated) : next(accumulated, item);
    }

    accumulate(left, nextLeft, initial);
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
    function nextAppend(a, b) {
      if(b === end) return accumulate(a, next, initial);

      return a === null ? b : append(a, b);
    }

    accumulate(source, nextAppend, null);
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

    accumulate(source, function nextMerge(_, nested) {
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

  return accumulatable(function accumulateReductions(next, initial) {
    // Define a `next` function for accumulation.
    function nextReduction(accumulated, item) {
      reduction = xf(reduction, item);

      return item === end ?
        next(accumulated, end) :
        // If item is not `end`, pass accumulated value to next along with
        // reduction created by `xf`.
        next(accumulated, reduction);
    }

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


// Given any `thing`, returns `thing`. Useful for fallback.
function id(thing) {
  return thing;
}


// Sample an item from `source` every time an item appears in `triggers` source
// where `source` and `triggers` are both accumulatables. For example, sampling
// mouse move events that coencide with click events looks like this:
// 
//     sample(on(el, 'mousemove'), on(el, 'click'))
// 
// Probably only useful for sources where items appear over multiple turns
// of the event loop.
function sample(source, triggers, assemble) {
  return accumulatable(function accumulateSamples(next, initial) {
    // Assemble is a function that will be called with sample and trigger item.
    // You may specify a sample function. If you don't it will fall back to `id`
    // which will return the value of the sampled item.
    assemble = assemble || id;

    // Create closure variable to keep most recent sample.
    var sampled;

    function nextSource(_, item) {
      // Assign most recent item to closure variable.
      if(item !== end) sampled = item;
    }

    function nextTrigger(accumulated, item) {
      // Assemble sampled value with item and accumulate with `next()`.
      return next(accumulated, assemble(sampled, item));
    }

    // Begin accumulation of both sources.
    accumulate(source, nextSource);
    accumulate(triggers, nextTrigger, initial);
  });
}
export sample;


// Browser helpers: animation, DOM events, etc
// -------------------------------------------


// A wrapper for [requestAnimationFrame][raf], patching up browser support and
// preventing exceptions in non-browser environments (node).
// 
// [raf]: https://developer.mozilla.org/en-US/docs/Web/API/window.requestAnimationFrame
function requestAnimationFrame(callback) {
  // Use any available requestAnimationFrame.
  return (window.requestAnimationFrame ||
          window.mozRequestAnimationFrame ||
          window.webkitRequestAnimationFrame ||
          window.msRequestAnimationFrame)(callback);
}


// Get a stream of animation frames over time.
// Returns an accumulatable for a stream of animation frames over time.
// Each frame is represented by a framecount.
function frames(ms) {
  return accumulatable(function accumulateFrames(next, initial) {
    var accumulated = initial;
    var start = Date.now();

    function onFrame(now) {
      accumulated = next(accumulated, now);

      // If we have reached the ms count for frames, end the source.
      if (ms && ((now - start) >= ms)) return next(accumulated, end);
      // If consumer ends source, stop requesting frames.
      if (accumulated !== end) return requestAnimationFrame(onFrame);
    }

    requestAnimationFrame(onFrame);
  });
}
export frames;


// Open a source representing events over time on an element.
// Returns an accumulatable source.
function on(element, event) {
  // Since we want to avoid opening up multiple event listeners on the element,
  // we use `hub()` to allow for multiple reductions of one source.
  return hub(accumulatable(function accumulateEventListener(next, initial) {
    var accumulated = initial;

    function listener(event) {
      accumulated = next(accumulated, event);
      if(accumulated === end) element.removeEventListener(listener);
    }

    element.addEventListener(event, listener);
  }));
}
export on;
