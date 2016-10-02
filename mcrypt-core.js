const crypto      = require('crypto'),
      settings    = {},
      mcrypt      = {};


// set the settings / parameters (for example a custom digest)
// these are the allowed fields:
const setFields = ['getUserSalt', 'getAppKey', 'getSaltLen', 'getUserKeyLen', 'getRounds', 'getDigest', 'getAlgorithm', 'throwDecryptError'];
mcrypt.configure = function (newSettings) {
  _.each(setFields, (settingsName) => {
    const setting = newSettings[settingsName];

    if (_.isFunction(setting)) {
      // if a function is given, it will replace the old one.

      settings[settingsName] = setting;
    } else if (setting !== undefined){
      // if something else is given thats not undefined, it will be used instead 

      settings[settingsName] = () => setting;
    }
  })
}

// generate a cryptograhpically secure salt
// with the length specified in the settings
mcrypt.generateSalt = function (length = settings.getSaltLen()) {
  return crypto.randomBytes(length).toString('base64');
}

// encrypt a string with a key, derived from the
// users app-key plus the users salt
mcrypt.encrypt = function (cleartext, userId, salt = false, context = {}) {
  const key       = getUserKey(userId, salt, context),
        algorithm = settings.getAlgorithm(context),
        cipher    = crypto.createCipher(algorithm, key);

  return cipher.update(cleartext,'utf8','hex') + cipher.final('hex');
}

// decrypt the password with the same key
mcrypt.decrypt = function (ciphertext, userId, salt = false, context = {}) {
  const key       = getUserKey(userId, salt, context),
        algorithm = settings.getAlgorithm(context),
        decipher  = crypto.createDecipher(algorithm, key);

  try {

    return decipher.update(ciphertext,'hex','utf8') + decipher.final('utf8');
  
  } catch (error) {
    // check if error should be thrown
    if (settings.throwDecryptError(context)) {
      // throw it if it wants to be thrown

      throw error;
    } else {
      // or return a more civilized error

      return new mcrypt.Error(
        'bad-decrypt', 
        'The ciphertext couldn\'t be decrypted with the given key', 
        {
          ciphertext, 
          userId, 
          context, 
          error,
          salt: salt === false ? settings.getUserSalt(userId, context) : salt
          // prevent salt:false in case userId and context were used to determine the salt 
        }
      );
    }
  }

}

// The error class
mcrypt.Error = class McryptError {
  constructor(code, reason, data = {}) {
    this._isError = true;
    this.code = code;
    this.reason = reason;
    this.data = data;
  }

  toString() {
    return `[McryptError ${this.code}]`;
  }
}

// generate the user-specific key that derives from
// the app-key plus the users specific salt. this 
// is only needed in this scope and won't be exposed
function getUserKey (userId, salt = false, context = {}) {
  // if no salt is given, take it from the user db
  if (salt === false) {
    salt = settings.getUserSalt(userId, context);
  }

  const appKey  = settings.getAppKey(context),
        rounds  = settings.getRounds(context),
        length  = settings.getUserKeyLen(context),
        digest  = settings.getDigest(context);

  const userKey = crypto.pbkdf2Sync(appKey, salt, rounds, length, digest);

  return userKey.toString('hex');
}


// set the default settings
mcrypt.configure({
  getUserSalt(userId, context) {
    // example method for getting the salt from the user db
    const usr = Meteor.users.findOne(userId);

    if (!usr || !usr.secret_key_storage || !usr.secret_key_storage.salt) {
      throw new mcrypt.Error(
        'no-salt-given', 
        `Salt for user with id ${userId} was not found in the db.`, 
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

export default mcrypt;