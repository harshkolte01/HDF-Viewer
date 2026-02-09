export function debounce(fn, delay = 150) {
  let timer = null;

  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
