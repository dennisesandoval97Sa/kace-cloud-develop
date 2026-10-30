import { Utils as Evaluator } from '@formio/react';
import { withHandshakeEvaluatorContext } from '#plugins/kace/utils/withHandshakeEvaluatorContext.js';

export function evaluateKace(code, context) {
  return Evaluator.evaluate(code, withHandshakeEvaluatorContext(context));
}
