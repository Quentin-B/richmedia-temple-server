const expect = require('chai').expect;
const dev = require('../src/dev');
const build = require('../src/build');

describe('test', () => {
  it('should return a string', () => {
    expect('ci with travis').to.equal('ci with travis');
  });
});
