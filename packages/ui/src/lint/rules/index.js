/** The rule table `webjsui lint` dispatches over. Each rule is pure: `(site, ctx) => violations`. */
import { noRawColors } from './no-raw-colors.js';
import { noArbitraryValues } from './no-arbitrary-values.js';
import { noRestyle } from './no-restyle.js';

export const RULES = {
  'no-raw-colors': noRawColors,
  'no-arbitrary-values': noArbitraryValues,
  'no-restyle': noRestyle,
};

export const RULE_NAMES = Object.keys(RULES);
