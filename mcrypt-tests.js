import mcrypt from 'meteor/antonly:mcrypt';

import { Mongo } from 'meteor/mongo';

// substitution for a user DB - used in the first test
const persons = {
  'anna': {salt: mcrypt.generateSalt()},
  'tom': {salt: mcrypt.generateSalt()}
}

// DB for test #4
const Users = new Mongo.Collection('test-users');

// reset db
Users.remove({});

// set up two test users
Users.insert({
  _id: 'A', 
  name: 'Anna', 
  secretFields: {
    salt: mcrypt.generateSalt()
  }
});
Users.insert({
  _id: 'B', 
  name: 'Tom', 
  secretFields: {
    salt: mcrypt.generateSalt()
  }
});

Tinytest.add('Setup test (with default settings)', (test) => {
  // tell the encrypter where he can find the salts
  mcrypt.configure({
    getUserSalt(user, context) {
      return persons[user].salt;
    }
  })


  // what anna does:
  const cleartext      = 'I got a cake!',
        ciphertext     = mcrypt.encrypt(cleartext, 'anna');
        
  // anna can now store the ciphertext in the db

  console.log(`Anna encrypted '${cleartext}' to '${ciphertext}'`);

  // what tom tries:
  const tomsCleartext  = mcrypt.decrypt(ciphertext, 'tom');

  console.log(`Tom tried to decrypted '${ciphertext}' to '${tomsCleartext}'`);

  test.notEqual(tomsCleartext, cleartext);

  // and what anna decrypts again
  const annasClearText = mcrypt.decrypt(ciphertext, 'anna');

  console.log(`Anna decrypted '${ciphertext}' to '${annasClearText}'`);

  test.equal(cleartext, annasClearText);
})

Tinytest.add('Change settings to local vars', (test) => {
  mcrypt.configure({
    getSaltLen: 8,
    getAppKey: 'super-secret-app-key',
    getUserSalt(id, context) {
      // search for the salt in the DB provided as context

      return context.findOne(id).secretFields.salt;
    },
    getUserKeyLen: 8,
    getRounds: 500,
    getDigest: 'sha256',
    getAlgorithm: 'aes192', 
    throwDecryptError: false
  });

  const salt = mcrypt.generateSalt();

  // 8 byte are equal to 12 characters base64
  // formula: (8 * 4) / 3
  // then rounded up to a multiple of 4
  // Math.ceil((4 * n) / (3 * 4)) * 4
  // or simplified:
  // Math.ceil(n/3) * 4
  test.equal(salt.length, 12);
})


Tinytest.add('Encrypt with custom salt and without DB', (test) => {
  const salt       = mcrypt.generateSalt(),
        cleartext  = 'The cake is a lie!',
        ciphertext = mcrypt.encrypt(cleartext, 0, salt); 

  console.log(`Encrypted '${cleartext}' to '${ciphertext}' with salt '${salt}'`);

  const clear2     = mcrypt.decrypt(ciphertext, 0, salt);

  console.log(`Decrypted '${ciphertext}' to '${clear2}' with salt '${salt}'`);

  test.equal(cleartext, clear2);
})


Tinytest.add('Encrypt with DB', (test) => {
  const cleartext  = 'And all the cake is gone.',
                     // if the salt is set to false, it will use the userId to get to the salt
        ciphertext = mcrypt.encrypt(cleartext, 'A', false, Users); // <- Annas ID in the Users DB

  console.log(`Anna encrypted '${cleartext}' to '${ciphertext}'`);

  // you could now store the ciphertext in the DB as well


  const clear2     = mcrypt.decrypt(ciphertext, 'B', false, Users); // <- Toms ID

  test.notEqual(cleartext, clear2);

  console.log(`Tom decrypted '${ciphertext}' to '${clear2}'`);

  console.log(clear2);


  const clear3     = mcrypt.decrypt(ciphertext, 'A', false, Users); // <- Annas ID

  console.log(`Anna decrypted '${ciphertext}' to '${clear3}'`);

  test.equal(clear3, cleartext);
})