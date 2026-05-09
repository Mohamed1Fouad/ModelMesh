import * as vscode from "vscode";
import type { ModelMeshClient } from "@modelmesh/sdk";

export class ModelMeshCompletionProvider implements vscode.InlineCompletionItemProvider {
  private client: ModelMeshClient;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(client: ModelMeshClient) {
    this.client = client;
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList> {
    const config = vscode.workspace.getConfiguration("modelmesh");
    if (!config.get<boolean>("codeCompletion.enabled", false)) {
      return [];
    }

    // Debounce to avoid excessive requests
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    return new Promise((resolve) => {
      this.debounceTimer = setTimeout(async () => {
        if (token.isCancellationRequested) {
          resolve([]);
          return;
        }

        try {
          const prefix = this.getPrefix(document, position);
          const suffix = this.getSuffix(document, position);

          // Skip if there's no meaningful context
          if (prefix.trim().length < 10) {
            resolve([]);
            return;
          }

          const defaultModel = config.get<string>("defaultModel", "");
          const response = await this.client.chatCompletion({
            model: defaultModel || undefined,
            messages: [
              {
                role: "system",
                content:
                  "You are a code completion engine. Complete the code at the cursor position. Only output the completion text, no explanations, no markdown.",
              },
              {
                role: "user",
                content: `Complete the code after the <CURSOR> marker.\n\n\`\`\`\n${prefix}<CURSOR>${suffix}\n\`\`\``,},
            ],
            temperature: 0.2,
            max_tokens: 256,
          });

          if (token.isCancellationRequested) {
            resolve([]);
            return;
          }

          const completionText = response.choices[0]?.message?.content ?? "";
          if (!completionText.trim()) {
            resolve([]);
            return;
          }

          const item = new vscode.InlineCompletionItem(
            completionText,
            new vscode.Range(position, position)
          );
          item.filterText = completionText;

          resolve([item]);
        } catch {
          resolve([]);
        }
      }, 400);
    });
  }

  private getPrefix(document: vscode.TextDocument, position: vscode.Position): string {
    const range = new vscode.Range(new vscode.Position(0, 0), position);
    return document.getText(range);
  }

  private getSuffix(document: vscode.TextDocument, position: vscode.Position): string {
    const end = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
    const range = new vscode.Range(position, end);
    return document.getText(range);
  }
}
