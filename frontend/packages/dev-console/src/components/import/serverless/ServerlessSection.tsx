import * as React from 'react';
import { connectToFlags, FlagsObject } from '@console/internal/reducers/features';
import { FLAG_KNATIVE_SERVING_SERVICE, ServiceModel } from '@console/knative-plugin';
import { TechPreviewBadge } from '@console/shared';
import { Split, SplitItem } from '@patternfly/react-core';
import { useAccessReview } from '@console/internal/components/utils';
import { getActiveNamespace } from '@console/internal/actions/ui';
import { CheckboxField } from '../../formik-fields';
import FormSection from '../section/FormSection';

type ServerlessSectionProps = {
  flags: FlagsObject;
};

const ServerlessSection: React.FC<ServerlessSectionProps> = ({ flags }) => {
  const knativeServiceAccess = useAccessReview({
    group: ServiceModel.apiGroup,
    resource: ServiceModel.plural,
    namespace: getActiveNamespace(),
    verb: 'create',
  });

  if (flags[FLAG_KNATIVE_SERVING_SERVICE] && knativeServiceAccess) {
    const title = (
      <Split gutter="md">
        <SplitItem className="odc-form-section__heading">Serverless</SplitItem>
        <SplitItem>
          <TechPreviewBadge />
        </SplitItem>
      </Split>
    );
    return (
      <FormSection title={title}>
        <CheckboxField label="Enable scaling to zero when idle" name="serverless.enabled" />
      </FormSection>
    );
  }

  return null;
};

export default connectToFlags(FLAG_KNATIVE_SERVING_SERVICE)(ServerlessSection);
