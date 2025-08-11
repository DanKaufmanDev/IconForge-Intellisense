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
let sortedIconforgeData: IconForgeEntry[];
const decorationTypeCache = new Map<string, vscode.TextEditorDecorationType>();

enum SuggestionType {
    Icon,
    Color,
    Background,
    Size,
    Modifier,
    Unknown
}

function getType(className: string): SuggestionType {
    if (className.startsWith('if-')) {return SuggestionType.Icon;};
    if (className.startsWith('is-bg-')) {return SuggestionType.Background;};
    if (className.startsWith('is-size-')) {return SuggestionType.Size;};
    if (className.startsWith('is-rot-') || className.startsWith('is-flip-')) {return SuggestionType.Modifier;};
    if (className.startsWith('is-')) {return SuggestionType.Color;};
    return SuggestionType.Unknown;
}

export function activate(context: vscode.ExtensionContext) {
  const dataPath = path.join(context.extensionPath, 'data', 'iconforge.data.json');

  if (!fs.existsSync(dataPath)) {
      vscode.window.showErrorMessage('IconForge data file not found.');
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

    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    sortedIconforgeData = iconforgeData.sort((a, b) => collator.compare(a.name, b.name));

  } catch (error) {
    vscode.window.showErrorMessage(`Error loading or parsing IconForge data file: ${error}`);
    return;
  }

  const completionProvider = vscode.languages.registerCompletionItemProvider(
    ['html', 'vue', 'javascript', 'typescript', 'jsx', 'tsx'],
    {
        provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
            const linePrefix = document.lineAt(position).text.substr(0, position.character);
            const classAttributeRegex = /class(Name)?\s*=\s*["']([^"']*)$/;

            if (!classAttributeRegex.test(linePrefix)) {
                return undefined;
            }

            const classMatch = linePrefix.match(classAttributeRegex);
            if (!classMatch) {
                return undefined;
            }

            const existingClassesText = classMatch[2];
            const classes = existingClassesText.split(/\s+/);
            const currentWord = classes.pop() || '';

            const existingClasses = classes.filter(c => c.length > 0);
            const types = existingClasses.map(getType);

            const hasIcon = types.includes(SuggestionType.Icon);
            const hasColor = types.includes(SuggestionType.Color);
            const hasBg = types.includes(SuggestionType.Background);
            const hasSize = types.includes(SuggestionType.Size);

            let suggestions = sortedIconforgeData;

            if (currentWord.startsWith('if-')) {
                suggestions = suggestions.filter(e => getType(e.name) === SuggestionType.Icon);
            } else if (currentWord.startsWith('is-bg-')) {
                suggestions = suggestions.filter(e => getType(e.name) === SuggestionType.Background);
            } else if (currentWord.startsWith('is-size-')) {
                suggestions = suggestions.filter(e => getType(e.name) === SuggestionType.Size);
            } else if (currentWord.startsWith('is-rot-') || currentWord.startsWith('is-flip-')) {
                suggestions = suggestions.filter(e => getType(e.name) === SuggestionType.Modifier);
            } else if (currentWord.startsWith('is-')) {
                suggestions = suggestions.filter(e => {
                    const type = getType(e.name);
                    return type === SuggestionType.Color || type === SuggestionType.Background;
                });
            }

            return suggestions.map(entry => {
                const item = new vscode.CompletionItem(entry.name, entry.paths ? vscode.CompletionItemKind.Variable : vscode.CompletionItemKind.Color);
                const type = getType(entry.name);

                let sortPrefix = 'd'; // Default low priority

                if (type === SuggestionType.Icon && !hasIcon) {sortPrefix = 'a';}
                else if ((type === SuggestionType.Color || type === SuggestionType.Background) && !hasColor && !hasBg) {sortPrefix = 'b';}
                else if (type === SuggestionType.Size && !hasSize) {sortPrefix = 'c';}

                item.sortText = sortPrefix + entry.name;

                if (entry.snippet) {
                    item.detail = "CSS Utility";
                } if (entry.paths) {
                  const newName = entry.name.split('-').splice(1).join(' ');
                  const capName = newName.charAt(0).toUpperCase() + newName.slice(1);
                    item.detail = `${capName} Icon`;
                    item.documentation = new vscode.MarkdownString(`**Icon:**\n\n${capName}`);
                 } if (entry.color) {
                    item.detail = 'Color Utility';
                    item.documentation = new vscode.MarkdownString(`**Color:**\n\n${entry.color}`);
                    item.insertText = new vscode.SnippetString(entry.name.startsWith('is-') ? entry.name : `is-${entry.name}`);
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
        if (!range) {return;}

        const word = document.getText(range);
        const entry = iconforgeData.find(i => i.name === word);
        if (!entry) {return;}

        const docs = new vscode.MarkdownString();
        docs.supportHtml = true;
        docs.isTrusted = true;

        if (entry.paths && entry.viewBox) {
            let fillColor = "currentColor";
            let backgroundColor = "transparent";

            const lineText = document.lineAt(position.line).text;
            const styleClasses = lineText.match(/(is|if)-[a-zA-Z0-9-]+/g) || [];

            for (const className of styleClasses) {
                const styleEntry = iconforgeData.find(c => c.name === className);
                if (styleEntry && styleEntry.color) {
                    if (className.startsWith('is-bg')) {
                        backgroundColor = styleEntry.color;
                    } else {
                        fillColor = styleEntry.color;
                    }
                }
            }
            const iconPathElements = entry.paths.map(p => `<path d="${p}"></path>`).join('');
            const iconViewBox = entry.viewBox || 1024;

            const outerSvgSize = 80;
            const iconDisplaySize = 80;
            const padding = (outerSvgSize - iconDisplaySize) / 2;

            const combinedSvgString = 
            `<svg width="${outerSvgSize}" height="${outerSvgSize}" viewBox="0 0 ${outerSvgSize} ${outerSvgSize}" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="${outerSvgSize}" height="${outerSvgSize}" fill="${backgroundColor}" />
              <svg x="${padding}" y="${padding}" width="${iconDisplaySize}" height="${iconDisplaySize}" viewBox="0 0 ${iconViewBox} ${iconViewBox}" fill="${fillColor}">${iconPathElements}</svg>
            </svg>`;
            const svgDataUri = 'data:image/svg+xml;base64,' + Buffer.from(combinedSvgString).toString('base64');
            docs.appendMarkdown(`Preview:\n\n`);
            docs.appendMarkdown(`![${entry.name}](${svgDataUri})`);  
        } 
        else if (entry.snippet) {
            docs.appendMarkdown(`**${entry.name}**`);
            docs.appendCodeblock(entry.snippet, 'css');
        }
      
        return new vscode.Hover(docs, range);
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
    const classRegex = /\b(is|if)-[a-zA-Z0-9-]+\b/g;
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
