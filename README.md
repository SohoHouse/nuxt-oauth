![nuxt-oauth](https://raw.githubusercontent.com/feathericons/feather/master/icons/lock.svg?sanitize=true)

**nuxt-oauth** Simple OAuth2 integration for your Nuxt app

[![CircleCI](https://circleci.com/gh/samtgarson/nuxt-oauth.svg?style=svg)](https://circleci.com/gh/samtgarson/nuxt-oauth)

- [Usage](#usage)
  - [Get Setup](#get-setup)
  - [Use in your application](#use-in-your-application)
  - [Configuration](#configuration)
  - [Helpers](#helpers)
  - [With your tests](#with-your-tests)
- [Develop](#develop)
  - [Contributing](#contributing)
  - [Thanks](#thanks)
  - [License](#license)

## Usage

### Get Setup

1. Install the dependency:
```bash
yarn add nuxt-oauth
```

2. Add to your `nuxt.config.js` and configure:
```js
// nuxt.config.js

modules: ['nuxt-oauth'],
oauth: {
  sessionName: 'mySession',
  secretKey: process.env.SECRET_KEY,
  oauthHost: process.env.OAUTH_HOST,
  oauthClientID: process.env.OAUTH_CLIENT_ID,
  oauthClientSecret: process.env.OAUTH_CLIENT_SECRET,
  getOauthHost: req => req.params.oauth_host,
  onLogout: (req, res) => {
    // do something after logging out
  },
  fetchUser: (accessToken, request) => {
    // do something to return the user
    const user = User.findByToken(accessToken, request)
    return user
  }
}
```


### Use in your application

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

- Mark your authenticated page components (`nuxt-oauth` will ensure users are logged in before accessing these pages):
```js
// secret.vue

export default {
  authenticated: true,
  name: 'MySecretComponent'
}
```

### Configuration

| Option | Required? | Description |
| :----- | :-------- | :---------- |
| `sessionName` | * | Configure the name of the cookie that nuxt-oauth uses |
| `secretKey` | * | Provide a secret key to sign the encrypted cookie. Do not leak this! |
| `oauthHost` | * | Host of your OAuth provider _(usually ending in `oauth` or `oauth2`)_ |
| `oauthClientID` | * | Client ID of your application, registered with your OAuth provider |
| `oauthClientSecret` | * | Client ID of your application, registered with your OAuth provider |
| `getOauthHost` |  | Optional hook to define `oauthHost` at runtime, which falls back to `oauthHost` in case of error. _Receives args `(req)`._ |
| `scopes` |  | An array of scopes to authenticate against |
| `authorizationPath` |  | The path to redirect users to authenticate _(defaults to `/authorize`)_ |
| `accessTokenPath` |  | The path to request the access token _(defaults to `/token`)_ |
| `onLogout` | | Optional hook which is called after logging out. E.g. can be used to perform a full log out on your OAuth provider. _Receives args `(req, res, redirectUrl)`.  Can be asynchronous (or return a promise)._ |
| `fetchUser` | | Optional hook which is called when logging in to fetch your user object. _Receives args `(accessToken, request, options)`._ |
| `testMode` | | Flag which tells the module to ignore the OAuth dance and log every one in _(see [here](#with-your-tests) for more)_. |
  
### Helpers

You can also use the functionality manually. `nuxt-oauth` injects the following helpers into your store, components and `ctx.app`: `$login` and `$logout`. Use these to manually log your user in or out. 

Following a successful login/logout, your user will be redirected back to the page from which the helper was called (you can pass a `redirectUrl` to the helpers to override this). For a full example, see below.


```html
<!-- any-component.vue -->

<template>
  <a @click="logout" v-if="loggedIn">Log Out</a>
  <a @click="login" v-else>Log In</a>
</template>

<script>
  export default {
    asyncData({ app }) {
      // Use from context
      app.$login()
    }
    computed () {
      loggedIn () {
        return this.$store.state.oauth.accessToken
      }
    },
    methods: {
      login () {
        // defaults to redirecting back to the current page
        this.$login()
      },
      logout () {
        // customise the redirrect url
        const redirectUrl = '/my-target-path'
        this.$logout(redirectUrl)
      }
    }
  }
</script>
```
  
### With your tests

Set `options.oauth.testMode` to `true` to tell the module to skip authentication. Using this, along with the `fetchUser` option, can be helpful in e2e tests to stub your test users.

## Develop

```bash
git clone git@github.com:samtgarson/nuxt-oauth.git
cd nuxt-oauth
yarn
yarn test

# To use while developing other apps:
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
