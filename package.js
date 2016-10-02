Package.describe({
  name: 'antonly:mcrypt',
  version: '0.0.1',
  // Brief, one-line summary of the package.
  summary: 'Encrypt users data with user-specific keys for later use!',
  // URL to the Git repository containing the source code for this package.
  git: 'https://github.com/AntonLydike/meteor-mcrypt',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.4.1.1');
  api.use(['ecmascript', 'underscore']);
  api.mainModule('mcrypt-core.js', 'server');
});

Package.onTest(function(api) {
  api.use(['ecmascript', 'underscore', 'tinytest', 'antonly:mcrypt']);
  api.mainModule('mcrypt-tests.js', 'server');
});
