How to use it
-------------

Install

    bower install ___


Include it in your page:

    <script src="path/to/accumulators.js"></script>

@TODO

Running the tests

    make tests


@TODO
-----

* Register package with Bower.
* Write test for filter()
* Write test for reject()
* Write XHR wrapper
* Write XHR wrapper test
* Consider moving design decisions and @TODOs to the bottom of accumulators.js

@DONE

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

The performance of closures vs prototypal instance creation for one-off cases
varies wildly between browsers http://jsperf.com/closure-vs-prototype-access.
It's clear that both prototypes and closures have optimized code paths under
certain conditions. Since accumulators only allocates once for each
transformation, the use case skews much closer to one-offs. Closure seems the
most reasonable way to go for now. However, `accumulatable()` allows for
prototypal inheritance and method access to be used on a case-by-case basis.

