/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState, useEffect } from "react";
import CustomSelect from "./CustomSelect";
import Tooltip from "./Tooltip";

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI", icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M22.28 9.37a5.84 5.84 0 0 0-.51-4.79 5.93 5.93 0 0 0-6.38-2.87A5.84 5.84 0 0 0 11 0a5.93 5.93 0 0 0-5.66 4.13 5.84 5.84 0 0 0-3.9 2.83 5.93 5.93 0 0 0 .73 6.95 5.84 5.84 0 0 0 .51 4.79 5.93 5.93 0 0 0 6.38 2.87A5.84 5.84 0 0 0 13 24a5.93 5.93 0 0 0 5.66-4.13 5.84 5.84 0 0 0 3.9-2.83 5.93 5.93 0 0 0-.73-6.95l.45-.72z" fill="currentColor" opacity="0.7"/></svg>' },
  { value: "azure", label: "Azure OpenAI", icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M13.05 4.24L7.4 18.5H2L7.66 4.24h5.39zM22 18.5h-5.13l-1.91-5.36-3.25 3.99L22 18.5zm-8.27-8.33l2.47 6.87L22 4.24h-5.71L13.73 10.17z" fill="#0078d4"/></svg>' },
  { value: "openrouter", label: "OpenRouter", icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" opacity="0.5"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' },
  { value: "anthropic", label: "Anthropic", icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M13.83 3h3.34L22 21h-3.34l-4.83-18zm-7 0H3.5L8.33 21h3.34L6.83 3z" fill="currentColor" opacity="0.7"/></svg>' },
];

const PROVIDER_HELP = {
  openai: { keyPlaceholder: "sk-...", keyLabel: "OpenAI API Key", endpointNeeded: false },
  azure: { keyPlaceholder: "Enter your Azure OpenAI API key...", keyLabel: "Azure API Key", endpointNeeded: true, endpointPlaceholder: "https://myresource.openai.azure.com/openai/v1" },
  openrouter: { keyPlaceholder: "sk-or-...", keyLabel: "OpenRouter API Key", endpointNeeded: false },
  anthropic: { keyPlaceholder: "sk-ant-...", keyLabel: "Anthropic API Key", endpointNeeded: false },
};

export default function OpenAIConfig({ invoke }) {
  const [provider, setProvider] = useState("openai");
  const [savedProvider, setSavedProvider] = useState("openai"); // what's actually saved in KVS
  const [baseUrl, setBaseUrl] = useState("");
  const [isByok, setIsByok] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [endpointInput, setEndpointInput] = useState("");
  const [models, setModels] = useState([]);
  const [currentModel, setCurrentModel] = useState(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [factoryModel, setFactoryModel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const pHelp = PROVIDER_HELP[provider] || PROVIDER_HELP.openai;

  const loadStatus = async () => {
    if (!invoke) return;
    try {
      const [keyResult, modelsResult, modelKvs, providerResult] = await Promise.all([
        invoke("getOpenAIKey"),
        invoke("getOpenAIModels"),
        invoke("getOpenAIModelFromKVS"),
        invoke("getProvider"),
      ]);

      if (providerResult.success) {
        const p = providerResult.provider || "openai";
        setProvider(p);
        setSavedProvider(p);
        setBaseUrl(providerResult.baseUrl || "");
        setEndpointInput(providerResult.provider === "azure" ? (providerResult.baseUrl || "") : "");
      }
      if (keyResult.success) {
        setHasKey(keyResult.hasKey);
        setIsByok(keyResult.isByok);
      }
      if (modelsResult.success) {
        setModels(modelsResult.models || []);
        if (!modelsResult.isByok) {
          setFactoryModel(modelsResult.currentModel || "");
        }
      }
      if (modelKvs.success) {
        setCurrentModel(modelKvs.model);
        if (modelKvs.model) {
          setSelectedModel(modelKvs.model);
        }
        if (!modelKvs.isByok) {
          setFactoryModel(modelKvs.model || "");
        }
      }
    } catch (e) {
      console.error("Failed to load AI config status:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSaveProvider = async () => {
    setSavingProvider(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = { provider };
      if (provider === "azure" && endpointInput.trim()) {
        payload.baseUrl = endpointInput.trim();
      }
      const result = await invoke("saveProvider", payload);
      if (result.success) {
        setSavedProvider(provider);
        setSuccess(`Switched to ${PROVIDER_OPTIONS.find((p) => p.value === provider)?.label || provider}`);
        setKeyInput("");
        await new Promise((r) => setTimeout(r, 500));
        await loadStatus();
      } else {
        setError(result.error || "Failed to save provider");
      }
    } catch (e) {
      setError("Failed to save provider: " + e.message);
    }
    setSavingProvider(false);
  };

  const handleSaveEndpoint = async () => {
    if (!endpointInput.trim()) return;
    setSavingProvider(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await invoke("saveProvider", { provider: "azure", baseUrl: endpointInput.trim() });
      if (result.success) {
        setSuccess("Azure endpoint saved");
        await loadStatus();
      } else {
        setError(result.error || "Failed to save endpoint");
      }
    } catch (e) {
      setError("Failed to save endpoint: " + e.message);
    }
    setSavingProvider(false);
  };

  const handleSaveKey = async () => {
    if (!keyInput.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await invoke("saveOpenAIKey", { key: keyInput.trim() });
      if (result.success) {
        setKeyInput("");
        setSuccess("API key saved successfully");
        // Brief delay to let KVS propagate, then reload status + models
        await new Promise((r) => setTimeout(r, 500));
        await loadStatus();
      } else {
        setError(result.error || "Failed to save key");
      }
    } catch (e) {
      setError("Failed to save key: " + e.message);
    }
    setSaving(false);
  };

  const handleRemoveKey = async () => {
    setRemoving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await invoke("removeOpenAIKey");
      if (result.success) {
        setSuccess("Reverted to factory key");
        setModels([]);
        setCurrentModel(null);
        setSelectedModel("");
        await loadStatus();
      } else {
        setError(result.error || "Failed to remove key");
      }
    } catch (e) {
      setError("Failed to remove key: " + e.message);
    }
    setRemoving(false);
  };

  const handleSaveModel = async () => {
    if (!selectedModel) return;
    setSavingModel(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await invoke("saveOpenAIModel", { model: selectedModel });
      if (result.success) {
        setCurrentModel(selectedModel);
        setSuccess("Model saved: " + selectedModel);
      } else {
        setError(result.error || "Failed to save model");
      }
    } catch (e) {
      setError("Failed to save model: " + e.message);
    }
    setSavingModel(false);
  };

  if (loading) {
    return (
      <div className="section">
        <div className="section-header">
          <span className="section-title">AI Provider Configuration</span>
        </div>
        <div className="card">
          <div style={{ padding: "16px" }}>
            <div className="sk sk-text" style={{ width: "40%", height: 12, marginBottom: 12 }} />
            <div className="sk sk-block" style={{ height: 40, marginBottom: 12 }} />
            <div className="sk sk-text" style={{ width: "60%", height: 10 }} />
          </div>
        </div>
      </div>
    );
  }

  const providerLabel = PROVIDER_OPTIONS.find((p) => p.value === provider)?.label || provider;

  return (
    <div className="section">
      <div className="section-header">
        <span className="section-title">AI Provider Configuration</span>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
          <button className="alert-dismiss" onClick={() => setError(null)}>&times;</button>
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          <span>{success}</span>
          <button className="alert-dismiss" onClick={() => setSuccess(null)}>&times;</button>
        </div>
      )}

      <div className="card">
        <div style={{ padding: "16px" }}>
          {/* Provider Selector */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "6px" }}>
              Provider
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ maxWidth: "280px", flex: "0 0 280px" }}>
                <CustomSelect
                  value={provider}
                  onChange={setProvider}
                  options={PROVIDER_OPTIONS}
                  disabled={savingProvider}
                />
              </div>
              {provider !== savedProvider && (
                <button className="btn-small btn-edit" onClick={handleSaveProvider} disabled={savingProvider}>
                  {savingProvider ? "Switching..." : "Switch Provider"}
                </button>
              )}
            </div>
            {provider !== savedProvider && (
              <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "var(--primary-color)" }}>
                Your keys are saved per provider. Switching back will restore your previous key.
              </p>
            )}
            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
              All providers support chat completions, tool calling, and vision capabilities.
            </p>
          </div>

          {/* Azure Endpoint — only for Azure */}
          {provider === "azure" && (
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Azure Endpoint
                <Tooltip text={
                  "How to get your Azure OpenAI endpoint:\n\n" +
                  "1. Go to portal.azure.com\n" +
                  "2. Navigate to your Azure OpenAI resource (or create one under 'Azure AI services' > 'Azure OpenAI')\n" +
                  "3. In the resource overview, find 'Endpoint' — it looks like:\n" +
                  "   https://myresource.openai.azure.com/\n" +
                  "4. Append /openai/v1 to the end, so the full URL is:\n" +
                  "   https://myresource.openai.azure.com/openai/v1\n\n" +
                  "Make sure you have at least one model deployed in Azure AI Studio (e.g. gpt-4o or gpt-4o-mini) before connecting."
                } />
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="text"
                  value={endpointInput}
                  onChange={(e) => setEndpointInput(e.target.value)}
                  placeholder={pHelp.endpointPlaceholder}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    border: "1px solid var(--border-color)",
                    borderRadius: "4px",
                    background: "var(--input-bg)",
                    color: "var(--text-color)",
                    fontSize: "13px",
                    fontFamily: "SFMono-Regular, Consolas, monospace",
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveEndpoint()}
                />
                <button className="btn-small btn-edit" onClick={handleSaveEndpoint} disabled={savingProvider || !endpointInput.trim()}>
                  {savingProvider ? "Saving..." : "Save"}
                </button>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                Your Azure OpenAI resource URL. Must end with <code style={{ fontSize: "11px" }}>/openai/v1</code>
              </p>
            </div>
          )}

          {/* Key/Model section — only show for the saved (active) provider */}
          {provider !== savedProvider ? (
            <div style={{ padding: "12px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              Click <strong>Switch Provider</strong> to activate {PROVIDER_OPTIONS.find((p) => p.value === provider)?.label || provider} and manage its API key.
            </div>
          ) : (<>

          {/* Status */}
          <div className="openai-status" style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: hasKey ? "var(--success-color)" : "var(--error-color)",
              }} />
              <strong style={{ fontSize: "13px" }}>
                {isByok ? `Using your ${providerLabel} key` : "Using factory key"}
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)" }}>
              {isByok
                ? `Connected to ${providerLabel}. You can select from available models. Remove the key to revert to the factory key.`
                : hasKey
                  ? `Factory model: ${factoryModel || "gpt-5.4-mini"}. Provide your own ${providerLabel} key to unlock model selection.`
                  : `No API key configured. Provide your ${providerLabel} API key to get started.`
              }
            </p>
          </div>

          {/* API Key Input */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "flex", alignItems: "center", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "6px" }}>
              {pHelp.keyLabel}
              {provider === "azure" && (
                <Tooltip text={
                  "How to get your Azure OpenAI API key:\n\n" +
                  "1. Go to portal.azure.com\n" +
                  "2. Open your Azure OpenAI resource\n" +
                  "3. In the left sidebar, click 'Keys and Endpoint' (under Resource Management)\n" +
                  "4. Copy either Key 1 or Key 2 — both work\n\n" +
                  "The key is a 32-character hex string (no 'sk-' prefix). Keep it secret — anyone with this key can use your Azure OpenAI quota."
                } />
              )}
              {provider === "openrouter" && (
                <Tooltip text={
                  "How to get your OpenRouter API key:\n\n" +
                  "1. Go to openrouter.ai and sign in\n" +
                  "2. Click your profile icon > 'Keys'\n" +
                  "3. Click 'Create Key', give it a name, and copy it\n\n" +
                  "OpenRouter keys start with 'sk-or-'. You'll need credits in your account to make API calls."
                } />
              )}
              {provider === "anthropic" && (
                <Tooltip text={
                  "How to get your Anthropic API key:\n\n" +
                  "1. Go to console.anthropic.com and sign in\n" +
                  "2. Click 'API Keys' in the left sidebar\n" +
                  "3. Click 'Create Key', give it a name, and copy it\n\n" +
                  "Anthropic keys start with 'sk-ant-'. You'll need credits or a billing plan to make API calls.\n\n" +
                  "Default model: Claude Haiku 4.5 (fastest, most affordable). You can switch to Sonnet or Opus for more capable models."
                } />
              )}
            </label>
            {isByok ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  flex: 1,
                  padding: "8px 12px",
                  background: "var(--code-bg)",
                  borderRadius: "4px",
                  fontFamily: "SFMono-Regular, Consolas, monospace",
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  letterSpacing: "1px",
                }}>
                  ••••••••••••••••
                </span>
                <button className="btn-small btn-danger" onClick={handleRemoveKey} disabled={removing}>
                  {removing ? "Removing..." : "Remove Key"}
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={pHelp.keyPlaceholder}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    border: "1px solid var(--border-color)",
                    borderRadius: "4px",
                    background: "var(--input-bg)",
                    color: "var(--text-color)",
                    fontSize: "13px",
                    fontFamily: "SFMono-Regular, Consolas, monospace",
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                />
                <button className="btn-small btn-edit" onClick={handleSaveKey} disabled={saving || !keyInput.trim()}>
                  {saving ? "Saving..." : "Save Key"}
                </button>
              </div>
            )}
          </div>

          {/* Model Selection — only when BYOK */}
          {isByok && (
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "6px" }}>
                Model
              </label>
              {models.length === 0 ? (
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
                  No chat models found. Check your API key and try again.
                </p>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ flex: 1 }}>
                    <CustomSelect
                      value={selectedModel}
                      onChange={setSelectedModel}
                      placeholder="Select a model..."
                      searchable
                      searchPlaceholder="Search models..."
                      options={models.map((m) => ({ value: m, label: m }))}
                    />
                  </div>
                  <button
                    className="btn-small btn-edit"
                    onClick={handleSaveModel}
                    disabled={savingModel || !selectedModel || selectedModel === currentModel}
                  >
                    {savingModel ? "Saving..." : "Save Model"}
                  </button>
                </div>
              )}
              {currentModel && (
                <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                  Currently active: <strong>{currentModel}</strong>
                </p>
              )}
            </div>
          )}
          </>)}
        </div>
      </div>
    </div>
  );
}
