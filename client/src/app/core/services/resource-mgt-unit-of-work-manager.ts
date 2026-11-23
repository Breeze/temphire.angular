import { Injectable } from '@angular/core';

import { ResourceMgtUnitOfWork } from './resource-mgt-unit-of-work';
import { UnitOfWorkManager } from './unit-of-work-manager';

/**
 * Port of `DomainServices/ResourceMgtUnitOfWorkManager.cs`: the Resource Management workspace's
 * units of work, the shared one and the sandboxes.  A new workspace gets a manager like this one,
 * for its own unit of work.
 */
@Injectable({ providedIn: 'root' })
export class ResourceMgtUnitOfWorkManager extends UnitOfWorkManager<ResourceMgtUnitOfWork> {
  protected override newUnitOfWork(onCommitted: () => void): ResourceMgtUnitOfWork {
    return new ResourceMgtUnitOfWork(this.emProvider, onCommitted);
  }
}
