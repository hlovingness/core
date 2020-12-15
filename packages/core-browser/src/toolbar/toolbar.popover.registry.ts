import * as React from 'react';
import { Injectable } from '@ali/common-di';
import { Disposable } from '@ali/ide-components/lib/utils';
import { Emitter, Event } from '@ali/ide-core-common';

import { IToolbarPopoverRegistry } from './types';

@Injectable()
export class ToolbarPopoverRegistry implements IToolbarPopoverRegistry {
  private registerPopoverEvent = new Emitter<string>();
  public onDidRegisterPopoverEvent: Event<string> = this.registerPopoverEvent.event;

  private popOverComponents: Map<string, React.FC> = new Map();

  registerComponent(id: string, component: React.FC) {
    if (this.popOverComponents.has(id)) {
      console.error(`Component ${id} is already registered!`);
      return Disposable.NULL;
    }
    this.popOverComponents.set(id, component);
    this.registerPopoverEvent.fire(id);

    return {
      dispose: () => {
        this.popOverComponents.delete(id);
      },
    };
  }

  getComponent = (id: string): React.FC | undefined => {
    return this.popOverComponents.get(id);
  }
}