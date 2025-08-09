import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface IconForgeEntry {
  name: string;
  paths?: string[];
  viewBox?: number;
  snippet?: string;
  color?: string;
}

let iconforgeData: IconForgeEntry[];
const decorationTypeCache = new Map<string, vscode.TextEditorDecorationType>();

export function activate(context: vscode.ExtensionContext) {
  const dataPath = path.join(context.extensionPath, 'data', 'iconforge.data.json');

  if (!fs.existsSync(dataPath)) {
      vscode.window.showErrorMessage('IconForge data file not found. Please generate it with your tool.');
      return;
  }

  try {
    const raw = fs.readFileSync(dataPath, 'utf8');
    const parsedData = JSON.parse(raw);

    if (Array.isArray(parsedData)) {
        iconforgeData = parsedData;
    } else if (parsedData && Array.isArray(parsedData.classes)) {
        iconforgeData = parsedData.classes;
    } else {
        throw new Error("Could not find a valid array of icon/style data in iconforge.data.json.");
    }

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

            return iconforgeData
                .sort((a, b) => collator.compare(a.name, b.name))
                .map(entry => {
                    const item = new vscode.CompletionItem(entry.name, entry.paths ? vscode.CompletionItemKind.Variable : vscode.CompletionItemKind.Color);
                    if (entry.snippet) {
                        item.detail = "Style Snippet";
                    }
                    if (entry.paths) {
                        item.detail = "SVG Icon";
                    }
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
        const entry = iconforgeData.find(i => i.name === word);

        if (entry) {
          const docs = new vscode.MarkdownString();
          docs.supportHtml = true;
          docs.isTrusted = true;

          if (entry.paths && entry.viewBox) {
            const pathElements = entry.paths.map(p => `<path d="${p}"></path>`).join('');
            const viewBox = entry.viewBox || 1024;
            const svgString = `<svg width="64" height="64" viewBox="0 0 ${viewBox} ${viewBox}" xmlns="http://www.w3.org/2000/svg" fill="currentColor">${pathElements}</svg>`;
            const svgDataUri = 'data:image/svg+xml;base64,' + Buffer.from(svgString).toString('base64');
            
            docs.appendMarkdown(`![${entry.name}](${svgDataUri})\n\n`);
            docs.appendMarkdown(`**${entry.name}**`);
          }

          else if (entry.snippet) {
            docs.appendMarkdown(`**${entry.name}**\n\n`);
            docs.appendCodeblock(entry.snippet, 'css');
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
        const iconClass = iconforgeData.find(c => c.name === className);

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