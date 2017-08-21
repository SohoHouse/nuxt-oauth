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
    'promise',
    'flowtype-errors'
  ],
  // add your custom rules here
  rules: {
    'flowtype-errors/show-errors': 2,
    'comma-dangle': ['error', 'never'],
    'space-before-function-paren': ['error', 'always'],
    'semi': ['error', 'never'],
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,
    'no-return-assign': 'off',
    'no-console': 'off',
    'no-multi-assign': 'off',
    'no-param-reassign': 'off',
    'global-require': 'off',
    'promise/avoid-new': 'off',
    'promise/prefer-await-to-then': 'error',
    'promise/prefer-await-to-callbacks': 'error',
    'import/no-dynamic-require': 'off',
    'import/no-extraneous-dependencies': ['error', { 'devDependencies': ['test/**/*', 'rollup.config.js'] }]
  },
  globals: {}
}
