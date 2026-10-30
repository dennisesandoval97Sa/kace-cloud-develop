import './Calendar.css';

/**
 * @typedef Props
 * @prop {{ [x: string]: unknown }} component - `this.component` properties
 * @prop {(value: any, flags: any, source: any) => any} updateValue - Function to update `this.value` (formio component instance) value
 */

/**
 * @param {Props} props
 */
export const Calendar = ({ component, updateValue }) => {
  return <p className="tomato bold text-l">👍🏽 {component.label} works!</p>;
};
