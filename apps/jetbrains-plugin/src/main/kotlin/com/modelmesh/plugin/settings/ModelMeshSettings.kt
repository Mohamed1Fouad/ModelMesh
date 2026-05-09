package com.modelmesh.plugin.settings

import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.util.xmlb.XmlSerializerUtil

@Service(Service.Level.APP)
@State(
    name = "ModelMeshSettings",
    storages = [Storage("modelmesh.xml")]
)
class ModelMeshSettings : PersistentStateComponent<ModelMeshSettings.State> {

    data class State(
        var baseUrl: String = "http://localhost:3000",
        var apiKey: String = "",
        var defaultModel: String = "",
        var timeoutMs: Int = 30000
    )

    private var myState = State()

    override fun getState(): State = myState

    override fun loadState(state: State) {
        XmlSerializerUtil.copyBean(state, myState)
    }

    companion object {
        fun getInstance(): ModelMeshSettings {
            return com.intellij.openapi.application.ApplicationManager.getApplication()
                .getService(ModelMeshSettings::class.java)
        }
    }
}
