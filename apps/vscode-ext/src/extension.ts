import * as vscode from "vscode";
import { ChatPanel } from "./chat-panel";
import { ModelMeshCompletionProvider } from "./completion-provider";
import { ModelMeshClient } from "@modelmesh/sdk";

let client: ModelMeshClient;
let completionDisposable: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("modelmesh");
  const baseUrl = config.get<string>("baseUrl", "http://localhost:3000");
  const apiKey = config.get<string>("apiKey", "");

  client = new ModelMeshClient({ baseUrl, apiKey });

  // Register completion provider if enabled
  updateCompletionProvider(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("modelmesh.openChat", () => {
      ChatPanel.createOrShow(context.extensionUri, client);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("modelmesh.explainCode", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const selection = editor.document.getText(editor.selection);
      if (!selection) {
        vscode.window.showWarningMessage("No code selected.");
        return;
      }
      ChatPanel.createOrShow(context.extensionUri, client);
      await ChatPanel.sendSystemMessage(
        `Explain this code:\n\n\`\`\`\n${selection}\n\`\`\``
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("modelmesh.generateCode", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const line = editor.document.lineAt(editor.selection.active.line);
      const comment = line.text;
      ChatPanel.createOrShow(context.extensionUri, client);
      await ChatPanel.sendSystemMessage(
        `Generate code for:\n\n${comment}`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("modelmesh.switchModel", async () => {
      const models = await client.listModels();
      const pick = await vscode.window.showQuickPick(
        models.map((m) => ({ label: m.id, description: m.owned_by })),
        { placeHolder: "Select a model" }
      );
      if (pick) {
        await config.update("defaultModel", pick.label, true);
        vscode.window.showInformationMessage(`Switched to ${pick.label}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("modelmesh.toggleCompletion", async () => {
      const enabled = config.get<boolean>("codeCompletion.enabled", false);
      await config.update("codeCompletion.enabled", !enabled, true);
      vscode.window.showInformationMessage(
        `ModelMesh code completion ${!enabled ? "enabled" : "disabled"}.`
      );
      updateCompletionProvider(context);
    })
  );

  vscode.commands.executeCommand("setContext", "modelmesh.enabled", true);
}

export function deactivate() {
  if (completionDisposable) {
    completionDisposable.dispose();
  }
}

function updateCompletionProvider(context: vscode.ExtensionContext) {
  if (completionDisposable) {
    completionDisposable.dispose();
    completionDisposable = undefined;
  }

  const config = vscode.workspace.getConfiguration("modelmesh");
  if (config.get<boolean>("codeCompletion.enabled", false)) {
    const provider = new ModelMeshCompletionProvider(client);
    completionDisposable = vscode.languages.registerInlineCompletionItemProvider(
      [
        { scheme: "file", language: "typescript" },
        { scheme: "file", language: "javascript" },
        { scheme: "file", language: "python" },
        { scheme: "file", language: "go" },
        { scheme: "file", language: "rust" },
        { scheme: "file", language: "java" },
        { scheme: "file", language: "cpp" },
        { scheme: "file", language: "c" },
        { scheme: "file", language: "ruby" },
        { scheme: "file", language: "php" },
        { scheme: "file", language: "shellscript" },
        { scheme: "file", language: "sql" },
        { scheme: "file", language: "markdown" },
        { scheme: "file", language: "json" },
        { scheme: "file", language: "yaml" },
        { scheme: "file", language: "xml" },
        { scheme: "file", language: "html" },
        { scheme: "file", language: "css" },
        { scheme: "file", language: "scss" },
      ],
      provider
    );
    context.subscriptions.push(completionDisposable);
  }
}
