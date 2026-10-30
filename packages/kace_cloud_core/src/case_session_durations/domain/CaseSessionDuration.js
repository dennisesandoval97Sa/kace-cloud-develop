import {
  ValueObjectUuid,
  ValueObjectString,
  ValueObjectTimestamp,
  ValueObjectEnum,
} from '@kace/core/src/shared/index.js';
import { ValueObjectEventType } from './ValueObjectEventType.js';
import { AggregateRoot } from '../../shared/domain/AggregateRoot.js';

/**
 * Domain Aggregate: CaseSessionDuration
 * Represents a session duration for a case, including timing and user info.
 */
export class CaseSessionDuration extends AggregateRoot {

  /** @type {ValueObjectUuid} */
  #case_id;
  /** @type {ValueObjectUuid} */
  #user_id;
  /** @type {ValueObjectTimestamp} */
  #started_at;
  /** @type {ValueObjectTimestamp} */
  #finished_at;
  /** @type {ValueObjectString} */
  #elapsed_time;
  /** @type {ValueObjectEnum} */
  #event_type;
  /** @type {ValueObjectString} */
  #justification;

  /**
   * @param {Object} params
   * @param {string|number} params.id Unique identifier
   * @param {string} params.case_id Related case ID (UUID)
   * @param {string} params.user_id Related user ID (UUID)
   * @param {Date|string} params.started_at Session start time
   * @param {Date|string} [params.finished_at] Session end time
   * @param {string} [params.elapsed_time] Elapsed time (interval as string)
  * @param {string} [params.event_type] Event type: 'PAUSED' or 'FINISHED'
 * @param {string} [params.justification] Optional justification text
   * @param {string} [params.created_by] User who created the record (UUID)
   * @param {string} [params.updated_by] User who last updated the record (UUID)
   * @param {string} [params.deleted_by] User who deleted the record (UUID)
   * @param {Date|string} [params.created_at] When the record was created
   * @param {Date|string} [params.updated_at] When the record was last updated
   * @param {Date|string} [params.deleted_at] When the record was deleted
   */
  constructor(dto) {
    super(dto.id);
    this.#case_id = new ValueObjectUuid('case_id', dto.case_id);
    this.#user_id = new ValueObjectUuid('user_id', dto.user_id);
    this.#started_at = new ValueObjectTimestamp('started_at', dto.started_at);
    this.#finished_at = new ValueObjectTimestamp('finished_at', dto.finished_at,true);
    this.#elapsed_time = new ValueObjectString('elapsed_time', dto.elapsed_time,true);
    this.#event_type = new ValueObjectEventType('event_type', dto.event_type);
    this.#justification = new ValueObjectString('justification', dto.justification,true);
    this.created_by = dto.created_by;
    this.updated_by = dto.updated_by;
    this.deleted_by = dto.deleted_by;
    this.created_at = dto.created_at;
    this.updated_at = dto.updated_at;
    this.deleted_at = dto.deleted_at;
  }

  static create(dto) {
    return new CaseSessionDuration(dto);
  }

  get case_id() {
    return this.#case_id;
  }

  set case_id(value) {
    this.#case_id = new ValueObjectUuid('case_id', value);
    this.changedAttributes.case_id = value;
  }

  get user_id() {
    return this.#user_id;
  }

  set user_id(value) {
    this.#user_id = new ValueObjectUuid('user_id', value);
    this.changedAttributes.user_id = value;
  }

  get started_at() {
    return this.#started_at;
  }

  set started_at(value) {
    this.#started_at = new ValueObjectTimestamp('started_at', value);
    this.changedAttributes.started_at = value;
  }

  get finished_at() {
    return this.#finished_at;
  }
  set finished_at(value) {
    this.#finished_at = new ValueObjectTimestamp('finished_at', value);
    this.changedAttributes.finished_at = value;
  }

  get elapsed_time() {
    return this.#elapsed_time;
  }

  set elapsed_time(value) {
    this.#elapsed_time = new ValueObjectString('elapsed_time', value);
    this.changedAttributes.elapsed_time = value;
  }

  get event_type() {
    return this.#event_type;
  }

  set event_type(value) {
    this.#event_type = new ValueObjectEventType('event_type', value);
    this.changedAttributes.event_type = value;
  }

  get justification() {
    return this.#justification;
  }

  set justification(value) {
    this.#justification = new ValueObjectString('justification', value, true);
    this.changedAttributes.justification = value;
  }
}