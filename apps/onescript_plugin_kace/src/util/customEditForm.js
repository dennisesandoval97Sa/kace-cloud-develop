// --------------------------
// types
// --------------------------

import { Components } from '@formio/react';

/**
 * @template T
 * @typedef {import('formiojs').ClassWithEditForm<T>} ClassWithEditForm
 */

/**
 * @template T
 * @typedef {import('formiojs').ExtendedComponentSchema<T>} ExtendedComponentSchema
 */

// --------------------------
// impl
// --------------------------

export const capitalize = (str = '') =>
  str.charAt(0).toUpperCase() + str.slice(1);

/**
 * @template T
 * @param {ClassWithEditForm<T>} FormioBaseClass
 * @returns {ExtendedComponentSchema<T>[]}
 */
export const getEditFormFromBaseClass = (FormioBaseClass) =>
  FormioBaseClass?.editForm()?.components?.[0]?.components ?? [];

export const componentsOrIgnore = ({ components, ...rest }) =>
  components?.length
    ? { label: capitalize(rest.key), ...rest, components }
    : null;

/**
 * @template {{ [x: string]: any }[]} T
 * @param {string} prop
 * @param {[...T]} upstream
 * @returns {T[number]}
 */
export const dedupeByProp = (prop, ...upstream) => {
  /**
   * @type {Map<string, T[number]>}
   */
  const downstream = new Map();
  for (const elem of upstream) downstream.set(elem[prop], elem);
  return Array.from(downstream.values());
};

/**
 * @template {{ [x: string]: any }[]} T
 * @param {[...T]} upstream
 */
export const dedupeByKey = (...upstream) => dedupeByProp('key', ...upstream);

/**
 * @template T
 * @param {import('formiojs').ClassWithEditForm<T>} FormioBaseClass
 * @param {...ExtendedComponentSchema<T>} editFormTabs
 * @returns {(...extend: ExtendedComponentSchema<T>[]) => { components: ExtendedComponentSchema<T>[] }}
 */
export const customEditForm =
  (FormioBaseClass, ...editFormTabs) =>
  (...extend) =>
    Components.baseEditForm(
      dedupeByKey(
        ...getEditFormFromBaseClass(FormioBaseClass),
        ...editFormTabs
      ).map(componentsOrIgnore),
      ...extend
    );

/**
 * @template T
 * @param {import('formiojs').ClassWithEditForm<T>} FormioBaseClass
 * @param {...ExtendedComponentSchema<T>} editFormTabs
 * @returns {(...extend: ExtendedComponentSchema<T>[]) => { components: ExtendedComponentSchema<T>[] }}
 */
export const _customEditForm =
  (FormioBaseClass, ...editFormTabs) =>
  (...extend) => ({
    components: [
      {
        key: 'tabs',
        type: 'tabs',
        components: dedupeByKey(
          ...getEditFormFromBaseClass(FormioBaseClass),
          ...editFormTabs,
          ...extend
        )
          .map(componentsOrIgnore)
          .filter(Boolean),
      },
    ],
  });
