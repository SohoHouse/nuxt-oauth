module.exports = {
  layout: 'public',
  authenticated: false,
  middleware () {
    if (process.client) {
      window.location.assign('/auth/logout')
    }
  },
  render () {}
}
