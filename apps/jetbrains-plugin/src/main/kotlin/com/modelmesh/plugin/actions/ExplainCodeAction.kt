package com.modelmesh.plugin.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.wm.ToolWindowManager
import com.modelmesh.plugin.toolwindow.ModelMeshChatPanel

class ExplainCodeAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return
        val selection = editor.selectionModel.selectedText

        if (selection.isNullOrBlank()) {
            return
        }

        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow("ModelMesh Chat")
        toolWindow?.show()

        // Find the chat panel and send the explanation request
        val content = toolWindow?.contentManager?.contents?.firstOrNull()
        val chatPanel = content?.component as? ModelMeshChatPanel
        chatPanel?.apply {
            appendMessage("You", "Explain this code:\n\n```\n$selection\n```")
            sendSystemMessage("Explain this code:\n\n```\n$selection\n```")
        }
    }

    override fun update(e: AnActionEvent) {
        val editor = e.getData(CommonDataKeys.EDITOR)
        e.presentation.isEnabledAndVisible = editor?.selectionModel?.hasSelection() == true
    }
}
