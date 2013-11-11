Accumulators
============

The literate comments in <./accumulators.js> offer the best intro to what
the library is, how it works and how to use it.


How to use it
-------------

Installing with npm:

    npm install ...

You can also install accumulators using Bower for browser-side use:

    bower install ...

Or, just download it and include it in your page:

    <script src="path/to/accumulators.js"></script>

Running the tests

    make tests


@TODO
-----

* Register package with Bower.
* Write XHR wrapper
* Write XHR wrapper test
* Consider moving design decisions and @TODOs to the bottom of accumulators.js

@DONE

* Write test for filter()
* Write test for reject()
* Write test for take()


Design decisions
----------------

Q: should we denote end-of-source with `null` instead of a special token?
This is similar to the way Lisp [denotes end-of linked list][eol].

[eol]: http://stackoverflow.com/a/19229532

A: What happens when `Array.prototype.reduce` contains nullish values? Are they
skipped? No. So that means accumulate and reduce would have different semantics
if we used `null` to end collections. Reduce would not guarantee ending of
sources. Neither, technically does accumulate, but that is what's _supposed_
to happen at least.

---

The performance of closures vs prototypal instance creation varies wildly
between browsers and use-cases. See
<http://jsperf.com/closure-vs-prototype-access> for a rough example of how
accumulators might use prototypal methods and how they would perform.

It's clear that both prototypes and closures have optimized code paths under
certain conditions. Since accumulators only allocates once for each
transformation, the use case skews much closer to one-offs. Closure seems the
most reasonable way to go for most cases. However, `accumulatable()` allows for
prototypal inheritance and method access to be used on a case-by-case basis if
you want.

