import * as React from 'react';
import { FormGroup } from '@patternfly/react-core';
import { HelpIcon } from '@patternfly/react-icons';
import { LoadingInline } from '@console/internal/components/utils';
import { PopoverStatus, ValidationErrorType } from '@console/shared';
import './form-row.scss';

export const FormRow: React.FC<FormRowProps> = ({
  fieldId,
  title,
  help,
  isHidden,
  isRequired,
  isLoading,
  validationMessage,
  validationType,
  validation,
  children,
}) => {
  if (isHidden) {
    return null;
  }

  return (
    <FormGroup
      label={title}
      isRequired={isRequired}
      fieldId={fieldId}
      isValid={((validation && validation.type) || validationType) !== ValidationErrorType.Error}
      helperTextInvalid={(validation && validation.message) || validationMessage}
    >
      {help && (
        <span className="kubevirt-form-row__icon-status-container">
          <PopoverStatus
            icon={<HelpIcon className="kubevirt-form-row__help-icon--hidden" />}
            activeIcon={<HelpIcon />}
            title={`${fieldId} help`}
            iconOnly
            hideHeader
          >
            {help}
          </PopoverStatus>
        </span>
      )}
      {isLoading && (
        <span className="kubevirt-form-row__loading-container">
          <LoadingInline />
        </span>
      )}
      {children}
    </FormGroup>
  );
};

type FormRowProps = {
  fieldId: string;
  title?: string;
  help?: string;
  helpTitle?: string;
  isHidden?: boolean;
  isRequired?: boolean;
  isLoading?: boolean;
  validationMessage?: string;
  validationType?: ValidationErrorType;
  validation?: {
    message?: string;
    type?: ValidationErrorType;
  };
  children?: React.ReactNode;
};
