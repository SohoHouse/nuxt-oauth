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

3. Mark your authenticated components:
```js
// secret.vue

export default {
    authenticated: true,
    name: 'MySecretComponent'
}
```

4. Use the access token as you'd like from the Vuex store:
```js
// any-component.vue

export default {
    mounted () {
        const { accessToken } = this.$store.state.oauth
        // fetch more details from somewhere...
    }
}
```
