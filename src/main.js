export meta from '../package.json'

export default (moduleOptions) => {
  const options = { ...this.options.oauth, moduleOptions }

  return options
}
