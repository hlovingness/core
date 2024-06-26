import { DebugExpressionProvider } from '@opensumi/ide-debug/lib/browser/editor';
import {
  EvaluatableExpressionServiceImpl,
  IEvaluatableExpressionService,
} from '@opensumi/ide-debug/lib/browser/editor/evaluatable-expression';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';

import type { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';

describe('Debug Expression Provider', () => {
  const mockInjector = createBrowserInjector([]);
  let debugExpressionProvider: DebugExpressionProvider;
  const textModel = monacoApi.editor.createModel('test.a = "test"', 'test');

  const mockedGetLineContent = jest.spyOn(textModel, 'getLineContent');
  mockInjector.addProviders({
    token: IEvaluatableExpressionService,
    useClass: EvaluatableExpressionServiceImpl,
  });

  const selection = {
    startLineNumber: 1,
    endLineNumber: 2,
    startColumn: 1,
    endColumn: 7,
  } as any;

  beforeAll(() => {
    debugExpressionProvider = mockInjector.get(DebugExpressionProvider);
  });

  it('should have enough API', () => {
    expect(typeof debugExpressionProvider.get).toBe('function');
  });

  it('get method should be work', async () => {
    const expression = await debugExpressionProvider.get(textModel as unknown as ITextModel, selection);
    expect(mockedGetLineContent).toHaveBeenCalledWith(selection.startLineNumber);
    expect(expression).toBe('test.a');
  });
});
