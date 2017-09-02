module.exports = {
  root: true,
  parser: 'babel-eslint',
  env: {
    browser: true,
    node: true,
    'jest/globals': true
  },
  extends: [
    'airbnb/base',
    'plugin:promise/recommended',
  ],
  // required to lint *.vue files
  plugins: [
    'jest',
    'import',
    'node',
    'promise'
  ],
  // add your custom rules here
  rules: {
    'comma-dangle': ['error', 'never'],
    'space-before-function-paren': ['error', 'always'],
    'semi': ['error', 'never'],
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,
    'no-return-assign': 'off',
    'no-confusing-arrow': 'off',
    'no-console': 'off',
    'no-multi-assign': 'off',
    'no-param-reassign': 'off',
    'global-require': 'off',
    'arrow-parens': ['error', 'as-needed'],
    'promise/avoid-new': 'off',
    'promise/prefer-await-to-then': 'error',
    'promise/prefer-await-to-callbacks': 'error',
    'import/no-dynamic-require': 'off',
    'import/extensions': ['error', {
      js: 'never',
      json: 'always'
    }],
    'import/no-extraneous-dependencies': ['error', {
      'devDependencies': ['**/__tests__/*']
    }]
  },
  globals: {}
}
