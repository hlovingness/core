import * as React from 'react';
import * as Components from '@ali/ide-core-browser/lib/components';

import { URI, localize, getIcon } from '@ali/ide-core-browser';

import { Scroll } from '@ali/ide-editor/lib/browser/component/scroll/scroll';
import { ResizeHandleHorizontal, ResizeHandleVertical } from '@ali/ide-core-browser/lib/components';

import { PlainWebview } from '@ali/ide-webview';

import { ToolBarPosition } from '@ali/ide-toolbar';
import { EditorComponentRenderMode } from '@ali/ide-editor/lib/browser';

import { Injector } from '@ali/common-di';
import { IThemeService, getColorRegistry } from '@ali/ide-theme';
import { ExtensionService } from '../../common';

/**
 * Browser 尽量只export视图相关的少量API
 * 设计API时遵循以下原则:
 * 1. browser只暴露getter，任何注册、调用等会产生副作用的行为全部放入逻辑层
 * @param injector
 */
export function createBrowserApi(injector: Injector, extensionId?: string) {

  const extensionService: ExtensionService = injector.get(ExtensionService);
  let components = Components;

  if (extensionId) {
    components = new Proxy(Components, {
      get(target, prop) {
        if (prop === 'Dialog' || 'Overlay') {
          let existing = extensionService.getShadowRootBody(extensionId);
          if (!existing) {
            existing = document.createElement('body');
            existing.style.height = '0%';
            extensionService.registerShadowRootBody(extensionId, existing);
          }
          return (props) => (React.createElement(Components[prop], { ...props, getContainer: () => {
            return existing;
          }}));
        }
        return target[prop];
      },
    });
  }
  return {
    // Components
    ...components,
    Scroll,
    ResizeHandleHorizontal,
    ResizeHandleVertical,
    PlainWebview,

    // common classes
    URI,
    localize,
    getIcon,

    // theme
    getThemeColors: () => {
      const themeService: IThemeService = injector.get(IThemeService);
      const currentTheme = themeService.getCurrentThemeSync();

      const exportedColors = getColorRegistry().getColors().reduce((colors, entry) => {
        const color = currentTheme.getColor(entry.id);
        if (color) {
          colors[entry.id.replace('.', '-')] = color.toString();
        }
        return colors;
      }, {} as { [key: string]: string });
      return exportedColors;
    },

    ToolBarPosition,
    EditorComponentRenderMode,
  };
}
