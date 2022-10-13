/**
 * Wraps a function with console logging for it's lifecycle
 * Logs:
 * 1) Called with parameters
 * 2) Returned value
 * 3) Any errors thrown
 * 
 * @param { Function } impl - The function to be wrapped
 * @return { Function } The wrapped function with original `this` context
 */
 const logWrapper = (impl) => {
  const name = impl.name || 'Anonymous'

  return async (...args) => {
    console.log(`${name} called with`, ...args)

    try {
      const value = await impl(...args)
      console.log(`${name} returned`, value)
      return value
    } catch (value) {
      console.log(`${name} threw error`, value)
      throw value
    }
  }
}

/**
 * Takes an object an applies a wrapper function to each method on the
 * object recursively
 *
 * @param { Function } fn - A wrapper function
 * @param { Object } options - Options
 * @param { String[] } [options.exclude = []] - List of method names to be excluded
 * @param { Object } o - An object with methods to be wrapped
 * @return { Object }
 */
const decorateWith = (fn, {
  exclude = [],
} = {},  o) => {
	const obj = o.prototype || o
  
  for (let method in obj)
  {
    const originalFn = obj[method]
    const isFunction = typeof originalFn === 'function'
    const isExcluded = exclude.includes(method)

  	if( !isExcluded && isFunction ){
      obj[method] = fn(obj[method]);
    } else if (typeof originalFn === 'object') {
      decorateWith(fn, originalFn)
    }
  }
}

module.exports = {
  decorateWith,
  logWrapper,
}
