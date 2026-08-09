'use strict';

const registry = {
  'reddit-post': require('./reddit-post'),
  'reddit-list': require('./reddit-list'),
};

function get(name) {
  const recipe = registry[name];
  if (!recipe) {
    const known = Object.keys(registry).join(', ');
    throw new Error(`unknown recipe "${name}" — known recipes: ${known}`);
  }
  return recipe;
}

function list() {
  return Object.values(registry);
}

module.exports = { get, list };
