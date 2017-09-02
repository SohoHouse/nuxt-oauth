**nuxt-outh** Simple OAuth2 integration for your Nuxt app

[![CircleCI](https://circleci.com/gh/samtgarson/nuxt-oauth.svg?style=svg)](https://circleci.com/gh/samtgarson/nuxt-oauth)

### Get Setup

1. Install the dependency:
```bash
yarn add nuxt-oauth
```

2. Add to your nuxt.config.js and configure:
```js
// nuxt.config.js

modules: ['nuxt-oauth'],
oauth: {
  sessionName: 'mySession',
  secretKey: process.env.SECRET_KEY // used to sign encrypted cookie
  oauthHost: process.env.OAUTH_HOST,
  oauthClientID: process.env.OAUTH_CLIENT_ID,
  oauthClientSecret: process.env.OAUTH_CLIENT_SECRET,
}
```

### Use in your application

- Mark your authenticated components:
```js
// secret.vue

export default {
    authenticated: true,
    name: 'MySecretComponent'
}
```

- Use the access token as you'd like from the Vuex store:
```js
// any-component.vue

export default {
    mounted () {
        const { accessToken } = this.$store.state.oauth
        // fetch more details from somewhere...
    }
}
```

### Develop

```bash
git clone git@github.com:samtgarson/nuxt-oauth.git
cd nuxt-oauth
yarn
yarn test

// To use while developing other apps:
yarn link
cd ../my-other-app
yarn link nuxt-oauth
```

### Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/samtgarson/nuxt-oauth. This project is intended to be a safe, welcoming space for collaboration, and contributors are expected to adhere to the [Contributor Covenant](http://contributor-covenant.org) code of conduct.

### Thanks

- Many thanks to [Evan You](https://github.com/yyx990803) and the [VueJS](https://github.com/vuejs) team for sustaining such a vibrant and supportive community around Vue JS
- Many thanks also [Alex Chopin](https://github.com/alexchopin), [Sébastien Chopin](https://github.com/Atinux), [Pooya Parsa](https://github.com/pi0) and the other [Nuxt](https://github.com/nuxt) contributors for creating this awesome library

### License

The module is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).
