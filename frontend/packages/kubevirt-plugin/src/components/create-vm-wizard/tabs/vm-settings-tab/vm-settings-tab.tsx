import * as React from 'react';
import {
  Checkbox,
  FormSelect,
  FormSelectOption,
  TextArea,
  TextInput,
} from '@patternfly/react-core';
import { connect } from 'react-redux';
import { iGet, iGetIn } from '../../../../utils/immutable';
import { FormFieldMemoRow } from '../../form/form-field-row';
import { FormField, FormFieldType } from '../../form/form-field';
import { FormSelectPlaceholderOption } from '../../../form/form-select-placeholder-option';
import { vmWizardActions } from '../../redux/actions';
import {
  VMSettingsField,
  VMSettingsRenderableField,
  VMWizardProps,
  VMWizardStorage,
} from '../../types';
import { iGetVmSettings } from '../../selectors/immutable/vm-settings';
import { ActionType } from '../../redux/types';
import { getFieldId, getPlaceholder } from '../../utils/vm-settings-tab-utils';
import { iGetCommonData } from '../../selectors/immutable/selectors';
import { FormFieldForm } from '../../form/form-field-form';
import { iGetProvisionSourceStorage } from '../../selectors/immutable/storage';
import { WorkloadProfile } from './workload-profile';
import { OSFlavor } from './os-flavor';
import { UserTemplates } from './user-templates';
import { MemoryCPU } from './memory-cpu';
import { ContainerSource } from './container-source';
import { URLSource } from './url-source';

import './vm-settings-tab.scss';

export class VMSettingsTabComponent extends React.Component<VMSettingsTabComponentProps> {
  getField = (key) => iGet(this.props.vmSettings, key);

  getFieldAttribute = (key, attribute) => iGetIn(this.props.vmSettings, [key, attribute]);

  getFieldValue = (key) => iGetIn(this.props.vmSettings, [key, 'value']);

  onChange = (key) => (value) => this.props.onFieldChange(key, value);

  render() {
    const {
      userTemplates,
      commonTemplates,
      provisionSourceStorage,
      updateStorage,
      isReview,
    } = this.props;

    return (
      <FormFieldForm isReview={isReview}>
        {!isReview && (
          <UserTemplates
            key={VMSettingsField.USER_TEMPLATE}
            userTemplateField={this.getField(VMSettingsField.USER_TEMPLATE)}
            userTemplates={userTemplates}
            commonTemplates={commonTemplates}
            onChange={this.props.onFieldChange}
          />
        )}
        <FormFieldMemoRow
          field={this.getField(VMSettingsField.PROVISION_SOURCE_TYPE)}
          fieldType={FormFieldType.SELECT}
        >
          <FormField>
            <FormSelect onChange={this.onChange(VMSettingsField.PROVISION_SOURCE_TYPE)}>
              <FormSelectPlaceholderOption
                placeholder={getPlaceholder(VMSettingsField.PROVISION_SOURCE_TYPE)}
                isDisabled={!!this.getFieldValue(VMSettingsField.PROVISION_SOURCE_TYPE)}
              />
              {(this.getFieldAttribute(VMSettingsField.PROVISION_SOURCE_TYPE, 'sources') || []).map(
                (source) => {
                  return <FormSelectOption key={source} value={source} label={source} />;
                },
              )}
            </FormSelect>
          </FormField>
        </FormFieldMemoRow>
        <ContainerSource
          field={this.getField(VMSettingsField.CONTAINER_IMAGE)}
          onProvisionSourceStorageChange={updateStorage}
          provisionSourceStorage={provisionSourceStorage}
        />
        <URLSource
          field={this.getField(VMSettingsField.IMAGE_URL)}
          onProvisionSourceStorageChange={updateStorage}
          provisionSourceStorage={provisionSourceStorage}
        />
        <OSFlavor
          userTemplates={userTemplates}
          commonTemplates={commonTemplates}
          operatinSystemField={this.getField(VMSettingsField.OPERATING_SYSTEM)}
          flavorField={this.getField(VMSettingsField.FLAVOR)}
          userTemplate={this.getFieldValue(VMSettingsField.USER_TEMPLATE)}
          workloadProfile={this.getFieldValue(VMSettingsField.WORKLOAD_PROFILE)}
          onChange={this.props.onFieldChange}
        />
        <MemoryCPU
          memoryField={this.getField(VMSettingsField.MEMORY)}
          cpuField={this.getField(VMSettingsField.CPU)}
          onChange={this.props.onFieldChange}
          isReview={isReview}
        />
        <WorkloadProfile
          userTemplates={userTemplates}
          commonTemplates={commonTemplates}
          workloadProfileField={this.getField(VMSettingsField.WORKLOAD_PROFILE)}
          userTemplate={this.getFieldValue(VMSettingsField.USER_TEMPLATE)}
          operatingSystem={this.getFieldValue(VMSettingsField.OPERATING_SYSTEM)}
          flavor={this.getFieldValue(VMSettingsField.FLAVOR)}
          onChange={this.props.onFieldChange}
        />
        <FormFieldMemoRow
          field={this.getField(VMSettingsField.NAME)}
          fieldType={FormFieldType.TEXT}
        >
          <FormField>
            <TextInput onChange={this.onChange(VMSettingsField.NAME)} />
          </FormField>
        </FormFieldMemoRow>
        <FormFieldMemoRow
          field={this.getField(VMSettingsField.DESCRIPTION)}
          fieldType={FormFieldType.TEXT_AREA}
        >
          <FormField>
            <TextArea
              onChange={this.onChange(VMSettingsField.DESCRIPTION)}
              className="kubevirt-create-vm-modal__description"
            />
          </FormField>
        </FormFieldMemoRow>
        <FormFieldMemoRow
          field={this.getField(VMSettingsField.START_VM)}
          fieldType={FormFieldType.INLINE_CHECKBOX}
        >
          <FormField>
            <Checkbox
              className="kubevirt-create-vm-modal__start_vm_checkbox"
              id={getFieldId(VMSettingsField.START_VM)}
              onChange={this.onChange(VMSettingsField.START_VM)}
            />
          </FormField>
        </FormFieldMemoRow>
      </FormFieldForm>
    );
  }
}

const stateToProps = (state, { wizardReduxID }) => ({
  vmSettings: iGetVmSettings(state, wizardReduxID),
  commonTemplates: iGetCommonData(state, wizardReduxID, VMWizardProps.commonTemplates),
  userTemplates: iGetCommonData(state, wizardReduxID, VMWizardProps.userTemplates),
  provisionSourceStorage: iGetProvisionSourceStorage(state, wizardReduxID),
});

type VMSettingsTabComponentProps = {
  onFieldChange: (key: VMSettingsRenderableField, value: string) => void;
  updateStorage: (storage: VMWizardStorage) => void;
  vmSettings: any;
  provisionSourceStorage: VMWizardStorage;
  commonTemplates: any;
  userTemplates: any;
  isReview: boolean;
};

const dispatchToProps = (dispatch, props) => ({
  onFieldChange: (key, value) =>
    dispatch(vmWizardActions[ActionType.SetVmSettingsFieldValue](props.wizardReduxID, key, value)),
  updateStorage: (storage: VMWizardStorage) => {
    dispatch(vmWizardActions[ActionType.UpdateStorage](props.wizardReduxID, storage));
  },
});

export const VMSettingsTab = connect(
  stateToProps,
  dispatchToProps,
)(VMSettingsTabComponent);
