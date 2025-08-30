const _ = require('lodash');

// Only using lodash, not moment or axios
const numbers = [1, 2, 3, 4, 5];
const sum = _.sum(numbers);
const doubled = _.map(numbers, n => n * 2);

console.log('Sum:', sum);
console.log('Doubled:', doubled);
