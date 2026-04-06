import React, { useState, useEffect } from "react";

const OpenAIConfig = ({ invoke }) => {
  const [apiKey, setApiKey] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Key Status
        const keyResult = await invoke("getOpenAIKey");
        if (keyResult.success && keyResult.key) {
          setIsConfigured(true);
          setApiKey("********");

          // 2. Fetch Selected Model
          const modelResult = await invoke("getOpenAIModelFromKVS");
          if (modelResult.success && modelResult.model) {
            setSelectedModel(modelResult.model);
          }

          // 3. Fetch Available Models
          setIsFetchingModels(true);
          const modelsResult = await invoke("getOpenAIModels");
          if (modelsResult.success && modelsResult.models) {
            setModels(modelsResult.models);
          } else if (modelsResult.error) {
            console.error("Failed to fetch models:", modelsResult.error);
          }
        } else {
          setIsConfigured(false);
          setApiKey("");
          setSelectedModel("");
          setModels([]);
        }
      } catch (error) {
        console.error("Failed to fetch OpenAI configuration:", error);
      } finally {
        setLoading(false);
        setIsFetchingModels(false);
      }
    };

    if (invoke) {
      fetchData();
    }
  }, [invoke]);

  const handleSaveKey = async () => {
    if (!apiKey || apiKey === "********") return;

    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const result = await invoke("saveOpenAIKey", { key: apiKey });
      if (result.success) {
        setIsConfigured(true);
        setApiKey("********");
        setMessage({ type: "success", text: "API key saved successfully!" });

        // Re-fetch models after saving a new key
        setIsFetchingModels(true);
        const modelsResult = await invoke("getOpenAIModels");
        if (modelsResult.success && modelsResult.models) {
          setModels(modelsResult.models);
        }
      } else {
        setMessage({ type: "error", text: result.error || "Failed to save API key." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred while saving the key." });
    } finally {
      setSaving(false);
      setIsFetchingModels(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    }
  };

  const handleSaveModel = async () => {
    if (!selectedModel) return;

    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const result = await invoke("saveOpenAIModel", { model: selectedModel });
      if (result.success) {
        setMessage({ type: "success", text: "Model saved successfully!" });
      } else {
        setMessage({ type: "error", text: result.error || "Failed to save model." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred while saving the model." });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const result = await invoke("removeOpenAIKey");
      if (result.success) {
        setIsConfigured(false);
        setApiKey("");
        setSelectedModel("");
        setModels([]);
        setMessage({ type: "success", text: "API key cleared successfully!" });
      } else {
        setMessage({ type: "error", text: result.error || "Failed to clear API key." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred while clearing the key." });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    }
  };

  // Helper to handle input when it's currently masked
  const onInputChange = (e) => {
    setApiKey(e.target.value);
  };

  if (loading) {
    return null;
  }

  return (
    <div className="section">
      <div className="section-header">
        <span className="section-title">OpenAI Configuration</span>
      </div>
      <div className="card" style={{ padding: "16px" }}>
        <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: isConfigured ? "var(--success-color)" : "var(--error-color)"
          }} />
          <span style={{ fontSize: "13px", fontWeight: "500" }}>
            {isConfigured ? "Key is configured" : "No API key configured"}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label htmlFor="openai-key" style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>
              OpenAI API Key
            </label>
            <input
              id="openai-key"
              type="password"
              value={apiKey}
              onChange={onInputChange}
              placeholder="sk-..."
              style={{
                padding: "8px 12px",
                borderRadius: "4px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--input-bg)",
                color: "var(--text-color)",
                fontSize: "14px"
              }}
            />
          </div>

          <div className="row-actions" style={{ justifyContent: "flex-start" }}>
            <button
              className="btn-small"
              onClick={handleSaveKey}
              disabled={saving || !apiKey || apiKey === "********"}
              style={{
                backgroundColor: "var(--primary-color)",
                color: "white",
                border: "none"
              }}
            >
              {saving ? "Saving..." : "Save Key"}
            </button>
            <button
              className="btn-small btn-danger"
              onClick={handleClear}
              disabled={saving || !isConfigured}
            >
              {saving ? "Clearing..." : "Clear Key"}
            </button>
          </div>

          {message.text && (
            <div className={`alert alert-${message.type}`} style={{ marginTop: "8px" }}>
              {message.text}
            </div>
          )}
        </div>

        {isConfigured && (
          <>
            <hr style={{ margin: "24px 0 16px 0", border: "0", borderTop: "1px solid var(--border-color)" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label htmlFor="openai-model" style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)" }}>
                OpenAI Model
              </label>
              <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: "0 0 4px 0" }}>
                Select the model you want to use for AI validation.
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <select
                  id="openai-model"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={isFetchingModels || saving}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--input-bg)",
                    color: "var(--text-color)",
                    fontSize: "14px",
                    flexGrow: 1
                  }}
                >
                  {isFetchingModels ? (
                    <option>Loading models...</option>
                  ) : (
                    <>
                      <option value="">-- Select a model --</option>
                      {models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <button
                  className="btn-small"
                  onClick={handleSaveModel}
                  disabled={saving || !selectedModel || isFetchingModels}
                  style={{
                    backgroundColor: "var(--primary-color)",
                    color: "white",
                    border: "none"
                  }}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OpenAIConfig;