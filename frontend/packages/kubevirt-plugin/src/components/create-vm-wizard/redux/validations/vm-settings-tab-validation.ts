import { isEmpty } from 'lodash';
import { List } from 'immutable';
import { ValidationErrorType, ValidationObject } from '@console/shared';
import { VMSettingsField, VMWizardProps, VMWizardTab } from '../../types';
import {
  hasVmSettingsChanged,
  iGetFieldKey,
  iGetFieldValue,
  iGetVmSettings,
  isFieldRequired,
} from '../../selectors/immutable/vm-settings';
import {
  InternalActionType,
  UpdateOptions,
  VMSettingsValidationConfig,
  VmSettingsValidator,
} from '../types';
import { vmWizardInternalActions } from '../internal-actions';
import {
  validateUserTemplateProvisionSource,
  validateVmLikeEntityName,
} from '../../../../utils/validations/vm';
import {
  VIRTUAL_MACHINE_EXISTS,
  VIRTUAL_MACHINE_TEMPLATE_EXISTS,
} from '../../../../utils/validations/strings';
import { concatImmutableLists } from '../../../../utils/immutable';
import { getFieldTitle } from '../../utils/vm-settings-tab-utils';
import {
  checkTabValidityChanged,
  iGetCommonData,
  iGetLoadedCommonData,
  iGetName,
  immutableListToShallowMetadataJS,
} from '../../selectors/immutable/selectors';
import { validatePositiveInteger } from '../../../../utils/validations/common';
import { getValidationUpdate } from './utils';

const validateVm: VmSettingsValidator = (field, options) => {
  const { getState, id } = options;
  const state = getState();

  const isCreateTemplate = iGetCommonData(state, id, VMWizardProps.isCreateTemplate);

  const entities = isCreateTemplate
    ? concatImmutableLists(
        iGetLoadedCommonData(state, id, VMWizardProps.commonTemplates),
        iGetLoadedCommonData(state, id, VMWizardProps.userTemplates),
      )
    : iGetLoadedCommonData(state, id, VMWizardProps.virtualMachines);

  return validateVmLikeEntityName(
    iGetFieldValue(field),
    iGetCommonData(state, id, VMWizardProps.activeNamespace),
    immutableListToShallowMetadataJS(entities),
    {
      existsErrorMessage: isCreateTemplate
        ? VIRTUAL_MACHINE_TEMPLATE_EXISTS
        : VIRTUAL_MACHINE_EXISTS,
      subject: getFieldTitle(iGetFieldKey(field)),
    },
  );
};

export const validateUserTemplate: VmSettingsValidator = (field, options) => {
  const { getState, id } = options;
  const state = getState();

  const userTemplateName = iGetFieldValue(field);
  if (!userTemplateName) {
    return null;
  }
  const userTemplate = iGetLoadedCommonData(state, id, VMWizardProps.userTemplates, List()).find(
    (template) => iGetName(template) === userTemplateName,
  );

  return validateUserTemplateProvisionSource(userTemplate && userTemplate.toJSON());
};

const asVMSettingsFieldValidator = (
  validator: (value: string, opts: { subject: string }) => ValidationObject,
) => (field) =>
  validator(iGetFieldValue(field), {
    subject: getFieldTitle(iGetFieldKey(field)),
  });

const validationConfig: VMSettingsValidationConfig = {
  [VMSettingsField.NAME]: {
    detectValueChanges: [VMSettingsField.NAME],
    detectCommonDataChanges: (field, options) => {
      const isCreateTemplate = iGetCommonData(
        options.getState(),
        options.id,
        VMWizardProps.isCreateTemplate,
      );
      return isCreateTemplate
        ? [
            VMWizardProps.activeNamespace,
            VMWizardProps.userTemplates,
            VMWizardProps.commonTemplates,
          ]
        : [VMWizardProps.activeNamespace, VMWizardProps.virtualMachines];
    },
    validator: validateVm,
  },
  [VMSettingsField.USER_TEMPLATE]: {
    detectValueChanges: [VMSettingsField.USER_TEMPLATE],
    detectCommonDataChanges: [VMWizardProps.userTemplates],
    validator: validateUserTemplate,
  },
  [VMSettingsField.CPU]: {
    detectValueChanges: [VMSettingsField.CPU],
    validator: asVMSettingsFieldValidator(validatePositiveInteger),
  },
  [VMSettingsField.MEMORY]: {
    detectValueChanges: [VMSettingsField.MEMORY],
    validator: asVMSettingsFieldValidator(validatePositiveInteger),
  },
};

export const validateVmSettings = (options: UpdateOptions) => {
  const { id, dispatch, getState } = options;
  const state = getState();
  const vmSettings = iGetVmSettings(state, id);

  const update = getValidationUpdate(validationConfig, options, vmSettings, hasVmSettingsChanged);

  if (!isEmpty(update)) {
    dispatch(vmWizardInternalActions[InternalActionType.UpdateVmSettings](id, update));
  }
};

export const setVmSettingsTabValidity = (options: UpdateOptions) => {
  const { id, dispatch, getState } = options;
  const state = getState();
  const vmSettings = iGetVmSettings(state, id);

  // check if all required fields are defined
  const hasAllRequiredFilled = vmSettings
    .filter((field) => isFieldRequired(field) && !field.get('skipValidation'))
    .every((field) => field.get('value'));
  let isValid = hasAllRequiredFilled;

  if (isValid) {
    // check if all fields are valid
    isValid = vmSettings.every(
      (field) => field.getIn(['validation', 'type']) !== ValidationErrorType.Error,
    );
  }

  if (checkTabValidityChanged(state, id, VMWizardTab.VM_SETTINGS, isValid, hasAllRequiredFilled)) {
    dispatch(
      vmWizardInternalActions[InternalActionType.SetTabValidity](
        id,
        VMWizardTab.VM_SETTINGS,
        isValid,
        hasAllRequiredFilled,
      ),
    );
  }
};
