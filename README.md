![nuxt-oauth](https://feathericons.com/node_modules/feather-icons/dist/icons/lock.svg)

**nuxt-outh** Simple OAuth2 integration for your Nuxt app

[![CircleCI](https://circleci.com/gh/samtgarson/nuxt-oauth.svg?style=svg)](https://circleci.com/gh/samtgarson/nuxt-oauth)

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
  onLogout: (req, res) => {
    // do something after logging out
  },
  fetchUser: (accessToken) => {
    // do something to return the user
    const user = User.findByToken(accessToken)
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

- Mark your authenticated page components:
```js
// secret.vue

export default {
  authenticated: true,
  name: 'MySecretComponent'
}
```

- Or, manually log in:
```html
// any-component.vue
<template>
  <a @click="login">Log In</a>
</template>
<script>
  export default {
    methods: {
      login () {
        const redirectUrl = this.$route.path 
        // Or another path to return to after logging in
        this.$router.push(`/auth/login?redirect-url=${redirectUrl}`)
      }
    }
  }
</script>
```

### Configuration

| Option | Required? | Description |
| :----- | :-------- | :---------- |
| `sessionName` | * | Configure the name of the cookie that nuxt-oauth uses |
| `secretKey` | * | Provide a secret key to sign the encrypted cookie. Do not leak this! |
| `oauthHost` | * | Host of your OAuth provider |
| `oauthClientID` | * | Client ID of your application, registered with your OAuth provider |
| `oauthClientSecret` | * | Client ID of your application, registered with your OAuth provider |
| `onLogout` | | Optional hook which is called after logging out. E.g. can be used to perform a full log out on your OAuth provider. Receives args `(req, res, redirectUrl)`.  Can be asynchronous (or return a promise). |
| `fetchUser` | | Optional hook which is called when logging in to fetch your user object. Receives args `(accessToken)`. |
  
### Manual Usage

- **Log In**
  
  Redirect to `/auth/login?redirect-uri=REDIRECT_URL` where `REDIRECT_URL` is the URL you'd like to be redirected back to after successfully logging in.

- **Log Out**
  
  Redirect to `/auth/logout?redirect-uri=REDIRECT_URL` where `REDIRECT_URL` is the URL you'd like to be redirected back to after successfully logging out.

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
