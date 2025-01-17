import * as React from 'react';
import * as _ from 'lodash';
import { Link } from 'react-router-dom';
import { K8sResourceKind } from '@console/internal/module/k8s';
import { SidebarSectionHeading } from '@console/internal/components/utils';
import { getActiveNamespace } from '@console/internal/actions/ui';
import TopologyApplicationResourceList from './TopologyApplicationList';

const MAX_RESOURCES = 5;

export type ApplicationGroupResourceProps = {
  title: string;
  kind: string;
  resourcesData: K8sResourceKind[];
  group: string;
};

const ApplicationGroupResource: React.FC<ApplicationGroupResourceProps> = ({
  title,
  kind,
  resourcesData,
  group,
}) => {
  return (
    <React.Fragment>
      {!_.isEmpty(resourcesData) ? (
        <div className="overview__sidebar-pane-body">
          <SidebarSectionHeading text={title}>
            {_.size(resourcesData) > MAX_RESOURCES && (
              <Link
                className="sidebar__section-view-all"
                to={`/search/ns/${getActiveNamespace()}?kind=${kind}&q=${encodeURIComponent(
                  `app.kubernetes.io/part-of=${group}`,
                )}`}
              >
                {`View All (${_.size(resourcesData)})`}
              </Link>
            )}
          </SidebarSectionHeading>
          <TopologyApplicationResourceList resources={_.take(resourcesData, MAX_RESOURCES)} />
        </div>
      ) : null}
    </React.Fragment>
  );
};

export default ApplicationGroupResource;
