import * as React from 'react';
import { match } from 'react-router-dom';
import * as _ from 'lodash';
import { connect } from 'react-redux';
import * as classNames from 'classnames';
import { sortable } from '@patternfly/react-table';
import { Status, SuccessStatus } from '@console/shared';
import { ErrorPage404 } from '@console/internal/components/error';
import {
  MultiListPage,
  ListPage,
  DetailsPage,
  Table,
  TableRow,
  TableData,
} from '@console/internal/components/factory';
import {
  ResourceSummary,
  StatusBox,
  navFactory,
  Timestamp,
  LabelList,
  MsgBox,
  ResourceKebab,
  Kebab,
  KebabAction,
  LoadingBox,
} from '@console/internal/components/utils';
import { connectToModel, connectToPlural } from '@console/internal/kinds';
import {
  apiVersionForReference,
  kindForReference,
  K8sResourceKind,
  OwnerReference,
  K8sKind,
  referenceFor,
  GroupVersionKind,
  referenceForModel,
  groupVersionFor,
} from '@console/internal/module/k8s';
import { deleteModal } from '@console/internal/components/modals';
import { RootState } from '@console/internal/redux';
import * as plugins from '@console/internal/plugins';
import { ClusterServiceVersionModel } from '../models';
import { ClusterServiceVersionKind } from '../types';
import { StatusDescriptor } from './descriptors/status';
import { SpecDescriptor } from './descriptors/spec';
import { StatusCapability, Descriptor } from './descriptors/types';
import { Resources } from './k8s-resource';
import { referenceForProvidedAPI, OperandLink } from './index';

const csvName = () =>
  window.location.pathname
    .split('/')
    .find(
      (part, i, allParts) =>
        allParts[i - 1] === referenceForModel(ClusterServiceVersionModel) ||
        allParts[i - 1] === ClusterServiceVersionModel.plural,
    );

const getActions = (selectedObj: any) => {
  const actions = plugins.registry
    .getClusterServiceVersionActions()
    .filter(
      (action) =>
        action.properties.kind === selectedObj.kind &&
        groupVersionFor(selectedObj.apiVersion).group === action.properties.apiGroup,
    );
  const pluginActions = actions.map((action) => (kind, ocsObj) => ({
    label: action.properties.label,
    callback: action.properties.callback(kind, ocsObj),
  }));
  return [
    ...pluginActions,
    (kind, obj) => ({
      label: `Edit ${kind.label}`,
      href: `/k8s/ns/${obj.metadata.namespace}/${
        ClusterServiceVersionModel.plural
      }/${csvName()}/${referenceFor(obj)}/${obj.metadata.name}/yaml`,
      accessReview: {
        group: kind.apiGroup,
        resource: kind.plural,
        name: obj.metadata.name,
        namespace: obj.metadata.namespace,
        verb: 'update',
      },
    }),

    (kind, obj) => ({
      label: `Delete ${kind.label}`,
      callback: () =>
        deleteModal({
          kind,
          resource: obj,
          namespace: obj.metadata.namespace,
          redirectTo: `/k8s/ns/${obj.metadata.namespace}/${
            ClusterServiceVersionModel.plural
          }/${csvName()}/${referenceFor(obj)}`,
        }),
      accessReview: {
        group: kind.apiGroup,
        resource: kind.plural,
        name: obj.metadata.name,
        namespace: obj.metadata.namespace,
        verb: 'delete',
      },
    }),
  ] as KebabAction[];
};

const tableColumnClasses = [
  classNames('col-lg-2', 'col-md-3', 'col-sm-4', 'col-xs-6'),
  classNames('col-lg-2', 'col-md-3', 'col-sm-4', 'col-xs-6'),
  classNames('col-lg-2', 'col-md-3', 'col-sm-4', 'hidden-xs'),
  classNames('col-lg-2', 'col-md-3', 'hidden-sm', 'hidden-xs'),
  classNames('col-lg-2', 'hidden-md', 'hidden-sm', 'hidden-xs'),
  classNames('col-lg-2', 'hidden-md', 'hidden-sm', 'hidden-xs'),
  Kebab.columnClass,
];

export const OperandTableHeader = () => {
  return [
    {
      title: 'Name',
      sortField: 'metadata.name',
      transforms: [sortable],
      props: { className: tableColumnClasses[0] },
    },
    {
      title: 'Labels',
      sortField: 'metadata.labels',
      transforms: [sortable],
      props: { className: tableColumnClasses[1] },
    },
    {
      title: 'Kind',
      sortField: 'kind',
      transforms: [sortable],
      props: { className: tableColumnClasses[2] },
    },
    {
      title: 'Status',
      sortField: 'status.phase',
      transforms: [sortable],
      props: { className: tableColumnClasses[3] },
    },
    {
      title: 'Version',
      sortField: 'spec.version',
      transforms: [sortable],
      props: { className: tableColumnClasses[4] },
    },
    {
      title: 'Last Updated',
      sortField: 'metadata.creationTimestamp',
      transforms: [sortable],
      props: { className: tableColumnClasses[5] },
    },
    {
      title: '',
      props: { className: tableColumnClasses[6] },
    },
  ];
};

export const OperandTableRow: React.FC<OperandTableRowProps> = ({ obj, index, key, style }) => {
  const status = _.get(obj.status, 'phase');
  return (
    <TableRow id={obj.metadata.uid} index={index} trKey={key} style={style}>
      <TableData className={tableColumnClasses[0]}>
        <OperandLink obj={obj} />
      </TableData>
      <TableData className={tableColumnClasses[1]}>
        <LabelList kind={obj.kind} labels={obj.metadata.labels} />
      </TableData>
      <TableData className={classNames(tableColumnClasses[2], 'co-break-word')}>
        {obj.kind}
      </TableData>
      <TableData className={tableColumnClasses[3]}>
        {_.isEmpty(status) ? (
          <div className="text-muted">Unknown</div>
        ) : (
          <>
            {status === 'Running' ? <SuccessStatus title={status} /> : <Status status={status} />}
          </>
        )}
      </TableData>
      <TableData className={tableColumnClasses[4]}>
        {_.get(obj.spec, 'version') || <div className="text-muted">Unknown</div>}
      </TableData>
      <TableData className={tableColumnClasses[5]}>
        <Timestamp timestamp={obj.metadata.creationTimestamp} />
      </TableData>
      <TableData className={tableColumnClasses[6]}>
        <ResourceKebab actions={getActions(obj)} kind={referenceFor(obj)} resource={obj} />
      </TableData>
    </TableRow>
  );
};

export const OperandList: React.SFC<OperandListProps> = (props) => {
  const ensureKind = (data: K8sResourceKind[]) =>
    data.map((obj) => {
      if (obj.apiVersion && obj.kind) {
        return obj;
      }
      const reference = props.kinds[0];
      return {
        apiVersion: apiVersionForReference(reference),
        kind: kindForReference(reference),
        ...obj,
      };
    });
  const EmptyMsg = () => (
    <MsgBox
      title="No Operands Found"
      detail="Operands are declarative components used to define the behavior of the application."
    />
  );

  return (
    <Table
      {...props}
      data={ensureKind(props.data)}
      EmptyMsg={EmptyMsg}
      aria-label="Operands"
      Header={OperandTableHeader}
      Row={OperandTableRow}
      virtualize
    />
  );
};

const inFlightStateToProps = ({ k8s }: RootState) => ({
  inFlight: k8s.getIn(['RESOURCES', 'inFlight']),
});

export const ProvidedAPIsPage = connect(inFlightStateToProps)((props: ProvidedAPIsPageProps) => {
  const { obj } = props;
  const { owned = [] } = obj.spec.customresourcedefinitions;
  const firehoseResources = owned.map((desc) => ({
    kind: referenceForProvidedAPI(desc),
    namespaced: true,
    prop: desc.kind,
  }));

  const EmptyMsg = () => (
    <MsgBox
      title="No Provided APIs Defined"
      detail="This application was not properly installed or configured."
    />
  );
  const createLink = (name: string) =>
    `/k8s/ns/${obj.metadata.namespace}/${ClusterServiceVersionModel.plural}/${
      obj.metadata.name
    }/${referenceForProvidedAPI(_.find(owned, { name }))}/~new`;
  const createProps =
    owned.length > 1
      ? {
          items: owned.reduce((acc, crd) => ({ ...acc, [crd.name]: crd.displayName }), {}),
          createLink,
        }
      : { to: owned.length === 1 ? createLink(owned[0].name) : null };

  const owners = (ownerRefs: OwnerReference[], items: K8sResourceKind[]) =>
    ownerRefs.filter(({ uid }) => items.filter(({ metadata }) => metadata.uid === uid).length > 0);
  const flatten = (resources: { [kind: string]: { data: K8sResourceKind[] } }) =>
    _.flatMap(resources, (resource) => _.map(resource.data, (item) => item)).filter(
      ({ kind, metadata }, i, allResources) =>
        owned.filter((item) => item.kind === kind).length > 0 ||
        owners(metadata.ownerReferences || [], allResources).length > 0,
    );

  const rowFilters = [
    {
      type: 'clusterserviceversion-resource-kind',
      selected: firehoseResources.map(({ kind }) => kindForReference(kind)),
      reducer: ({ kind }) => kind,
      items: firehoseResources.map(({ kind }) => ({
        id: kindForReference(kind),
        title: kindForReference(kind),
      })),
    },
  ];

  if (props.inFlight) {
    return null;
  }

  return firehoseResources.length > 0 ? (
    <MultiListPage
      {...props}
      ListComponent={OperandList}
      filterLabel="Resources by name"
      resources={firehoseResources}
      namespace={obj.metadata.namespace}
      canCreate={owned.length > 0}
      createProps={createProps}
      createButtonText={owned.length > 1 ? 'Create New' : `Create ${owned[0].displayName}`}
      flatten={flatten}
      rowFilters={firehoseResources.length > 1 ? rowFilters : null}
    />
  ) : (
    <StatusBox loaded EmptyMsg={EmptyMsg} />
  );
});

export const ProvidedAPIPage = connectToModel((props: ProvidedAPIPageProps) => {
  const { namespace, kind, kindsInFlight, kindObj, csv } = props;

  if (!kindObj) {
    return kindsInFlight ? (
      <LoadingBox />
    ) : (
      <ErrorPage404
        message={`The server doesn't have a resource type ${kindForReference(
          kind,
        )}. Try refreshing the page if it was recently added.`}
      />
    );
  }

  return (
    <ListPage
      kind={kind}
      ListComponent={OperandList}
      canCreate={_.get(kindObj, 'verbs', [] as string[]).some((v) => v === 'create')}
      createProps={{
        to: `/k8s/ns/${csv.metadata.namespace}/${ClusterServiceVersionModel.plural}/${
          csv.metadata.name
        }/${kind}/~new`,
      }}
      namespace={_.get(kindObj, 'namespaced') ? namespace : null}
    />
  );
});

export const OperandDetails = connectToModel((props: OperandDetailsProps) => {
  // TODO(alecmerdler): Use additional `x-descriptor` to specify if should be considered main?
  const isMainDescriptor = (descriptor: Descriptor) => {
    return ((descriptor['x-descriptors'] as StatusCapability[]) || []).some((type) => {
      switch (type) {
        case StatusCapability.podStatuses:
          return true;
        default:
          return false;
      }
    });
  };

  const blockValue = (descriptor: Descriptor, block: { [key: string]: any }) =>
    !_.isEmpty(descriptor) ? _.get(block, descriptor.path, descriptor.value) : undefined;

  const { kind, metadata, spec, status } = props.obj;

  // Find the matching CRD spec for the kind of this resource in the CSV.
  const ownedDefinitions = _.get(
    props.clusterServiceVersion,
    'spec.customresourcedefinitions.owned',
    [],
  );
  const reqDefinitions = _.get(
    props.clusterServiceVersion,
    'spec.customresourcedefinitions.required',
    [],
  );
  const thisDefinition = _.find(
    ownedDefinitions.concat(reqDefinitions),
    (def) => def.name.split('.')[0] === props.kindObj.plural,
  );
  const statusDescriptors = _.get<Descriptor[]>(thisDefinition, 'statusDescriptors', []);
  const specDescriptors = _.get<Descriptor[]>(thisDefinition, 'specDescriptors', []);
  const currentStatus = _.find(statusDescriptors, { displayName: 'Status' });
  const primaryDescriptors = statusDescriptors.filter((descriptor) => isMainDescriptor(descriptor));

  const header = (
    <h2 className="co-section-heading">{`${
      thisDefinition ? thisDefinition.displayName : kind
    } Overview`}</h2>
  );

  const primaryDescriptor = primaryDescriptors.map((statusDescriptor: Descriptor) => {
    return (
      <div className="row" key={statusDescriptor.displayName}>
        <div className="col-sm-6 col-md-4">
          <StatusDescriptor
            descriptor={statusDescriptor}
            value={blockValue(statusDescriptor, status)}
            obj={props.obj}
            model={props.kindObj}
          />
        </div>
      </div>
    );
  });

  const details = (
    <div className="co-operand-details__section co-operand-details__section--info">
      <div className="row">
        <div className="col-xs-6">
          <ResourceSummary resource={props.obj} />
        </div>
        {currentStatus && (
          <div className="col-xs-6" key={currentStatus.path}>
            <StatusDescriptor
              namespace={metadata.namespace}
              obj={props.obj}
              model={props.kindObj}
              descriptor={currentStatus}
              value={blockValue(currentStatus, status)}
            />
          </div>
        )}

        {specDescriptors.map((specDescriptor: Descriptor) => (
          <div key={specDescriptor.path} className="col-xs-6">
            <SpecDescriptor
              namespace={metadata.namespace}
              obj={props.obj}
              model={props.kindObj}
              value={blockValue(specDescriptor, spec)}
              descriptor={specDescriptor}
            />
          </div>
        ))}

        {statusDescriptors
          .filter(function(descriptor) {
            return !isMainDescriptor(descriptor) && descriptor.displayName !== 'Status';
          })
          .map((statusDescriptor: Descriptor) => {
            const statusValue = blockValue(statusDescriptor, status);
            return (
              <div className="col-xs-6" key={statusDescriptor.path}>
                <StatusDescriptor
                  namespace={metadata.namespace}
                  obj={props.obj}
                  model={props.kindObj}
                  descriptor={statusDescriptor}
                  value={statusValue}
                />
              </div>
            );
          })}
      </div>
    </div>
  );

  return (
    <div className="co-operand-details co-m-pane">
      {_.isEmpty(primaryDescriptors) ? (
        <div className="co-m-pane__body">
          {header}
          {details}
        </div>
      ) : (
        <React.Fragment>
          <div className="co-m-pane__body">
            {header}
            {primaryDescriptor}
          </div>
          <div className="co-m-pane__body">{details}</div>
        </React.Fragment>
      )}
    </div>
  );
});

const ResourcesTab = (resourceProps) => (
  <Resources {...resourceProps} clusterServiceVersion={resourceProps.csv} />
);

export const OperandDetailsPage = connectToPlural((props: OperandDetailsPageProps) => (
  <DetailsPage
    match={props.match}
    name={props.match.params.name}
    kind={props.modelRef}
    namespace={props.match.params.ns}
    resources={[
      {
        kind: referenceForModel(ClusterServiceVersionModel),
        name: props.match.params.appName,
        namespace: props.match.params.ns,
        isList: false,
        prop: 'csv',
      },
    ]}
    menuActions={getActions(props.modelRef)}
    breadcrumbsFor={() => [
      {
        name: 'Installed Operators',
        path: `/k8s/ns/${props.match.params.ns}/${ClusterServiceVersionModel.plural}`,
      },
      {
        name: props.match.params.appName,
        path: props.match.url.slice(0, props.match.url.lastIndexOf('/')),
      },
      { name: `${kindForReference(props.modelRef)} Details`, path: `${props.match.url}` },
    ]}
    pages={[
      navFactory.details((detailsProps) => (
        <OperandDetails
          {...detailsProps}
          clusterServiceVersion={detailsProps.csv}
          appName={props.match.params.appName}
        />
      )),
      navFactory.editYaml(),
      {
        name: 'Resources',
        href: 'resources',
        component: ResourcesTab,
      },
    ]}
  />
));

export type OperandListProps = {
  loaded: boolean;
  kinds?: GroupVersionKind[];
  data: K8sResourceKind[];
  filters: { [key: string]: any };
  reduxID?: string;
  reduxIDs?: string[];
  rowSplitter?: any;
  staticFilters?: any;
};

export type OperandHeaderProps = {
  data: K8sResourceKind[];
};

export type OperandRowProps = {
  obj: K8sResourceKind;
};

export type ProvidedAPIsPageProps = {
  obj: ClusterServiceVersionKind;
  inFlight?: boolean;
};

export type ProvidedAPIPageProps = {
  csv: ClusterServiceVersionKind;
  kindsInFlight?: boolean;
  kind: GroupVersionKind;
  kindObj: K8sKind;
  namespace: string;
};

export type OperandDetailsProps = {
  obj: K8sResourceKind;
  appName: string;
  kindObj: K8sKind;
  clusterServiceVersion: ClusterServiceVersionKind;
};

export type OperandDetailsPageProps = {
  modelRef: GroupVersionKind;
  match: match<{
    name: string;
    ns: string;
    appName: string;
  }>;
};

export type OperandesourceDetailsProps = {
  csv?: { data: ClusterServiceVersionKind };
  kind: GroupVersionKind;
  name: string;
  namespace: string;
  match: match<{ appName: string }>;
};

export type OperandTableRowProps = {
  obj: K8sResourceKind;
  index: number;
  key?: string;
  style: object;
};

// TODO(alecmerdler): Find Webpack loader/plugin to add `displayName` to React components automagically
OperandList.displayName = 'OperandList';
OperandDetails.displayName = 'OperandDetails';
OperandList.displayName = 'OperandList';
ProvidedAPIsPage.displayName = 'ProvidedAPIsPage';
OperandDetailsPage.displayName = 'OperandDetailsPage';
OperandTableRow.displayName = 'OperandTableRow';
OperandTableHeader.displayName = 'OperandTableHeader';
