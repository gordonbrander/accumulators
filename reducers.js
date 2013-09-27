// Reducers
// -----------------------------------------------------------------------------
// Ok, I'm starting to see how reducers and continuation passing style are
// similar. Reducers moves the mechanics out into a reducible's reduce method.
// That way you're authoring functions with return values.
// 
// And I'm starting to run into map-reduce like problems with my image loader.
// It stands to reason that you would handle this type of deep asyncronicity
// with a flatten method.

// https://github.com/Gozala/reducers/
// https://github.com/Gozala/reducible

function partial(lambda) {
  /**
  Function composes new function out of given `lambda` with rest of the
  arguments curried.

  ## Example

  function sum(x, y) { return x + y }
  var inc = partial(sum, 1)

  inc(5) // => 6
  **/
  var slicer = Array.prototype.slice;
  var curried = slicer.call(arguments, 1);

  function partiallyApplied() {
    var args = slicer.call(arguments);
    args.unshift.apply(args, curried);
    return lambda.apply(this, args);
  }

  return partiallyApplied;
}

function reducible(reduce) {
  /*
  Define a new reducible. A reducible is any object with a reduce method.
  The mechanics of _how_ the reduction happens are left up to the `reduce`
  method.
  */
  return { reduce: reduce };
}

function reduced(value) {
  /* Box value to mark it reduced (finished reducing).
  Returns a box object containing value. */
  return {
    value: value,
    is: reduced
  }
}

function isReduced(value) {
  /* Check if a value has been boxed with `reduced()`. */
  return value && value.is === reduced;
}

function isError(thing) {
  return thing instanceof Error;
}

function wrapReducer(next) {
  /* 
  Transforms reducer functions, allowing them to ignore the mechanics of
  reduction.

  New reducer function will:

  * Guard against multiple reductions (should never happen) by throwig an exception
    when they occur.
  * End reduction when it encounters an error. Errors are always used by source
    to mark proper end of reduction, or broken reductions.

  Returns a new reducer function.
  */

  // Closure variable keeps track of whether reduction has already happened on
  // the source that is being reduced.
  var isEnded = false;

  function forward(accumulated, item) {
    // After a source is ended, it should not send further items. Throw an
    // exception if further items are sent.
    if (isEnded) throw new Error('Source attempted to send item after it ended');

    // Note that `next` will also recieve errors, including errors marking end
    // of reduction. Be sure to accomodate that in your reducers.
    accumulated = next(accumulated, item);

    // If sent `value` is a special `end` error indicating "proper end of
    // reducible" or an error type value indicating "broken end of
    // reducible", return boxed accumulated value and mark reduction finished.
    if (isEnded = isError(item)) return reduced(accumulated);

    // If `reducible` was interrupted by reducer passing back `reduced(result)`
    // mark isEnded true. It's not supposed to send any more data, instead it
    // supposed to end with or without an error.
    isEnded = isReduced(accumulated);

    return accumulated;
  }

  return forward;
}

function reduce(reducible, next, initial) {
  // Reduces any reducible object, transforming the `next` function.
  return reducible.reduce(wrapReducer(next), initial);
}

function transform(lambda, source, additional) {
  /**
  Convenience function to simplify definitions of transformation function, to
  avoid manual definition of `reducible` results and currying transformation
  function.

  From a pure data `lambda` function that is called on each value for a
  collection with following arguments:

  1. `additional` - Options passed to the resulting transformation function
  most commonly that's a function like in `map(source, f)`.
  2. `next` - Function which needs to be invoked with transformed value,
  or simply not called to skip the value.
  3. `accumulated` - Accumulate value.
  4. `item` - Last value emitted by a collection being reduced.

  Function is supposed to return new, accumulated `result`. It may either
  pass mapped transformed `value` and `result` to the `next` continuation
  or skip it.

  For example see `map` and `filter` functions.
  **/

  // Return a new reducible object who's reduce method transforms the `next`
  // reducing function.
  // 
  // `next` is the reducer function we are transforming. We are essentially
  // wrapping it with `lambda` provided the value is not an error.
  return reducible(function reduceTransform(next, initial) {
    return reduce(source, function sourceReducer(accumulated, item) {
      // If value is an error just propagate through to reducing function,
      // otherwise call `lambda` with all the curried `additional` and `next`
      // continuation function.
      return isError(item) ? next(accumulated, item) :
             lambda(additional, next, accumulated, item)
    });
  });
}

var map = partial(transform, function mapTransform(mapper, next, accumulated, item) {
  /**
  Returns transformed version of given `source` where each item of it
  is mapped using `f`.

  ## Example

  var data = [{ name: "foo" }, { name: "bar" }]
  var names = map(data, function(item) { return item.name })
  print(names) // => < "foo" "bar" >
  **/
  return next(accumulated, mapper(item));
});

function merge(source) {
  /**
  Merges given collection of collections to a collection with items of
  all nested collections. Note that items in the resulting collection
  are ordered by the time rather then index, in other words if item from
  the second nested collection is deliver earlier then the item
  from first nested collection it will in appear earlier in the resulting
  collection.

  merge([ [1, 2], [3, 4] ])
  => < 1 2 3 4 >
  **/
  return reducible(function accumulateMerged(next, initial) {
    // Closure variables that `forward` has access to.
    var open = 1;
    var accumulated = initial;

    function forward(_, item) {
      if (isError(item)) {
        open = open - 1;
        if (open === 0) return next(accumulated, item);
      }
      else {
        accumulated = next(accumulated, item);
      }
      return accumulated;
    }

    return reduce(source, function accumulateMergeSource(_, nested) {
      // If there is an error or end of `source` collection just pass it
      // to `forward` it will take care of detecting whether it's error
      // or `end`. In later case it will also figure out if it's `end` of
      // result to and act appropriately.
      if (isError(nested)) return forward(null, nested);
      // If `nested` item is not end nor error just `accumulate` it via
      // `forward` that keeps track of all collections that are bing forwarded
      // to it.
      open = open + 1
      return reduce(nested, forward, null)
    })
  });
}

function add_(array, item) {
  array.push(item);
  return array;
}

function into(reducible, array) {
  return reduce(reducible, add_, array || []);
}