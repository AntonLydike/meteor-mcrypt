# Meteor mcrypt
### Table of contents:
  1. [What is this](#what-is-this)
  2. [API](#api)
      1. [configure(settings)](#configuresettings)
      2. [encrypt(cleartext, userId, [salt, [context]])](#encryptcleartext-userid-salt-context)
      3. [decrypt(ciphertext, userId, [salt, [context]])](#decryptciphertext-userid-salt-context)
      4. [generateSalt([length])](#generatesaltlength)
      5. [McryptError(code, reason, [data])](#mcrypterrorcode-reason-data)
  3. [Usage](#usage)
  4. [Tests](#tests)
  5. [License](#license)

### What is this?
Encrypt important data in your DB for later use. This uses the [Node.js crypto][4] library.

Each users data will be encrypted with a seperate key to make decryption harder in case of a data breach. The user-specific key (user-key) is derived from the application-key (app-key) plus a user-specific salt per PBKDF2.

**IMPORTANT:** This should NOT be used to encrypt passwords for your own login system. Often times, a [simple hashing algorithm][5] will serve you better. Especially in terms of security!

To install the package, run: `meteor add antonly:mcrypt`.

### API
Import it like this: `import mcrypt from 'meteor/antonly:mcrypt'`.

#### configure(settings)
Configure the package to exactly fit your needs

**default settings:**
````js
mcrypt.configure({
  getUserSalt(uid, context) {
    // example method for getting the salt from the user db
    const usr = Meteor.users.findOne(uid);

    if (!usr || !usr.secret_key_storage || !usr.secret_key_storage.salt) {
      throw new mcrypt.Error(
        'no-salt-given', 
        `Salt for user with id '${userId}' was not found in the db.`, 
        {userId, context}
      );
    }

    return usr.secret_key_storage.salt;
  },
  getAppKey(context)  {
    return Meteor.settings.MCRYPT_PASSW_ENCRYPTION_KEY;
  },
  getUserKeyLen(context)  {
    return Meteor.settings.MCRYPT_PASSW_USER_KEY_LENGTH;
  },
  getRounds(context)  {
    return Meteor.settings.MCRYPT_PBKDF2_ROUNDS;
  },
  getDigest(context)  {
    return Meteor.settings.MCRYPT_PBKDF2_DIGEST;
  },
  getAlgorithm(context)  {
    return Meteor.settings.MCRYPT_PASSW_ALGORITHM;
  },
  throwDecryptError(context) {
    return Meteor.settings.MCRYPT_THROW_DECRYPT_ERR;
  },
  getSaltLen()  {
    return Meteor.settings.MCRYPT_PASSW_SALT_LENGTH;
  }
})
````
  1. `getUserSalt(uid, context)` a function to get the users salt. (in this example it is taken from the Meteor.users db)
  2. `getAppKey(context)` this function return the app-key. It is recommended that you don't change the following functions but rather add the following lines to your [settings.json][6]. All the following functions are just wrappers for the `Meteor.settings` variables.

The `context` wil be passed along from a `decrypt` or `encrypt` call to all settings methods (except `getSaltLen`) and can help you customize your values to your specifc needs.

**settings.json:**
````JSON
{
  "MCRYPT_PASSW_ENCRYPTION_KEY": "*some long encryption key*",
  "MCRYPT_PASSW_SALT_LENGTH": 32,
  "MCRYPT_PASSW_USER_KEY_LENGTH": 32,
  "MCRYPT_PBKDF2_ROUNDS": 100,
  "MCRYPT_PBKDF2_DIGEST": "sha512",
  "MCRYPT_PASSW_ALGORITHM": "aes-256-ctr",
  "MCRYPT_THROW_DECRYPT_ERR": false
}
````
In order to be able to use these settings in your meteor app, you will have to add the settings parameter to your `meteor` command: `meteor --settings development.json`

**What each entry does:**
  1. `MCRYPT_PASSW_ENCRYPTION_KEY` Your secret key (aka. app-key). This key should be impossible to guess, so chose a big one.
  2. `MCRYPT_PASSW_SALT_LENGTH` The length (in bytes) of a standard 'salt' to derive the user-specific key
  3. `MCRYPT_PASSW_USER_KEY_LENGTH` The length (in bytes) of the key, derived from PBKDF2(app-key, salt) that is used to encrypt the data
  4. `MCRYPT_PBKDF2_ROUNDS` and `MCRYPT_PBKDF2_DIGEST` correspond to their PBKDF2 parameters (more [here][2])
  5. `MCRYPT_PASSW_ALGORITHM` is the algorithm used to encrypt the data (the algorithm field of [crypto.createCipher][3])
  6. `MCRYPT_THROW_DECRYPT_ERR` Some algorithms will throw errors when trying to decipher with the wron key. If this is set to false, the error will be catched and an McryptError will be returned instead.

Sidenote: Of course you have to use your own parameters. These are just the development settings. You will have to choose your own parameters, depending on the importance of your data. (PBKDF2_ROUNDS should be chosen to fit your host system. I've read [somewhere][1] that a hash should take **at least** 241 milliseconds)

If you want to set your own values, `mcrypt.configure` expects an object with **functions or values** to replace the standard ones:
````js
mcrypt.configure({
  getUserSalt(uid, context) {
    let db = AdminsDB;
    
    if (context == 'clients') {
      db = ClientsDB;
    }
    
    return db.find(uid).secret.salt;
  },
  getRounds: 10e9, // 10000000000
  getSaltLen: 64
})
````
(notice how you can pass functions or values)

#### encrypt(cleartext, userId, [salt, [context]])
Encrypts the given cleartext. 
  * `cleartext` The utf-8 string to encrypt
  * `userId` the ID of the user who's salt will be used
  * `salt` can be passed instead of `userId` if you already got it, or just generated it. If the salt is omitted or false, the result of `getUserSalt(userId, context)` will be used as salt. The salt is used to derive the user-key from the app-key
  * `context` is passed along to the `getUserSalt(userId, context)` function in the case that no salt is provided directly
  
**examples**
````js
import mcrypt from 'meteor/antonly:mcrypt';

const cleartext   = 'Cleartext 1',
      salt        = 'Just some simple salt';

// encrypt with salt from DB
const ciphertext  = mcrypt.encrypt(cleartext, 1); 
// this will use the salt from user with the ID 1

// encrypt with known salt
const ciphertext2 = mcrypt.encrypt(cleartext, 0, salt); 
// the userId can be set to any arbitrary value because the salt is provided
````

#### decrypt(ciphertext, userId, [salt, [context]])
Decrypts given ciphertext.
  * `ciphertext` the text to decrypt
  * `userId` same thing as before, either you specify a userId or a salt
  * `salt` and `context` see encrypt 

This can return a `bad-decrypt` error when `MCRYPT_THROW_DECRYPT_ERR` is set to true. The error will look like this:
````JS
McryptError {
  _isError: true,
  code: 'bad-decrypt',
  reason: 'The ciphertext couldn\'t be decrypted with the given key',
  data: { 
    ciphertext: '2d27113bad83553254cd8a604282814e274ee4b08ccf57940e583f01a364b742',
    salt: 'u/QOClVMrCOhESVa/pz0q6/plwCPVynoPMegKW3ArWw=',
    userId: 'B',
    context: { },
    error: [Error: error:06065064:digital envelope routines:EVP_DecryptFinal_ex:bad decrypt] 
  } 
}
````
`data.error` contains the catched error.

#### generateSalt([length])
Generates a random salt using `crypto.randomBytes`. If you don't specify a length (in bytes) it will use the result of `getSaltLen()`.

#### McryptError(code, reason, [data])
An error object. It has the following fields:
  * `code` The error code (for example `'no-salt-given'`)
  * `reason` a more in-depth explanation of what went wrong
  * `data` (optional) Additional data for debugging or error handling / logging

**example from the standard `getUserSalt` method:**
````js
throw new mcrypt.Error(
  'no-salt-given', 
  `Salt for user with id ${userId} was not found in the db.`, 
  {userId, context}
);
````
The error object will look something like this:
````js
McryptError {
  _isError: true,
  code: 'no-salt-given',
  reason: 'Salt for user with id 1 was not found in the db.',
  data: { userId: 1, context: {} } 
}
````
It also has a custom `toString` method, wich will return `[McryptError this.code]`. In this case it would be `[McryptError no-salt-given]`.


### usage
This is how I (would) use this package. Your secret could be a user-specific API-key for example.

````js
import mcrypt from 'meteor/antonly:mcrypt';

// point to the right field in the DB
mcrypt.configure({
  getUserSalt(userId) {
    const usr = Meteor.users.findOne(userId);

    if (!usr || !usr.important || !usr.important.salt) {
      throw new mcrypt.Error(
        'no-salt-given',
        `Salt for user with id '${userId}' was not found in the db.`,
        {userId, context}
      );
    }

    return usr.important.salt;
  }
});

// make sure each user has a salt
Accounts.onCreateUser(function(options, user){
  user.important = {
    salt: mcrypt.generateSalt()
  }

  return user;
});

// implement methods to get and set secrets
Meteor.methods({
  setSecret(secret) {
    check(secret, String);

    if (!this.userId) return {success:false, error: 'login-required'};

    const cipher = mcrypt.encrypt(secret, this.userId);

    Meteor.users.update(this.userId, {
      $set: {
        'important.secret': cipher
      }
    });

    return cipher;
  },
  getSecret() {
    if (!this.userId) return {success:false, error: 'login-required'};

    const cipher = Meteor.users.findOne(this.userId).important.secret;

    const clear  = mcrypt.decrypt(cipher, this.userId);

    return clear;
  }
});



//// usage ////

// on the client
Meteor.call("setSecret", "secret", function (err, data) {
  if (data && data.success !== false) alert(`Secret saved as "${data}"`);
})


// later on
Meteor.call("getSecret", function (err, data) {
  if (!err) alert(`Secret retrieved as "${data}"`);
})
````
for more check `mcrypt-test.js`.


### Tests
There are a couple of TinyTest tests. To run them:

  1. Install TinyTest: `meteor add tinytest`
  2. Run Meteor in test mode with your settings file: `meteor test-packages --settings settings.json`
  3. Navigate to `http://localhost:3000`
  4. Hopefully see all tests passing:

![http://i.imgur.com/CSaulpQ.png](http://i.imgur.com/CSaulpQ.png)

### License
The code for this package is licensed under the [MIT License](http://opensource.org/licenses/MIT).

   [1]: http://security.stackexchange.com/a/3993
   [2]: https://nodejs.org/api/crypto.html#crypto_crypto_pbkdf2sync_password_salt_iterations_keylen_digest
   [3]: https://nodejs.org/api/crypto.html#crypto_class_cipher
   [4]: https://nodejs.org/api/crypto.html
   [5]: https://nodejs.org/api/crypto.html#crypto_class_hash
   [6]: https://themeteorchef.com/snippets/making-use-of-settings-json/
    
