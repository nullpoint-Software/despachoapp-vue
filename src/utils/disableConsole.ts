if (import.meta.env.PROD) {
  const noop = () => {};
  console.debug = noop;
  console.error = noop;
  console.info = noop;
  console.log = noop;
  console.table = noop;
  console.trace = noop;
  console.warn = noop;
}
