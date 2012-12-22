#!/usr/bin/env node

/* required modules */
var fs = require('fs');

/* the intercepted cypher texts */
var cypherTexts = [
    [ 9,  0,  4, 10],
    [10, 20, 28,  9],
    [10, 16,  2,  2],
    [10, 20,  5,  8],
    [26, 26,  3,  0],
    [28, 16,  3, 17]
];

/* the decoder state */
var state = {
    cypherTable: null,      // table of all the ASCII letter XOR ASCII letter results
    dictionary: null,       // array of all the German four-letter ASCII words
    regularExpression: null // the regular expression that has to apply to all the plain texts and the secret key
};

/**
 * Array.prototype.forEach:
 * @callback: the function to be invoked for each array element.
 *  The prototype looks like this: function(arrayElement)
 *
 * Invoke a function for each element of an array.
 */
Array.prototype.forEach = function (callback) {
    for (var index = 0; index < this.length; index += 1) {
        callback(this[index]);
    }
};

/**
 * buildCypherTable:
 *
 * Build the cypher table. Calculate letterOne XOR letterTwo for each pair
 * of ASCII characters.
 */
var buildCypherTable = function () {
    var key;
    var result = {};
    var secret;

    // add dictionaries for each letter of the ASCII alphabet
    for (key = 'A'.charCodeAt(0); key <= 'Z'.charCodeAt(0); key += 1) {
        result[String.fromCharCode(key)] = {};
    }

    // add the XOR values of the letters
    for (secret = 'A'.charCodeAt(0); secret <= 'Z'.charCodeAt(0); secret += 1) {
        for (key = 'A'.charCodeAt(0); key <= secret; key += 1) {
            var cyphercode = secret ^ key;

            // xor is symmetric, fill both directions in one step
            result[String.fromCharCode(secret)][String.fromCharCode(key)] = cyphercode;
            result[String.fromCharCode(key)][String.fromCharCode(secret)] = cyphercode;
        }
    }

    return result;
};
state.cypherTable = buildCypherTable();

/**
 * dumpCypherTable:
 *
 * Print out the ASCII XOR ASCII table.
 */
var dumpCypherTable = function () {
    var headLine = "   ";
    var line;
    var secret;

    for (key = 'A'.charCodeAt(0); key <= 'Z'.charCodeAt(0); key += 1) {
        headLine += " " + String.fromCharCode(key) + " ";
    }

    console.log(headLine);
    for (secret = 'A'.charCodeAt(0); secret <= 'Z'.charCodeAt(0); secret += 1) {
        line = " " + String.fromCharCode(secret);
        for (key = 'A'.charCodeAt(0); key <= 'Z'.charCodeAt(0); key += 1) {
            var cypherValue = state.cypherTable[String.fromCharCode(secret)][String.fromCharCode(key)];
            line += " ";
            if (cypherValue < 10) {
                line += " ";
            }
            line += cypherValue;
        }
        line += " " + String.fromCharCode(secret);
        console.log(line);
    }
    console.log(headLine);
};
dumpCypherTable();

/**
 * generateRegularExpression:
 *
 * The XOR table contains values from 0 to 31 (decimal notation). As there
 * are only 26 values per row/column, there must be some decimal values
 * that cannot be produced with a certain key. Just take a look at the "A"
 * row below, it does not contain 1, 26, 28, 29, 30, 31:
 *
 *    A  B  C  D  E  F  G  H  I  J  K  L  M  N  O  P  Q  R  S  T  U  V  W  X  Y  Z 
 * A  0  3  2  5  4  7  6  9  8 11 10 13 12 15 14 17 16 19 18 21 20 23 22 25 24 27 A
 *
 * This function will create a regular expression to filter out any words
 * that have a chance of being the secret key.
 */
var createRegularExpression = function () {
    var regularExpression = "^";
    var found;

    for (var index = 0; index < 4 /* maximum offset in the cyphertexts */; index += 1) {
        regularExpression += "[";
        for (var key in state.cypherTable) {
            found = 0;

            for (var secret in state.cypherTable[key]) {
                for (var cypherText = 0; cypherText < cypherTexts.length; cypherText += 1) {
                    if (cypherTexts[cypherText][index] === state.cypherTable[secret][key]) {
                        found += 1;
                    }
                }
            }

            if (found >= cypherTexts.length) {
                regularExpression += key;
            }
        }
        regularExpression += "]";
    }
    regularExpression += "$";

    return new RegExp(regularExpression, "i");
};

state.regularExpression = createRegularExpression();
console.log('the key will have to match this regular expression: %s', state.regularExpression);

/**
 * loadDictionary:
 *
 * Load the dictionary file from the “wngerman” package (the
 * “ingerman” package did not contain the words).
 */
var loadDictionary = function () {
    var dict = fs.readFileSync('/usr/share/dict/ngerman');

    dict = dict.toString();
    dict = dict.split(/[\r\n]+/);

    return dict;
};
state.dictionary = loadDictionary();

console.log("%d words in the complete dictionary", state.dictionary.length);

/**
 * filterDictionaryLength:
 * @dictionary: an array of words
 * @length: the length the words should have
 *
 * Return an array containing all the words from @dictionary with @length
 * letters.
 */
var filterDictionaryLength = function (dictionary, length) {
    var result = [];

    dictionary.forEach(function (word) {
        if (word.length == length) {
            result.push(word);
        }
    });

    return result;
};
state.dictionary = filterDictionaryLength(state.dictionary, 4);
console.log("%d words contain four characters", state.dictionary.length);

var uppercaseWords = function (dictionary) {
    var result = [];

    dictionary.forEach(function (word) {
        result.push(word.toUpperCase());
    });

    return result;
};
state.dictionary = uppercaseWords(state.dictionary);

/**
 * filterDictionary:
 * @dictionary: the full dictionary
 * @regularExpression: the regular expression for filtering
 *
 * Return a new Array only containing words that match the regular
 * expression.
 */
var filterDictionaryKeys = function (dictionary, regularExpression) {
    var result = [];

    dictionary.forEach(function (value) {
        if (value.match(regularExpression)) {
            result.push(value.toUpperCase());
        }
    });

    return result;
};
state.possibleKeys = filterDictionaryKeys(state.dictionary, state.regularExpression);

console.log("%d words are plain text/secret key candidates: %j", state.possibleKeys.length, state.possibleKeys);

/**
 * testKeys:
 *
 * Test the key candidates from state.possibleKeys and return a structure
 * like this:
 *  [
 *    {
 *      secretKey: 'KEY1',
 *      plainTexts: [
 *        'SOME', '_PLA', 'IN_T', 'EXT_', 'WORD'
 *      ]
 *    }, …
 *  ]
 */
var testKeys = function () {
    var result = [];

    state.possibleKeys.forEach(function (possibleKey) {
        var plainTexts = [];

        cypherTexts.forEach(function (cypherText) {
            var plainText = "";
            var letterOffset = 0;

            cypherText.forEach(function (letter) {
                var decodedCharacter = possibleKey.charCodeAt(letterOffset++) ^ letter;
                if (decodedCharacter >= 'A'.charCodeAt(0) && decodedCharacter <= 'Z'.charCodeAt(0)) {
                    plainText += String.fromCharCode(decodedCharacter);
                }
            });

            if (plainText.length !== cypherText.length) {
                return console.log("  %s is not an ASCII word", plainText);
            }

            state.dictionary.forEach(function (word) {
                if (plainText === word) {
                    plainTexts.push(plainText);
                }
            });
        });

        if (plainTexts.length === cypherTexts.length) {
            // found as many dictionary words as we observed in the cummunication
            result.push({
                secret:     possibleKey,
                plainTexts: plainTexts
            });
        }
    });

    return result;
};
state.candidates = testKeys();

console.log("Found %d solutions:", state.candidates.length);
state.candidates.forEach(function (candidate) {
    console.log("found candidate:  %j", candidate);
});

/* vim:set sw=4 et: */
