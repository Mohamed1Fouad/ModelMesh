import * as vscode from "vscode";
import type { ModelMeshClient } from "@modelmesh/sdk";

export class ChatPanel {
  public static currentPanel: ChatPanel | undefined;
  private static _client: ModelMeshClient;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, client: ModelMeshClient) {
    ChatPanel._client = client;
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "modelmeshChat",
      "ModelMesh Chat",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    ChatPanel.currentPanel = new ChatPanel(panel, extensionUri);
  }

  public static async sendSystemMessage(text: string) {
    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel._panel.webview.postMessage({ command: "systemMessage", text });
    }
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._panel.webview.html = this._getHtml(this._panel.webview, extensionUri);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "chat":
            await this.handleChat(message.text);
            break;
        }
      },
      null,
      this._disposables
    );
  }

  private async handleChat(text: string) {
    try {
      const config = vscode.workspace.getConfiguration("modelmesh");
      const defaultModel = config.get<string>("defaultModel", "");
      const stream = await ChatPanel._client.chatCompletionStream({
        model: defaultModel || undefined,
        messages: [{ role: "user", content: text }],
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        this._panel.webview.postMessage({ command: "stream", text: delta });
      }
      this._panel.webview.postMessage({ command: "done" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._panel.webview.postMessage({ command: "error", text: msg });
    }
  }

  private _getHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ModelMesh Chat</title>
      <style>
        body { font-family: system-ui, sans-serif; margin: 0; padding: 0; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
        #chat { display: flex; flex-direction: column; height: 100vh; }
        #messages { flex: 1; overflow-y: auto; padding: 12px; }
        .msg { margin: 8px 0; padding: 10px 14px; border-radius: 8px; max-width: 90%; word-wrap: break-word; }
        .user { background: var(--vscode-button-background); color: var(--vscode-button-foreground); align-self: flex-end; }
        .assistant { background: var(--vscode-editor-inactiveSelectionBackground); align-self: flex-start; }
        .error { background: #3a1c1c; color: #ffaaaa; }
        #input-area { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--vscode-panel-border); }
        #input { flex: 1; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 6px; padding: 8px 12px; }
        #send { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; }
        #send:disabled { opacity: 0.5; cursor: not-allowed; }
      </style>
    </head>
    <body>
      <div id="chat">
        <div id="messages"></div>
        <div id="input-area">
          <input id="input" type="text" placeholder="Ask ModelMesh..." />
          <button id="send">Send</button>
        </div>
      </div>
      <script>
        const vscode = acquireVsCodeApi();
        const messagesEl = document.getElementById('messages');
        const inputEl = document.getElementById('input');
        const sendBtn = document.getElementById('send');
        let currentAssistantMsg = null;

        function appendMessage(role, text) {
          const div = document.createElement('div');
          div.className = 'msg ' + role;
          div.textContent = text;
          messagesEl.appendChild(div);
          messagesEl.scrollTop = messagesEl.scrollHeight;
          return div;
        }

        function send() {
          const text = inputEl.value.trim();
          if (!text) return;
          appendMessage('user', text);
          inputEl.value = '';
          currentAssistantMsg = appendMessage('assistant', '');
          sendBtn.disabled = true;
          vscode.postMessage({ command: 'chat', text });
        }

        sendBtn.addEventListener('click', send);
        inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

        window.addEventListener('message', (event) => {
          const msg = event.data;
          if (msg.command === 'systemMessage') {
            appendMessage('user', msg.text);
            currentAssistantMsg = appendMessage('assistant', '');
            sendBtn.disabled = true;
            vscode.postMessage({ command: 'chat', text: msg.text });
          }
          if (msg.command === 'stream' && currentAssistantMsg) {
            currentAssistantMsg.textContent += msg.text;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
          if (msg.command === 'done') {
            currentAssistantMsg = null;
            sendBtn.disabled = false;
          }
          if (msg.command === 'error') {
            appendMessage('error', msg.text);
            currentAssistantMsg = null;
            sendBtn.disabled = false;
          }
        });
      </script>
    </body>
    </html>`;
  }

  public dispose() {
    ChatPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }
}
