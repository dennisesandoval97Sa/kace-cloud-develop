import './TextField.css';

/**
 * @typedef Props
 * @prop {{ [x: string]: unknown }} component - `this.component` properties
 * @prop {(value: any, flags: any, source: any) => any} updateValue - Function to update `this.value` (formio component instance) value
 */

export const TextField = () => {
  return <p className="tomato bold text-l">👍🏽 works!</p>;
};
