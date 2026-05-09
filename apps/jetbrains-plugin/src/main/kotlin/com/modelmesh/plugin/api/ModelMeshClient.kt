package com.modelmesh.plugin.api

import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.modelmesh.plugin.settings.ModelMeshSettings
import java.net.HttpURLConnection
import java.net.URL

class ModelMeshClient {
    private val gson = Gson()

    data class ChatMessage(val role: String, val content: String)
    data class ChatRequest(
        val model: String?,
        val messages: List<ChatMessage>,
        val stream: Boolean = false,
        val temperature: Double? = null,
        val max_tokens: Int? = null
    )

    data class ChatChoice(val message: ChatMessage, val finish_reason: String?)
    data class ChatResponse(
        val id: String,
        val choices: List<ChatChoice>
    )

    data class ModelItem(val id: String, val owned_by: String)
    data class ModelList(val data: List<ModelItem>)

    fun chatCompletion(messages: List<ChatMessage>, model: String? = null): String? {
        val settings = ModelMeshSettings.getInstance().state
        val url = URL("${settings.baseUrl}/v1/chat/completions")

        return try {
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.setRequestProperty("Content-Type", "application/json")
            if (settings.apiKey.isNotBlank()) {
                connection.setRequestProperty("Authorization", "Bearer ${settings.apiKey}")
            }
            connection.doOutput = true
            connection.connectTimeout = settings.timeoutMs
            connection.readTimeout = settings.timeoutMs

            val request = ChatRequest(
                model = model ?: settings.defaultModel.ifBlank { null },
                messages = messages,
                stream = false
            )

            connection.outputStream.use { os ->
                os.write(gson.toJson(request).toByteArray())
            }

            val responseText = connection.inputStream.bufferedReader().use { it.readText() }
            val response = gson.fromJson(responseText, ChatResponse::class.java)
            response.choices.firstOrNull()?.message?.content
        } catch (e: Exception) {
            "Error: ${e.message}"
        }
    }

    fun listModels(): List<ModelItem> {
        val settings = ModelMeshSettings.getInstance().state
        val url = URL("${settings.baseUrl}/v1/models")

        return try {
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = "GET"
            if (settings.apiKey.isNotBlank()) {
                connection.setRequestProperty("Authorization", "Bearer ${settings.apiKey}")
            }
            connection.connectTimeout = settings.timeoutMs
            connection.readTimeout = settings.timeoutMs

            val responseText = connection.inputStream.bufferedReader().use { it.readText() }
            val response = gson.fromJson(responseText, ModelList::class.java)
            response.data
        } catch (e: Exception) {
            emptyList()
        }
    }
}
