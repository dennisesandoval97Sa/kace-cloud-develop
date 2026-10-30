import { ValueObjectIcons } from './value-object/ValueObjectIcons';
import { ValueObjectPositions } from './value-object/ValueObjectPositions';
import { ValueObjectSiteRole } from './value-object/ValueObjectSiteRole';
import {
    DEFAULT_SHARED_VISUAL_COLOR,
    DEFAULT_SHARED_VISUAL_ICON,
    ValueObjectColor,
    ValueObjectSharedVisualColor,
    ValueObjectSharedVisualIcon,
} from '../../shared';

export class Properties {
    /**
     * @type {ValueObjectColor}
     * is initialized in the constructor
     */
    #color;

    /**
     * @type {ValueObjectPositions}
     * is initialized in the constructor
     */
    #position;

    /**
     * @type {ValueObjectIcons}
     * is initialized in the constructor
     */
    #icon;

    /**
     * @type {ValueObjectSiteRole}
     * is initialized in the constructor
     */
    #siteToShow;

    constructor(dto, options = {}) {
        const { validateVisualOptions = false } = options;
        this.#color = validateVisualOptions
            ? new ValueObjectSharedVisualColor('color', dto.color ?? DEFAULT_SHARED_VISUAL_COLOR, false)
            : new ValueObjectColor('color', dto.color ?? '#FFFF00', false);
        this.#position = new ValueObjectPositions('position', dto.position, false);
        this.#icon = validateVisualOptions
            ? new ValueObjectSharedVisualIcon('icon', dto.icon ?? DEFAULT_SHARED_VISUAL_ICON, false)
            : new ValueObjectIcons('icon', dto.icon ?? 'default', false);
        this.#siteToShow = new ValueObjectSiteRole('siteToShow', dto.siteToShow, true);
    }

    get color() {
        return this.#color;
    }

    set color(value) {
        this.#color = new ValueObjectColor('color', value, false);
    }

    get position() {
        return this.#position;
    }

    set position(value) {
        this.#position = new ValueObjectPositions('position', value, false);
    }

    get icon() {
        return this.#icon;
    }

    set icon(value) {
        this.#icon = new ValueObjectIcons('icon', value, false);
    }

    get siteToShow() {
        return this.#siteToShow;
    }

    set siteToShow(value) {
        this.#siteToShow = new ValueObjectSiteRole('siteToShow', value, false);
    }

    get value() {
        return {
            color: this.#color.value,
            position: this.#position.value,
            icon: this.#icon.value,
            siteToShow: this.#siteToShow.value,
        };
    }
}
