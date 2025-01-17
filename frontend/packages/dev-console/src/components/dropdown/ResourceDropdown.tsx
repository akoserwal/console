import * as _ from 'lodash';
import * as React from 'react';
import * as fuzzy from 'fuzzysearch';
import { Dropdown, LoadingInline } from '@console/internal/components/utils';
import { K8sResourceKind } from '@console/internal/module/k8s';

type FirehoseList = {
  data?: K8sResourceKind[];
  [key: string]: any;
};

interface State {
  items: {};
  title: React.ReactNode;
}

interface ResourceDropdownProps {
  id?: string;
  className?: string;
  dropDownClassName?: string;
  menuClassName?: string;
  buttonClassName?: string;
  title?: React.ReactNode;
  titlePrefix?: string;
  allApplicationsKey?: string;
  storageKey?: string;
  disabled?: boolean;
  allSelectorItem?: {
    allSelectorKey?: string;
    allSelectorTitle?: string;
  };
  actionItems?: {
    actionTitle: string;
    actionKey: string;
  }[];
  dataSelector: string[] | number[] | symbol[];
  transformLabel?: Function;
  loaded?: boolean;
  loadError?: string;
  placeholder?: string;
  resources?: FirehoseList[];
  selectedKey: string;
  autoSelect?: boolean;
  resourceFilter?: (resource: any) => boolean;
  onChange?: (key: string, name?: string, isListEmpty?: boolean) => void;
  onLoad?: (items: { [key: string]: string }) => void;
}

class ResourceDropdown extends React.Component<ResourceDropdownProps, State> {
  constructor(props) {
    super(props);
    this.state = {
      items: this.getDropdownList(props, false),
      title: this.props.loaded ? (
        <span className="btn-dropdown__item--placeholder">{this.props.placeholder}</span>
      ) : (
        <LoadingInline />
      ),
    };
  }

  componentWillReceiveProps(nextProps: ResourceDropdownProps) {
    const { loaded, loadError, autoSelect, selectedKey, placeholder, onLoad } = nextProps;

    if (!loaded) {
      this.setState({ title: <LoadingInline /> });
      return;
    }

    // If autoSelect is true only then have an item pre-selected based on selectedKey.
    if (!autoSelect && (!this.props.loaded || !selectedKey)) {
      this.setState({
        title: <span className="btn-dropdown__item--placeholder">{placeholder}</span>,
      });
    }

    if (loadError) {
      this.setState({
        title: <span className="cos-error-title">Error Loading - {placeholder}</span>,
      });
    }

    const resourceList = this.getDropdownList({ ...this.props, ...nextProps }, true);
    this.setState({ items: resourceList });
    if (nextProps.loaded && !this.props.loaded && onLoad) {
      onLoad(resourceList);
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    if (_.isEqual(this.state, nextState) && _.isEqual(this.props, nextProps)) {
      return false;
    }
    return true;
  }

  private getDropdownList = (
    {
      loaded,
      actionItems,
      autoSelect,
      selectedKey,
      resources,
      resourceFilter,
      dataSelector,
      transformLabel,
      allSelectorItem,
    }: ResourceDropdownProps,
    updateSelection: boolean,
  ) => {
    const unsortedList = {};
    _.each(resources, ({ data }) => {
      _.reduce(
        data,
        (acc, resource) => {
          let dataValue;
          if (resourceFilter && resourceFilter(resource)) {
            dataValue = _.get(resource, dataSelector);
          } else if (!resourceFilter) {
            dataValue = _.get(resource, dataSelector);
          }
          if (dataValue) {
            acc[dataValue] = transformLabel ? transformLabel(resource) : dataValue;
          }
          return acc;
        },
        unsortedList,
      );
    });

    const sortedList = {};

    if (allSelectorItem && !_.isEmpty(unsortedList)) {
      sortedList[allSelectorItem.allSelectorKey] = allSelectorItem.allSelectorTitle;
    }

    _.keys(unsortedList)
      .sort()
      .forEach((key) => {
        sortedList[key] = unsortedList[key];
      });

    if (updateSelection) {
      let selectedItem = selectedKey;
      if (
        (_.isEmpty(sortedList) || !sortedList[selectedKey]) &&
        allSelectorItem &&
        allSelectorItem.allSelectorKey !== selectedKey
      ) {
        selectedItem = allSelectorItem.allSelectorKey;
      } else if (autoSelect && !selectedKey) {
        selectedItem =
          loaded && _.isEmpty(sortedList) && actionItems
            ? actionItems[0].actionKey
            : _.get(_.keys(sortedList), 0);
      }
      selectedItem && this.handleChange(selectedItem, sortedList);
    }
    return sortedList;
  };

  private handleChange = (key, items) => {
    const name = items[key];
    const { actionItems, onChange, selectedKey } = this.props;
    const selectedActionItem = actionItems && actionItems.find((ai) => key === ai.actionKey);
    const title = selectedActionItem ? selectedActionItem.actionTitle : name;
    if (title !== this.state.title) {
      this.setState({ title });
    }
    if (key !== selectedKey) {
      onChange && onChange(key, name, _.isEmpty(items));
    }
  };

  private onChange = (key: string) => {
    this.handleChange(key, this.state.items);
  };

  render() {
    return (
      <Dropdown
        id={this.props.id}
        className={this.props.className}
        dropDownClassName={this.props.dropDownClassName}
        menuClassName={this.props.menuClassName}
        buttonClassName={this.props.buttonClassName}
        titlePrefix={this.props.titlePrefix}
        autocompleteFilter={fuzzy}
        actionItems={this.props.actionItems}
        items={this.state.items}
        onChange={this.onChange}
        selectedKey={this.props.selectedKey}
        title={this.props.title || this.state.title}
        autocompletePlaceholder={this.props.placeholder}
        storageKey={this.props.storageKey}
        disabled={this.props.disabled}
      />
    );
  }
}

export default ResourceDropdown;
