import * as _ from 'lodash-es';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ActionGroup, Button } from '@patternfly/react-core';

import { k8sCreate, K8sResourceKind, referenceFor } from '../../module/k8s';
import { AsyncComponent, ButtonBar, RequestSizeInput, history, resourceObjPath } from '../utils';
import { StorageClassDropdown } from '../utils/storage-class-dropdown';
import { RadioInput } from '../radio';
import { Checkbox } from '../checkbox';
import { PersistentVolumeClaimModel } from '../../models/index';
import { isCephProvisioner } from '@console/ceph-storage-plugin/src/selectors';

const NameValueEditorComponent = (props) => (
  <AsyncComponent
    loader={() => import('../utils/name-value-editor').then((c) => c.NameValueEditor)}
    {...props}
  />
);

//See https://kubernetes.io/docs/concepts/storage/persistent-volumes/#types-of-persistent-volumes for more details
const provisionerAccessModeMapping = {
  'kubernetes.io/no-provisioner': ['ReadWriteOnce'],
  'kubernetes.io/aws-ebs': ['ReadWriteOnce'],
  'kubernetes.io/gce-pd': ['ReadWriteOnce', 'ReadOnlyMany'],
  'kubernetes.io/glusterfs': ['ReadWriteOnce', 'ReadWriteMany', 'ReadOnlyMany'],
  'kubernetes.io/cinder': ['ReadWriteOnce'],
  'kubernetes.io/azure-file': ['ReadWriteOnce', 'ReadWriteMany', 'ReadOnlyMany'],
  'kubernetes.io/azure-disk': ['ReadWriteOnce'],
  'kubernetes.io/quobyte': ['ReadWriteOnce', 'ReadWriteMany', 'ReadOnlyMany'],
  'kubernetes.io/rbd': ['ReadWriteOnce', 'ReadOnlyMany'],
  'kubernetes.io/vsphere-volume': ['ReadWriteOnce', 'ReadWriteMany'],
  'kubernetes.io/portworx-volume': ['ReadWriteOnce', 'ReadWriteMany'],
  'kubernetes.io/scaleio': ['ReadWriteOnce', 'ReadOnlyMany'],
  'kubernetes.io/storageos': ['ReadWriteOnce'],
};

// This form is done a little odd since it is used in both its own page and as
// a sub form inside the attach storage page.
export class CreatePVCForm extends React.Component<CreatePVCFormProps, CreatePVCFormState> {
  state = {
    storageClass: '',
    allowedAccessModes: ['ReadWriteOnce', 'ReadWriteMany', 'ReadOnlyMany'],
    pvcName: '',
    accessMode: 'ReadWriteOnce',
    requestSizeValue: '',
    requestSizeUnit: 'Gi',
    disableForm: false,
    useSelector: false,
    nameValuePairs: [['', '']],
    accessModeHelp: 'Permissions to the mounted drive.',
    accessModeRadios: [
      {
        value: 'ReadWriteOnce',
        title: 'Single User (RWO)',
      },
      {
        value: 'ReadWriteMany',
        title: 'Shared Access (RWX)',
      },
      {
        value: 'ReadOnlyMany',
        title: 'Read Only (ROX)',
      },
    ],
    dropdownUnits: {
      Mi: 'Mi',
      Gi: 'Gi',
      Ti: 'Ti',
    },
  };

  handleChange: React.ReactEventHandler<HTMLInputElement> = (event) => {
    // this handles pvcName, accessMode, size
    const { name, value } = event.currentTarget;
    this.setState({ [name]: value } as any, this.onChange);
  };

  handleNameValuePairs = ({ nameValuePairs }) => {
    this.setState({ nameValuePairs }, this.onChange);
  };

  getAccessModeForProvisioner = (provisioner: string) => {
    return provisioner && isCephProvisioner(provisioner)
      ? ['ReadWriteOnce', 'ReadWriteMany']
      : ['ReadWriteOnce', 'ReadWriteMany', 'ReadOnlyMany'];
  };

  handleStorageClass = (storageClass) => {
    //if the provisioner is unknown or no storage class selected, user should be able to set any access mode
    const modes =
      storageClass &&
      storageClass.provisioner &&
      provisionerAccessModeMapping[storageClass.provisioner]
        ? provisionerAccessModeMapping[storageClass.provisioner]
        : this.getAccessModeForProvisioner(storageClass.provisioner);
    //setting message to display for various modes when a storage class of a know provisioner is selected
    const displayMessage =
      storageClass &&
      (provisionerAccessModeMapping[storageClass.provisioner] ||
        isCephProvisioner(storageClass.provisioner))
        ? 'Access mode is set by storage class and cannot be changed.'
        : 'Permissions to the mounted drive.';
    this.setState({ accessModeHelp: displayMessage }, this.onChange);

    //setting accessMode to default with the change to Storage Class selection
    this.setState(
      {
        storageClass: _.get(storageClass, 'metadata.name'),
        allowedAccessModes: modes,
        accessMode: 'ReadWriteOnce',
      },
      this.onChange,
    );
  };

  handleRequestSizeInputChange = (obj) => {
    this.setState({ requestSizeValue: obj.value, requestSizeUnit: obj.unit }, this.onChange);
  };

  handleUseSelector: React.ReactEventHandler<HTMLInputElement> = (event) => {
    this.setState({ useSelector: event.currentTarget.checked }, this.onChange);
  };

  getSelector() {
    const { nameValuePairs, useSelector } = this.state;
    if (!useSelector) {
      return null;
    }

    const matchLabels = _.reduce(
      nameValuePairs,
      (acc, [key, value]) => {
        return key ? { ...acc, [key]: value } : acc;
      },
      {},
    );

    return _.isEmpty(matchLabels) ? null : { matchLabels };
  }

  onChange = () => {
    return this.props.onChange(this.updatePVC());
  };

  updatePVC = () => {
    const { namespace } = this.props;
    const { pvcName, accessMode, requestSizeValue, requestSizeUnit, storageClass } = this.state;
    const obj: K8sResourceKind = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: pvcName,
        namespace,
      },
      spec: {
        accessModes: [accessMode],
        resources: {
          requests: {
            storage: `${requestSizeValue}${requestSizeUnit}`,
          },
        },
      },
    };

    // Add the selector only if specified.
    const selector = this.getSelector();
    if (selector) {
      obj.spec.selector = selector;
    }

    if (storageClass) {
      obj.spec.storageClassName = storageClass;
    }

    return obj;
  };

  render() {
    const {
      accessMode,
      dropdownUnits,
      useSelector,
      nameValuePairs,
      requestSizeUnit,
      requestSizeValue,
      allowedAccessModes,
    } = this.state;

    return (
      <div>
        <div className="form-group">
          <StorageClassDropdown
            onChange={this.handleStorageClass}
            id="storageclass-dropdown"
            describedBy="storageclass-dropdown-help"
            required={false}
            name="storageClass"
          />
        </div>
        <label className="control-label co-required" htmlFor="pvc-name">
          Persistent Volume Claim Name
        </label>
        <div className="form-group">
          <input
            className="pf-c-form-control"
            type="text"
            onChange={this.handleChange}
            placeholder="my-storage-claim"
            aria-describedby="pvc-name-help"
            id="pvc-name"
            name="pvcName"
            pattern="[a-z0-9](?:[-a-z0-9]*[a-z0-9])?"
            required
          />
          <p className="help-block" id="pvc-name-help">
            A unique name for the storage claim within the project.
          </p>
        </div>
        <label className="control-label co-required" htmlFor="access-mode">
          Access Mode
        </label>
        <div className="form-group">
          {this.state.accessModeRadios.map((radio) => {
            let radioObj = null;
            const disabled = !allowedAccessModes.includes(radio.value);

            allowedAccessModes.forEach((mode) => {
              const checked = !disabled ? radio.value === accessMode : radio.value === mode;
              radioObj = (
                <RadioInput
                  {...radio}
                  key={radio.value}
                  onChange={this.handleChange}
                  inline={true}
                  disabled={disabled}
                  checked={checked}
                  aria-describedby="access-mode-help"
                  name="accessMode"
                />
              );
            });

            return radioObj;
          })}
          <p className="help-block" id="access-mode-help">
            {this.state.accessModeHelp}
          </p>
        </div>
        <label className="control-label co-required" htmlFor="request-size-input">
          Size
        </label>
        <RequestSizeInput
          name="requestSize"
          required={false}
          onChange={this.handleRequestSizeInputChange}
          defaultRequestSizeUnit={requestSizeUnit}
          defaultRequestSizeValue={requestSizeValue}
          dropdownUnits={dropdownUnits}
          describedBy="request-size-help"
        />
        <p className="help-block" id="request-size-help">
          Desired storage capacity.
        </p>
        <Checkbox
          label="Use label selectors to request storage"
          onChange={this.handleUseSelector}
          checked={useSelector}
          name="showLabelSelector"
        />
        <div className="form-group">
          {useSelector && (
            <NameValueEditorComponent
              nameValuePairs={nameValuePairs}
              valueString="Selector"
              nameString="Label"
              addString="Add Value"
              readOnly={false}
              allowSorting={false}
              updateParentData={this.handleNameValuePairs}
            />
          )}
          <p className="help-block" id="label-selector-help">
            Use label selectors to define how storage is created.
          </p>
        </div>
      </div>
    );
  }
}

class CreatePVCPage extends React.Component<CreatePVCPageProps, CreatePVCPageState> {
  state = {
    error: '',
    inProgress: false,
    title: 'Create Persistent Volume Claim',
    pvcObj: null,
  };

  onChange = (pvcObj: K8sResourceKind) => {
    this.setState({ pvcObj });
  };

  save = (e: React.FormEvent<EventTarget>) => {
    e.preventDefault();
    this.setState({ inProgress: true });
    k8sCreate(PersistentVolumeClaimModel, this.state.pvcObj).then(
      (resource) => {
        this.setState({ inProgress: false });
        history.push(resourceObjPath(resource, referenceFor(resource)));
      },
      (err) => this.setState({ error: err.message, inProgress: false }),
    );
  };

  render() {
    const { title, error, inProgress } = this.state;
    const { namespace } = this.props;
    return (
      <div className="co-m-pane__body co-m-pane__form">
        <Helmet>
          <title>{title}</title>
        </Helmet>
        <h1 className="co-m-pane__heading co-m-pane__heading--baseline">
          <div className="co-m-pane__name">{title}</div>
          <div className="co-m-pane__heading-link">
            <Link to={`/k8s/ns/${namespace}/persistentvolumeclaims/~new`} id="yaml-link" replace>
              Edit YAML
            </Link>
          </div>
        </h1>
        <form className="co-m-pane__body-group" onSubmit={this.save}>
          <CreatePVCForm onChange={this.onChange} namespace={namespace} />
          <ButtonBar errorMessage={error} inProgress={inProgress}>
            <ActionGroup className="pf-c-form">
              <Button id="save-changes" type="submit" variant="primary">
                Create
              </Button>
              <Button onClick={history.goBack} type="button" variant="secondary">
                Cancel
              </Button>
            </ActionGroup>
          </ButtonBar>
        </form>
      </div>
    );
  }
}

export const CreatePVC = ({ match: { params } }) => {
  return <CreatePVCPage namespace={params.ns} />;
};

export type StorageClassDropdownProps = {
  namespace: string;
  selectedKey: string;
  required: boolean;
  onChange: (string) => void;
  id: string;
  name: string;
  placeholder?: string;
};

export type CreatePVCFormProps = {
  namespace: string;
  onChange: Function;
};

export type CreatePVCFormState = {
  storageClass: string;
  allowedAccessModes: string[];
  pvcName: string;
  accessMode: string;
  requestSizeValue: string;
  requestSizeUnit: string;
  disableForm: boolean;
  accessModeRadios: { value: string; title: string }[];
  dropdownUnits: { [key: string]: string };
  useSelector: boolean;
  nameValuePairs: string[][];
  accessModeHelp: string;
};

export type CreatePVCPageProps = {
  namespace: string;
};

export type CreatePVCPageState = {
  inProgress: boolean;
  error: string;
  title: string;
  pvcObj: K8sResourceKind;
};
