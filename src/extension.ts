import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { match } from 'assert';

interface IconForgeClass {
  name: string;
  description: string;
  documentation: string;
  snippet?: string;
  color?: string;
  svg?: string;
}

let iconforgeData: { version: number; classes: IconForgeClass[] };
const decorationTypeCache = new Map<string, vscode.TextEditorDecorationType>();

export function activate(context: vscode.ExtensionContext) {
  const dataPath = path.join(context.extensionPath, 'data', 'iconforge.data.json');

  if (!fs.existsSync(dataPath)) {
      vscode.window.showErrorMessage('IconForge data file not found. Please reinstall the extension.');
      return;
  }

  try {
    const raw = fs.readFileSync(dataPath, 'utf8');
    iconforgeData = JSON.parse(raw);
  } catch (error) {
    vscode.window.showErrorMessage(`Error loading or parsing IconForge data file: ${error}`);
    return;
  }

  const completionProvider = vscode.languages.registerCompletionItemProvider(
    ['html', 'vue', 'javascript', 'typescript', 'jsx', 'tsx'],
    {
        provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
            const linePrefix = document.lineAt(position).text.substr(0, position.character);
            const classAttributeRegex = /class(Name)?\s*=\s*["\'`][^"\'`]*$/;

            if (!classAttributeRegex.test(linePrefix)) {
                return undefined;
            }
            
            const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

            return iconforgeData.classes
                .filter(cls => cls.name.startsWith('is-') || cls.name.startsWith('if-'))
                .sort((a, b) => collator.compare(a.name, b.name))
                .map(cls => {
                    const item = new vscode.CompletionItem(cls.name, vscode.CompletionItemKind.Color);
                    item.detail = cls.color;
  
                  return item;
            });
        }
    },
  );

  const hoverProvider = vscode.languages.registerHoverProvider(
    ['html', 'vue', 'javascript', 'typescript', 'jsx', 'tsx'],
    {
      provideHover(document, position) {
        const range = document.getWordRangeAtPosition(position, /(is|if)-[a-zA-Z0-9-]+/);
        if (!range) {
            return;
        }

        const word = document.getText(range);
        const match = iconforgeData.classes.find((cls) => cls.name === word);
        if (match) {
          const docs = new vscode.MarkdownString();
          docs.supportHtml = true;
          docs.appendMarkdown(`**${match.name}**\n\n`);

          if (match.snippet) {
            docs.appendCodeblock(match.snippet, 'css');
          } else if (match.svg){
            docs.appendMarkdown(match.documentation);
          }
        
          return new vscode.Hover(docs, range);
        }
      }
    }
  );

  let activeEditor = vscode.window.activeTextEditor;
  let timeout: NodeJS.Timeout | undefined = undefined;

  if (activeEditor) {
    triggerUpdateDecorations();
  }

  vscode.window.onDidChangeActiveTextEditor(editor => {
    activeEditor = editor;
    if (editor) {
      triggerUpdateDecorations();
    }
  }, null, context.subscriptions);

  vscode.workspace.onDidChangeTextDocument(event => {
    if (activeEditor && event.document === activeEditor.document) {
      triggerUpdateDecorations(true);
    }
  }, null, context.subscriptions);

  function triggerUpdateDecorations(throttle = false) {
    if (timeout) {
      clearTimeout(timeout);
    }
    const update = () => {
      if (activeEditor) {
        updateDecorations(activeEditor);
      }
    };
    if (throttle) {
      timeout = setTimeout(update, 500);
    } else {
      update();
    }
  }

  context.subscriptions.push(completionProvider, hoverProvider);
}

function updateDecorations(editor: vscode.TextEditor) {
    const text = editor.document.getText();
    const decorationsByColor = new Map<string, vscode.DecorationOptions[]>();
    const classRegex = /(is|if)-[a-zA-Z0-9-]+/g;
    let match;

    while ((match = classRegex.exec(text))) {
        const className = match[0];
        const iconClass = iconforgeData.classes.find(c => c.name === className);

        if (iconClass && iconClass.color) {
            const startPos = editor.document.positionAt(match.index);
            const endPos = editor.document.positionAt(match.index + match[0].length);
            const range = new vscode.Range(startPos, endPos);

            const decoration = { range };
            if (!decorationsByColor.has(iconClass.color)) {
                decorationsByColor.set(iconClass.color, []);
            }
            decorationsByColor.get(iconClass.color)!.push(decoration);
        }
    }

    decorationTypeCache.forEach(d => d.dispose());
    decorationTypeCache.clear();

    for (const [color, decorations] of decorationsByColor.entries()) {
        const decorationType = vscode.window.createTextEditorDecorationType({
            before: {
                contentText: '■',
                color: color,
                margin: '0 0.2em 0 0',
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        });
        editor.setDecorations(decorationType, decorations);
        decorationTypeCache.set(color, decorationType);
    }
}

export function deactivate() {
  for (const decorationType of decorationTypeCache.values()) {
    decorationType.dispose();
  }
  decorationTypeCache.clear();
}