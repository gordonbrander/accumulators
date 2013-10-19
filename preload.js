import { accumulatable, accumulatesOnce, end } from "accumulators";

function preload(src) {
  return accumulatable(accumulatesOnce(function preloadAccumulate(next, initial) {
    function handler(event) {
      next(next(initial, event), end);
    }

    var img = new Image();
    img.onload = handler;
    img.src = src;
  }));
}
export preload;

