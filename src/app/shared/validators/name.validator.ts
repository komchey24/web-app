/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * Names must not begin with a number or a special character.
 *
 * `\p{L}` matches a letter in any script, so Khmer (and every other
 * non-Latin) name is accepted; the previous `[A-z]` range only covered
 * ASCII — and, being a sloppy range, also let through `[ \ ] ^ _ \``.
 */
export const NAME_PATTERN = /^\p{L}/u;
