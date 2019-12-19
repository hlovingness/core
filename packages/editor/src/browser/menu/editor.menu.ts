import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { IEditorActionRegistry, IEditorActionItem, IVisibleAction } from '../types';
import { IDisposable, URI, BasicEvent, IEventBus, Disposable, IContextKeyService, Emitter, IContextKeyExpr } from '@ali/ide-core-browser';
import { IResource, IEditorGroup } from '../../common';
import { observable, reaction, computed } from 'mobx';
import { AbstractContextMenuService, ICtxMenuRenderer, MenuId, generateCtxMenu } from '@ali/ide-core-browser/lib/menu/next';
import { EditorGroup } from '../workbench-editor.service';

@Injectable()
export class EditorActionRegistryImpl implements IEditorActionRegistry {

  public readonly items: IEditorActionItemData[] = [];

  private _onAddAction = new Emitter<IEditorActionItemData>();

  public onAddAction = this._onAddAction.event;

  private _onRemoveAction = new Emitter<IEditorActionItemData>();

  public onRemoveAction = this._onRemoveAction.event;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  private visibleActions: Map<IEditorGroup, VisibleEditorActions> = new Map();

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(AbstractContextMenuService)
  ctxMenuService: AbstractContextMenuService;

  @Autowired(ICtxMenuRenderer)
  ctxMenuRenderer: ICtxMenuRenderer;

  registerEditorAction(actionItem: IEditorActionItem): IDisposable {
    const processed = {
      ...actionItem,
      contextKeyExpr: actionItem.when ? this.contextKeyService.parse(actionItem.when) : undefined,
      tipContextKeyExpr: actionItem.tipWhen ? this.contextKeyService.parse(actionItem.tipWhen) : undefined,
      tipClosed: false,
    };
    this.items.push(processed);
    const disposer = new Disposable();
    disposer.addDispose({
      dispose: () => {
        const index = this.items.indexOf(processed);
        if (index !== -1) {
          this.items.splice(index, 1);
          this._onRemoveAction.fire(processed);
        }
      },
    });
    this._onAddAction.fire(processed);
    return disposer;
  }

  getActions(editorGroup: IEditorGroup) {
    if (!this.visibleActions.has(editorGroup)) {
      const visibleActions = this.injector.get(VisibleEditorActions, [editorGroup, this]);
      this.visibleActions.set(editorGroup, visibleActions);
      ((editorGroup as any) as Disposable).addDispose({
        dispose: () => {
          this.visibleActions.delete(editorGroup);
          visibleActions.dispose();
        },
      });
    }
    return this.visibleActions.get(editorGroup)!.items;
  }

  showMore(x: number, y: number, group: IEditorGroup) {

    const contextKeyService = group.currentEditor ? this.contextKeyService.createScoped((group.currentEditor.monacoEditor as any)._contextKeyService) : (group as EditorGroup).contextKeyService;
    const menus = this.ctxMenuService.createMenu({
      id: MenuId.EditorTitle,
      contextKeyService,
    });
    const menuNodes = menus.getMergedMenuNodes();
    menus.dispose();

    let currentUri: URI | undefined;
    if (group.currentResource) {
      currentUri = group.currentResource.uri;
    }

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      menuNodes,
      args: [ currentUri ],
    });
  }

}

interface IEditorActionItemData extends IEditorActionItem {
  tipClosed: boolean;
  contextKeyExpr?: IContextKeyExpr;
  tipContextKeyExpr?: IContextKeyExpr;
}

@Injectable({multiple: true})
export class VisibleEditorActions extends Disposable {

  private contextKeyService: IContextKeyService;

  @observable.shallow private visibleEditorActions: VisibleAction[] = [];

  private contextKeys: string[] = [];

  constructor(private group: IEditorGroup, registry: EditorActionRegistryImpl) {
    super();
    this.contextKeyService = (group as EditorGroup).contextKeyService;
    const disposer = reaction(() => group.currentResource, () => {
      this.update();
    });
    this.addDispose({
      dispose: () => {
        disposer();
      },
    });
    registry.items.forEach((item) => {
      this.addItem(item);
    });
    this.addDispose(registry.onAddAction((item) => {
      this.addItem(item);
    }));
    this.addDispose(registry.onRemoveAction((item) => {
      this.removeItem(item);
    }));
  }

  addItem(item: IEditorActionItemData) {
    this.visibleEditorActions.push(new VisibleAction(item, this.group, this.contextKeyService));
  }

  removeItem(item: IEditorActionItemData) {
    const index = this.visibleEditorActions.findIndex((v) => v.item === item);
    if (index !== -1) {
      this.visibleEditorActions[index].dispose();
      this.visibleEditorActions.splice(index, 1);
    }
  }

  update() {
    this.visibleEditorActions.forEach((action) => {
      action.update();
    });
  }

  @computed
  get items(): IVisibleAction[] {
    return this.visibleEditorActions.filter((v) => v.visible);
  }

  dispose() {
    super.dispose();
    (this.group as any) = null;
    this.visibleEditorActions.forEach((v) => v.dispose());
    this.visibleEditorActions = [];
  }

}

class VisibleAction extends Disposable implements IVisibleAction  {

  @observable visible = false;

  @observable tipVisible = false;

  constructor(public readonly item: IEditorActionItemData, private editorGroup: IEditorGroup, private contextKeyService: IContextKeyService) {
    super();
    const set = new Set();
    if (this.item.contextKeyExpr) {
      this.item.contextKeyExpr.keys().forEach((key) => {
        set.add(key);
      });
    }

    if (this.item.tipContextKeyExpr) {
      this.item.tipContextKeyExpr.keys().forEach((key) => {
        set.add(key);
      });
    }

    if (set.size > 0) {
      this.addDispose(contextKeyService.onDidChangeContext((e) => {
        if (e.payload.affectsSome(set)) {
          this.update();
        }
      }));
    }

    this.addDispose({
      dispose: () => {
        (this as any).editorGroup = null;
        (this as any).contextKeyService = null;
      },
    });

    this.update();
  }

  update() {
    const item = this.item;
    if (item.isVisible) {
      try {
        this.visible = item.isVisible(this.editorGroup.currentResource, this.editorGroup);
      } catch (e) {
        this.visible = false;
      }
    } else if (item.contextKeyExpr) {
      const context = this.editorGroup.currentEditor ? this.editorGroup.currentEditor.monacoEditor.getDomNode() : undefined;
      this.visible = this.contextKeyService.match(item.contextKeyExpr, context);
    } else {
      this.visible = true;
    }

    if (!this.item.tipClosed) {
      if (this.item.tipContextKeyExpr) {
        const context = this.editorGroup.currentEditor ? this.editorGroup.currentEditor.monacoEditor.getDomNode() : undefined;
        this.tipVisible = this.contextKeyService.match(item.tipContextKeyExpr, context);
      }
    }
  }

  closeTip() {
    this.item.tipClosed = true;
    this.tipVisible = false;
  }
}
