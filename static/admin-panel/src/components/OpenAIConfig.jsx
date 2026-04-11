import React, { useState, useEffect } from "react";

const OpenAIConfig = ({ invoke }) => {
  const [apiKey, setApiKey] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [isByok, setIsByok] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Key Status (now includes isByok flag)
        const keyResult = await invoke("getOpenAIKey");
        if (keyResult.success) {
          if (keyResult.key) {
            setIsConfigured(true);
            setIsByok(keyResult.isByok || false);
            setApiKey("********");
          } else {
            setIsConfigured(false);
            setIsByok(false);
            setApiKey("");
          }
        }

        // 2. Fetch Selected Model
        const modelResult = await invoke("getOpenAIModelFromKVS");
        if (modelResult.success && modelResult.model) {
          setSelectedModel(modelResult.model);
        }

        // 3. Fetch Available Models (handles BYOK vs default logic)
        await fetchModels();
      } catch (error) {
        console.error("Failed to fetch OpenAI configuration:", error);
      } finally {
        setLoading(false);
        setIsFetchingModels(false);
      }
    };

    const fetchModels = async () => {
      setIsFetchingModels(true);
      try {
        const modelsResult = await invoke("getOpenAIModels");
        if (modelsResult.success && modelsResult.models) {
          setModels(modelsResult.models);
          // If using default key and only one model, auto-select it
          if (!modelsResult.isByok && modelsResult.models.length === 1) {
            setSelectedModel(modelsResult.models[0]);
          }
        } else if (modelsResult.error) {
          console.error("Failed to fetch models:", modelsResult.error);
          setMessage({ 
            type: "warning", 
            text: modelsResult.message || modelsResult.error 
          });
        }
      } catch (error) {
        console.error("Error fetching models:", error);
      } finally {
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
        setIsByok(true);
        setApiKey("********");
        setMessage({ 
          type: "success", 
          text: "Your API key has been saved! You now have access to all available OpenAI models." 
        });

        // Re-fetch models after saving a new key
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
      setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    }
  };

  const handleSaveModel = async () => {
    if (!selectedModel) return;

    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const result = await invoke("saveOpenAIModel", { model: selectedModel });
      if (result.success) {
        setMessage({ 
          type: "success", 
          text: isByok 
            ? `Model saved successfully! Using ${selectedModel} for AI validation.`
            : `Default model confirmed: ${selectedModel}`
        });
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
        setIsByok(false);
        setApiKey("");
        setSelectedModel("");
        setModels([]);
        setMessage({ 
          type: "success", 
          text: "Your API key has been cleared. The app will now use the default OpenAI configuration." 
        });
      } else {
        setMessage({ type: "error", text: result.error || "Failed to clear API key." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred while clearing the key." });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    }
  };

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
      <div className="card" style={{ padding: "24px" }}>
        {/* Status Indicator */}
        <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            backgroundColor: isConfigured ? "var(--success-color)" : "var(--error-color)",
            boxShadow: isConfigured ? "0 0 8px var(--success-color)" : "none"
          }} />
          <div>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
              {isConfigured 
                ? (isByok ? "Your API Key is configured" : "Default app key active") 
                : "No API key configured"}
            </span>
            {isConfigured && isByok && (
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                Using your own OpenAI key — full model access available
              </div>
            )}
            {isConfigured && !isByok && (
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                Using default app key — limited to pre-configured model
              </div>
            )}
          </div>
        </div>

        {/* API Key Input Section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label htmlFor="openai-key" className="label">
              OpenAI API Key {isByok && <span className="required">*</span>}
            </label>
            <input
              id="openai-key"
              type="password"
              value={apiKey}
              onChange={onInputChange}
              placeholder={isConfigured ? "******** (click Clear to change)" : "sk-..."}
              disabled={saving || (isConfigured && !isByok)}
              style={{
                padding: "12px 14px",
                borderRadius: "var(--border-radius-sm)",
                border: `2px solid ${isConfigured ? "var(--success-color)" : "var(--border-color)"}`,
                backgroundColor: isConfigured ? "var(--input-bg)" : "var(--input-bg)",
                color: "var(--text-primary)",
                fontSize: "14px",
                cursor: isConfigured && !isByok ? "not-allowed" : "text",
                opacity: (isConfigured && !isByok) ? 0.7 : 1,
                transition: "all 0.3s ease"
              }}
            />
            <p className="hint">
              {isByok 
                ? "Your personal OpenAI API key is currently active. Enter a new key to replace it."
                : isConfigured 
                  ? "This app has a default key configured by the administrator. Add your own key for full model access."
                  : "Enter your OpenAI API key to enable AI validation features."}
            </p>
          </div>

          <div className="flex gap-4" style={{ flexWrap: "wrap" }}>
            <button
              className="button"
              onClick={handleSaveKey}
              disabled={saving || !apiKey || apiKey === "********"}
            >
              {saving ? "Saving..." : "Save Your Key"}
            </button>
            <button
              className="button button-secondary"
              onClick={handleClear}
              disabled={saving || !isConfigured || !isByok}
            >
              {saving ? "Clearing..." : "Clear My Key"}
            </button>
          </div>

          {/* Messages */}
          {message.text && (
            <div className={`alert alert-${message.type}`} style={{ marginTop: "8px" }}>
              {message.text}
            </div>
          )}
        </div>

        <hr style={{ margin: "24px 0", border: "0", borderTop: "1px solid var(--border-color)" }} />
        
        {/* Model Selection Section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label htmlFor="openai-model" className="label">
            OpenAI Model
          </label>
          
          {isConfigured ? (
            <>
              <p className="hint" style={{ marginBottom: "8px" }}>
                {isByok 
                  ? "Select the model you want to use for AI validation. Your key gives access to all available models."
                  : `The app is configured with a default model. ${models.length > 0 ? `Current: ${models[0]}` : ""}`}
              </p>
              
              <div className="flex gap-4" style={{ flexWrap: "wrap", alignItems: "center" }}>
                <select
                  id="openai-model"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={isFetchingModels || saving || (!isByok && models.length <= 1)}
                  style={{
                    padding: "12px 40px 12px 14px",
                    borderRadius: "var(--border-radius-sm)",
                    border: `2px solid ${(!isByok && models.length <= 1) ? "var(--success-color)" : "var(--border-color)"}`,
                    backgroundColor: "var(--input-bg)",
                    color: "var(--text-primary)",
                    fontSize: "14px",
                    flexGrow: 1,
                    maxWidth: "400px",
                    cursor: (!isByok && models.length <= 1) ? "not-allowed" : "pointer",
                    opacity: (!isByok && models.length <= 1) ? 0.7 : 1,
                    transition: "all 0.3s ease"
                  }}
                >
                  {isFetchingModels ? (
                    <option>Loading models...</option>
                  ) : (
                    <>
                      {!isByok && models.length <= 1 ? (
                        <option value={models[0] || ""}>{models[0] || "No model available"}</option>
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
                    </>
                  )}
                </select>
                
                <button
                  className="button"
                  onClick={handleSaveModel}
                  disabled={saving || !selectedModel || isFetchingModels || (!isByok && models.length <= 1)}
                >
                  {saving ? "Saving..." : "Save Model"}
                </button>
              </div>

              {!isByok && models.length <= 1 && (
                <p className="hint" style={{ marginTop: "8px", color: "var(--text-secondary)" }}>
                  ℹ️ Add your own API key above to unlock access to all available OpenAI models.
                </p>
              )}
            </>
          ) : (
            <div className="alert alert-warning">
              <span>Please configure an API key first to select a model.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OpenAIConfig;
