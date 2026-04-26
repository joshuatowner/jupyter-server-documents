import type {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { NotebookPanel, INotebookTracker } from '@jupyterlab/notebook';
import { CodeCell } from '@jupyterlab/cells';

// Import notebook-factory.ts to trigger the monkey-patches on
// CodeCell.prototype, CodeCellModel.prototype, etc. at module load time.
// These patches do NOT require providing IContentFactory.
import './notebook-factory';

/**
 * Plugin that applies RTC notebook enhancements WITHOUT providing
 * NotebookPanel.IContentFactory, avoiding conflicts with other extensions
 * (e.g. SQL Editor) that also provide this token.
 *
 * The monkey-patches in notebook-factory.ts run at import time and apply
 * globally. This plugin handles the two remaining responsibilities:
 * 1. Calling initializeState() on CodeCells for awareness listeners
 * 2. Setting up YDoc reset handling (ResettableNotebook behavior)
 */
export const notebookFactoryPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyter-ai-contrib/server-documents:notebook-factory',
  description: 'Applies RTC notebook enhancements via notebook tracker.',
  requires: [INotebookTracker],
  autoStart: true,
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    tracker.widgetAdded.connect((sender, panel: NotebookPanel) => {
      panel.context.ready.then(() => {
        // Initialize existing cells
        for (const cell of panel.content.widgets) {
          if (cell instanceof CodeCell) {
            (cell as any).initializeState();
          }
        }

        // Initialize new cells as they're added
        panel.content.model?.cells.changed.connect((cellList, change) => {
          if (change.type === 'add') {
            for (const cellModel of change.newValues) {
              requestAnimationFrame(() => {
                for (const cell of panel.content.widgets) {
                  if (cell instanceof CodeCell && cell.model === cellModel) {
                    (cell as any).initializeState();
                    break;
                  }
                }
              });
            }
          }
        });

        // Set up YDoc reset handling (ResettableNotebook behavior)
        const notebook = panel.content;
        const model = notebook.model;
        if (model) {
          const ynotebook = model.sharedModel as any;
          if (ynotebook.resetSignal) {
            ynotebook.resetSignal.connect(() => {
              (notebook as any).onModelContentChanged(model);
            });
          }
        }
      });
    });
  }
};
