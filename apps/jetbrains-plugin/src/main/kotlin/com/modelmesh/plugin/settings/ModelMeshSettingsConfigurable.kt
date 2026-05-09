package com.modelmesh.plugin.settings

import com.intellij.openapi.options.Configurable
import com.intellij.openapi.ui.ComboBox
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import javax.swing.JComponent
import javax.swing.JPanel

class ModelMeshSettingsConfigurable : Configurable {
    private var panel: JPanel? = null
    private val baseUrlField = JBTextField()
    private val apiKeyField = JBTextField()
    private val defaultModelField = JBTextField()
    private val timeoutField = JBTextField()

    override fun getDisplayName(): String = "ModelMesh"

    override fun createComponent(): JComponent {
        val settings = ModelMeshSettings.getInstance().state

        baseUrlField.text = settings.baseUrl
        apiKeyField.text = settings.apiKey
        defaultModelField.text = settings.defaultModel
        timeoutField.text = settings.timeoutMs.toString()

        panel = FormBuilder.createFormBuilder()
            .addLabeledComponent(JBLabel("Gateway URL:"), baseUrlField, 1, false)
            .addLabeledComponent(JBLabel("API Key:"), apiKeyField, 1, false)
            .addLabeledComponent(JBLabel("Default Model (empty = auto):"), defaultModelField, 1, false)
            .addLabeledComponent(JBLabel("Timeout (ms):"), timeoutField, 1, false)
            .addComponentFillVertically(JPanel(), 0)
            .panel

        return panel!!
    }

    override fun isModified(): Boolean {
        val settings = ModelMeshSettings.getInstance().state
        return baseUrlField.text != settings.baseUrl
                || apiKeyField.text != settings.apiKey
                || defaultModelField.text != settings.defaultModel
                || timeoutField.text != settings.timeoutMs.toString()
    }

    override fun apply() {
        val settings = ModelMeshSettings.getInstance().state
        settings.baseUrl = baseUrlField.text
        settings.apiKey = apiKeyField.text
        settings.defaultModel = defaultModelField.text
        settings.timeoutMs = timeoutField.text.toIntOrNull() ?: 30000
    }

    override fun reset() {
        val settings = ModelMeshSettings.getInstance().state
        baseUrlField.text = settings.baseUrl
        apiKeyField.text = settings.apiKey
        defaultModelField.text = settings.defaultModel
        timeoutField.text = settings.timeoutMs.toString()
    }
}
