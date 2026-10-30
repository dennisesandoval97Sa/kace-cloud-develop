import React from 'react'
import PropTypes from 'prop-types'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/componentsV2/core/SelectBase';
import { useTranslation } from 'react-i18next';
import { formatTestId } from '../../../../utils/src/helpers';

const ActionsDefaultSelect = ({ selectedValue = "", options = [], placeholder = "", testId = "actions", disabled = false, handler = () => { } }) => {
  const { t } = useTranslation()
  return (
    <Select
      onValueChange={handler}
      value={selectedValue}
      disabled={disabled}
      id={`action_default_select_${testId}`}
      data-testid={`action_default_select_${testId}`}
    >
      <SelectTrigger
        className="flex gap-2 rounded w-full"
        data-testid={`action_default_trigger_${testId}`}
        id={`action_default_trigger_${testId}`}
      >
        <SelectValue
          placeholder={t(placeholder)}
          id={formatTestId("action_default_value", `${placeholder}`)}
          data-testid={formatTestId("action_default_value", `${placeholder}`)}
        />
      </SelectTrigger>
      <SelectContent id={formatTestId("action_default_content", `${selectedValue}`)}
        data-testid={formatTestId("action_default_content", `${selectedValue}`)}>
        <SelectGroup>
          <SelectLabel>{t("actions.form.options")}</SelectLabel>
          {options.map(({ value, label }) => (
            <SelectItem value={value} id={formatTestId("action_default_select_item", `${label}`)} data-testid={formatTestId("action_default_select_item", `${label}`)}>{t(label)}</SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

ActionsDefaultSelect.propTypes = {
  selectedValue: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string.isRequired, value: PropTypes.string.isRequired })),
  placeholder: PropTypes.string,
  disabled: PropTypes,
  handler: PropTypes.func,
}

export default ActionsDefaultSelect