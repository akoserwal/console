import * as React from 'react';
import * as classNames from 'classnames';
import { Expandable } from '@patternfly/react-core';

import './result-tab-row.scss';

export const ResultTabRow: React.FC<ResultTabRowProps> = ({ title, content, isError }) => {
  if (!title && !content) {
    return null;
  }

  return (
    <Expandable
      toggleText={title || ''}
      className={classNames('kubevirt-create-vm-modal___result-tab-row-container', {
        'kubevirt-create-vm-modal___result-tab-row-container--error': isError,
      })}
    >
      <pre className="kubevirt-create-vm-modal__result-tab-row">{content}</pre>
    </Expandable>
  );
};

type ResultTabRowProps = {
  title: string;
  content: string;
  isError: boolean;
};
