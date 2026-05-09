package com.modelmesh.plugin.toolwindow

import com.intellij.openapi.project.Project
import com.modelmesh.plugin.api.ModelMeshClient
import com.modelmesh.plugin.settings.ModelMeshSettings
import java.awt.BorderLayout
import java.awt.event.KeyAdapter
import java.awt.event.KeyEvent
import javax.swing.*

class ModelMeshChatPanel(project: Project) : JPanel(BorderLayout()) {
    private val client = ModelMeshClient()
    private val chatArea = JTextArea().apply {
        isEditable = false
        lineWrap = true
        wrapStyleWord = true
    }
    private val inputField = JTextField()
    private val sendButton = JButton("Send")
    private val modelLabel = JLabel("Model: auto")

    init {
        // Header
        val headerPanel = JPanel(BorderLayout()).apply {
            add(JLabel("ModelMesh Chat"), BorderLayout.WEST)
            add(modelLabel, BorderLayout.EAST)
            border = BorderFactory.createEmptyBorder(4, 8, 4, 8)
        }

        // Chat area with scroll
        val scrollPane = JScrollPane(chatArea).apply {
            verticalScrollBarPolicy = ScrollPaneConstants.VERTICAL_SCROLLBAR_AS_NEEDED
        }

        // Input panel
        val inputPanel = JPanel(BorderLayout()).apply {
            add(inputField, BorderLayout.CENTER)
            add(sendButton, BorderLayout.EAST)
            border = BorderFactory.createEmptyBorder(4, 8, 4, 8)
        }

        add(headerPanel, BorderLayout.NORTH)
        add(scrollPane, BorderLayout.CENTER)
        add(inputPanel, BorderLayout.SOUTH)

        // Send action
        val sendAction = {
            val text = inputField.text.trim()
            if (text.isNotEmpty()) {
                appendMessage("You", text)
                inputField.text = ""
                sendButton.isEnabled = false

                SwingWorker<String, Void>() {
                    override fun doInBackground(): String {
                        return client.chatCompletion(
                            listOf(ModelMeshClient.ChatMessage("user", text))
                        ) ?: "No response"
                    }

                    override fun done() {
                        try {
                            appendMessage("Assistant", get())
                        } catch (e: Exception) {
                            appendMessage("Error", e.message ?: "Unknown error")
                        }
                        sendButton.isEnabled = true
                    }
                }.execute()
            }
        }

        sendButton.addActionListener { sendAction() }
        inputField.addKeyListener(object : KeyAdapter() {
            override fun keyPressed(e: KeyEvent) {
                if (e.keyCode == KeyEvent.VK_ENTER) {
                    sendAction()
                }
            }
        })

        updateModelLabel()
    }

    fun appendMessage(role: String, text: String) {
        SwingUtilities.invokeLater {
            chatArea.append("\n$role: $text\n")
            chatArea.caretPosition = chatArea.document.length
        }
    }

    fun sendSystemMessage(text: String) {
        SwingWorker<String, Void>() {
            override fun doInBackground(): String {
                return client.chatCompletion(
                    listOf(ModelMeshClient.ChatMessage("user", text))
                ) ?: "No response"
            }

            override fun done() {
                try {
                    appendMessage("Assistant", get())
                } catch (e: Exception) {
                    appendMessage("Error", e.message ?: "Unknown error")
                }
            }
        }.execute()
    }

    private fun updateModelLabel() {
        val model = ModelMeshSettings.getInstance().state.defaultModel
        modelLabel.text = "Model: ${model.ifBlank { "auto" }}"
    }
}
