/**
 * check/scope.js
 *
 * @author  Denis Luchkin-Zhou <denis@ricepo.com>
 * @license MIT
 */

import _           from 'lodash';
import Bluebird    from 'bluebird';


/*!
 * We don't want to accidentally overwrite anything in the request
 * object, therefore we hide the scope cache behind a symbol.
 */
export const $$cache = Symbol();


/**
 * Establishes the scope for a request.
 */
export default async function scope(manager, request, name) {
  const cache = (request[$$cache] = request[$$cache] || { });

  /* If we already have the scope cached, proceed */
  if (cache[name]) { return cache[name]; }

  /* Find the best strategy using hints */
  const strategies = manager.scopes[name];
  if (!strategies) {
    throw new Error(`Scope '${name}' is not defined.`);
  }

  /* If no hinted strategies match, use unhinted */
  const key = _.find(Object.keys(request.params), i => strategies[i]) || '@@null';

  /* If the strategy found is undefined, we got problems */
  const strategy = strategies[key];
  if (!strategy) {
    throw new Error(`No suitable strategy found for scope '${name}'.`);
  }

  /* Establish all dependencies first */
  const promises = strategy.deps.map(i => scope(manager, request, i));
  await Bluebird.all(promises);

  /* Establish the target scope itself */
  const entity = await Bluebird.try(() => strategy.callback(request));

  /* If we fail, we got a 404 on our hands */
  if (!entity) {
    const err = new Error(`${_.capitalize(name)} not found.`);
    err.status = 404;
    throw err;
  }

  /* Save to scope cache and return */
  return (cache[name] = entity);
}
