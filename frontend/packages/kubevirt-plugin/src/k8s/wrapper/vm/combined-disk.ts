import * as _ from 'lodash';
import { K8sResourceKind } from '@console/internal/module/k8s';
import { createBasicLookup, getName, getNamespace } from '@console/shared/src';
import { FirehoseResult } from '@console/internal/components/utils';
import { V1Disk } from '../../../types/vm/disk/V1Disk';
import { V1Volume } from '../../../types/vm/disk/V1Volume';
import { V1alpha1DataVolume } from '../../../types/vm/disk/V1alpha1DataVolume';
import { getSimpleName } from '../../../selectors/utils';
import { DiskType, VolumeType } from '../../../constants/vm/storage';
import { VMLikeEntityKind } from '../../../types';
import { asVM, getDataVolumeTemplates, getDisks, getVolumes } from '../../../selectors/vm';
import { getLoadedData, isLoaded } from '../../../utils';
import { getPvcStorageClassName, getPvcStorageSize } from '../../../selectors/pvc/selectors';
import { StorageUISource } from '../../../components/modals/disk-modal/storage-ui-source';
import { DiskWrapper } from './disk-wrapper';
import { DataVolumeWrapper } from './data-volume-wrapper';
import { VolumeWrapper } from './volume-wrapper';

export class CombinedDisk {
  private readonly dataVolumesLoading: boolean;

  private readonly pvcsLoading: boolean;

  private readonly source: StorageUISource;

  readonly diskWrapper: DiskWrapper;

  readonly volumeWrapper: VolumeWrapper;

  readonly dataVolumeWrapper?: DataVolumeWrapper;

  readonly pvc?: K8sResourceKind;

  constructor({
    diskWrapper,
    volumeWrapper,
    dataVolumeWrapper,
    pvc,
    dataVolumesLoading,
    pvcsLoading,
  }: {
    diskWrapper: DiskWrapper;
    volumeWrapper: VolumeWrapper;
    dataVolumeWrapper?: DataVolumeWrapper;
    pvc?: K8sResourceKind;
    dataVolumesLoading?: boolean;
    pvcsLoading?: boolean;
  }) {
    this.diskWrapper = diskWrapper;
    this.volumeWrapper = volumeWrapper;
    this.dataVolumeWrapper = dataVolumeWrapper;
    this.pvc = pvc;
    this.dataVolumesLoading = dataVolumesLoading;
    this.pvcsLoading = pvcsLoading;
    this.source = StorageUISource.fromTypes(
      volumeWrapper.getType(),
      dataVolumeWrapper && dataVolumeWrapper.getType(),
    );
  }

  getSource = () => this.source;

  isEditingSupported = () => !!this.source && this.source.isEditingSupported();

  getName = () => this.diskWrapper.getName();

  getDiskInterface = () =>
    this.diskWrapper.getType() === DiskType.DISK
      ? this.diskWrapper.getReadableDiskBus()
      : undefined;

  getSize = () =>
    this.volumeTypeOperation(getPvcStorageSize, (dataVolumeWrapper) =>
      dataVolumeWrapper.getReadabableSize(),
    );

  getStorageClassName = () =>
    this.volumeTypeOperation(getPvcStorageClassName, (dataVolumeWrapper) =>
      dataVolumeWrapper.getStorageClassName(),
    );

  getPVCName = (source?: StorageUISource) => {
    const resolvedSource =
      source ||
      StorageUISource.fromTypes(
        this.volumeWrapper.getType(),
        this.dataVolumeWrapper && this.dataVolumeWrapper.getType(),
      );
    if (resolvedSource === StorageUISource.ATTACH_DISK) {
      return this.volumeWrapper.getPersistentVolumeClaimName();
    }
    if (resolvedSource === StorageUISource.ATTACH_CLONED_DISK) {
      return this.dataVolumeWrapper.getPesistentVolumeClaimName();
    }

    return null;
  };

  toString = () => {
    return _.compact([
      this.getName(),
      this.getSize(),
      this.getDiskInterface(),
      this.getStorageClassName(),
    ]).join(' - ');
  };

  private volumeTypeOperation = (
    onPVC: (pvc: K8sResourceKind) => string,
    onDataVolumeWrapper: (dataVolumeWrapper: DataVolumeWrapper) => string,
  ) => {
    const volumeType = this.volumeWrapper.getType();
    if (volumeType === VolumeType.PERSISTENT_VOLUME_CLAIM) {
      if (this.pvc) {
        return onPVC(this.pvc);
      }
      if (this.pvcsLoading) {
        return undefined;
      }
    } else if (volumeType === VolumeType.DATA_VOLUME) {
      if (this.dataVolumeWrapper) {
        return onDataVolumeWrapper(this.dataVolumeWrapper);
      }
      if (this.dataVolumesLoading) {
        return undefined;
      }
    }
    return null;
  };
}

export class CombinedDiskFactory {
  private readonly disks: V1Disk[];

  private readonly volumes: V1Volume[];

  private readonly dataVolumes: V1alpha1DataVolume[];

  private readonly pvcs: K8sResourceKind[];

  private readonly dataVolumesLoading: boolean;

  private readonly pvcsLoading: boolean;

  static initializeFromVMLikeEntity = (
    vmLikeEntity: VMLikeEntityKind,
    datavolumes?: FirehoseResult<V1alpha1DataVolume[]>,
    pvcs?: FirehoseResult<K8sResourceKind[]>,
  ) => {
    const vm = asVM(vmLikeEntity);

    return new CombinedDiskFactory({
      disks: getDisks(vm),
      volumes: getVolumes(vm),
      dataVolumes: [...getLoadedData(datavolumes, []), ...getDataVolumeTemplates(vm)],
      pvcs: getLoadedData(pvcs),
      dataVolumesLoading: !isLoaded(datavolumes),
      pvcsLoading: !isLoaded(pvcs),
      namespace: getNamespace(vmLikeEntity),
    });
  };

  constructor({
    disks,
    volumes,
    dataVolumes,
    dataVolumesLoading,
    pvcs,
    pvcsLoading,
    namespace,
  }: {
    disks: V1Disk[];
    volumes: V1Volume[];
    dataVolumes?: V1alpha1DataVolume[];
    dataVolumesLoading?: boolean;
    pvcs?: K8sResourceKind[];
    pvcsLoading?: boolean;
    namespace: string;
  }) {
    this.disks = disks;
    this.volumes = volumes;
    this.dataVolumes =
      dataVolumes &&
      dataVolumes.filter((dataVolume) => {
        const ns = getNamespace(dataVolume);
        return !ns || ns === namespace;
      });
    this.pvcs =
      pvcs &&
      pvcs.filter((pvc) => {
        const ns = getNamespace(pvc);
        return !ns || ns === namespace;
      });
    this.dataVolumesLoading = dataVolumesLoading;
    this.pvcsLoading = pvcsLoading;
  }

  getCombinedDisks = (): CombinedDisk[] => {
    const volumeLookup = createBasicLookup(this.volumes, getSimpleName);
    const datavolumeLookup = createBasicLookup(this.dataVolumes, getName);
    const pvcLookup = createBasicLookup(this.pvcs, getName);

    return this.disks.map((disk) => {
      const diskWrapper = DiskWrapper.initialize(disk);
      const volume = volumeLookup[diskWrapper.getName()];
      const volumeWrapper = VolumeWrapper.initialize(volume);
      const dataVolume =
        volumeWrapper.getType() === VolumeType.DATA_VOLUME
          ? datavolumeLookup[volumeWrapper.getDataVolumeName()]
          : undefined;
      const pvc =
        volumeWrapper.getType() === VolumeType.PERSISTENT_VOLUME_CLAIM
          ? pvcLookup[volumeWrapper.getPersistentVolumeClaimName()]
          : undefined;

      return new CombinedDisk({
        diskWrapper,
        volumeWrapper,
        dataVolumeWrapper: dataVolume && DataVolumeWrapper.initialize(dataVolume),
        pvc,
        dataVolumesLoading: this.dataVolumesLoading,
        pvcsLoading: this.pvcsLoading,
      });
    });
  };

  getUsedDiskNames = (excludeName: string): Set<string> =>
    new Set(this.disks.map(getSimpleName).filter((n) => n && n !== excludeName));

  getUsedDataVolumeNames = (excludeName: string): Set<string> =>
    new Set(this.dataVolumes.map((dv) => getName(dv)).filter((n) => n && n !== excludeName));
}
