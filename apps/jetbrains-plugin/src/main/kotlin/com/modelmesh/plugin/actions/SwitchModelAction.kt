package com.modelmesh.plugin.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.ui.Messages
import com.modelmesh.plugin.api.ModelMeshClient
import com.modelmesh.plugin.settings.ModelMeshSettings

class SwitchModelAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val client = ModelMeshClient()
        val models = client.listModels()

        if (models.isEmpty()) {
            Messages.showErrorDialog("No models available. Check your gateway connection.", "ModelMesh")
            return
        }

        val modelNames = models.map { "${it.id} (${it.owned_by})" }.toTypedArray()
        val selected = Messages.showEditableChooseDialog(
            "Select a model:",
            "Switch Model",
            Messages.getQuestionIcon(),
            modelNames,
            modelNames.firstOrNull(),
            null
        )

        if (selected != null) {
            val modelId = models[modelNames.indexOf(selected)].id
            val settings = ModelMeshSettings.getInstance().state
            settings.defaultModel = modelId
            Messages.showInfoMessage("Switched to $modelId", "ModelMesh")
        }
    }
}
